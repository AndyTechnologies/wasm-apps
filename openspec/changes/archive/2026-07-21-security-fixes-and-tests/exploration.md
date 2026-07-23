## Exploration: security-fixes-and-tests

### Current State

The codebase was reviewed and found to have 13 security, correctness, and code-quality issues across the linker and compiler packages. Additionally, 10 modules lack adequate test coverage. No partial fixes exist for any of the issues.

### Affected Areas

| File                                    | Issues                                                     | Lines                                     |
| --------------------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| `packages/linker/src/wasm-io.ts`        | OOB reads (×3)                                             | 57, 72, 87                                |
| `packages/linker/src/wasm-leb128.ts`    | No iteration limit on LEB128 (mitigated: has 36-bit limit) | 5-14                                      |
| `packages/linker/src/extract.ts`        | No LZMA memlimit, no tar symlink protection                | 29-30                                     |
| `packages/linker/src/downloader.ts`     | No HTTP timeout, unvalidated redirects, resume corruption  | 41-47, 133-156                            |
| `packages/linker/src/compiler.ts`       | `--target` without validation, silent chmod catch          | 37-38, 64-69                              |
| `packages/linker/src/watch-utils.ts`    | Linux subdir polling slow, unsanitized watch path          | 93, 98                                    |
| `packages/linker/src/codegen.ts`        | `std::exit(1)` in generated C++ (×8 occurrences)           | 254, 256, 261, 333, 346, 355-356, 360-361 |
| `packages/compiler/src/disk-cache.ts`   | Inefficient hash key (JSON embedding sourceCode)           | 30-43                                     |
| `packages/linker/src/plugin-manager.ts` | `loadWasmPlugins` no-op loop                               | 42-48                                     |

**Untested modules** (10 total):

- `packages/linker/src/downloader.ts`
- `packages/linker/src/extract.ts`
- `packages/linker/src/compiler.ts`
- `packages/linker/src/setup.ts`
- `packages/linker/src/plugin-loader.ts`
- `packages/linker/src/plugin-manager.ts`
- `packages/linker/src/native-app-builder.ts`
- `packages/linker/src/build-pipeline.ts`
- `packages/linker/src/host-function-registry.ts` (has test but no edge cases)
- `packages/linker/src/codegen.ts` (has snapshot-only test)

### Issue Analysis

#### 1. wasm-io.ts — Out-of-bounds reads (3 locations)

**Line 57**: `if (buffer[offset++] !== 0x60) break;`

- No bounds check before reading `buffer[offset++]` inside the type-section iteration loop
- The outer loop bounds-check against `buffer.length` but inner loop does not check against `sectionEnd`
- **Severity**: Medium — malformed WASM can cause undefined behavior

**Line 72**: `buffer.toString('utf-8', offset, offset + moduleLen)`

- No check that `offset + moduleLen` is within buffer or `sectionEnd`
- **Severity**: High — corrupt WASM modules can cause crash or out-of-range read

**Line 87**: `typeSignatures[typeIdx]`

- No bounds check on `typeIdx` before array access
- **Severity**: Low — JS returns `undefined` for OOB array access, guarded by `if (sig)` on line 88

**Fix**: Add bounds checks against `sectionEnd` before every read operation in the section parsing loops. Validate `typeIdx < typeSignatures.length`.

#### 2. wasm-leb128.ts — LEB128 loop limit

**Line 11**: Already has `if (shift > 35) throw new RangeError(...)`

- This limits to max ~5 bytes per LEB128 value, preventing infinite loops
- **Severity**: Low — already mitigated
- **Fix**: Change `RangeError` to a more appropriate error type, or let it propagate gracefully in callers

#### 3. extract.ts — LZMA memlimit (line 29)

- `createDecompressor()` called without memlimit argument
- **Severity**: High — zip bomb vulnerability
- **Fix**: Pass `{ memlimit: 256 * 1024 * 1024 }` or similar to `createDecompressor()`

#### 4. extract.ts — tar symlink protection (line 30)

- `tar.x({ C: destDir })` with no `filter` or `strip` options
- **Severity**: Medium — symlink traversal possible
- **Fix**: Add `filter: (entryPath) => isPathSafe(entryPath)` using existing `isPathSafe()` function

#### 5. downloader.ts — No HTTP timeout

- No call to `req.setTimeout()` or `AbortSignal.timeout()`
- **Severity**: High — hanging connection DoS
- **Fix**: Add `req.setTimeout(30000)` with cleanup on timeout in all HTTP request paths (both HEAD and GET)

#### 6. downloader.ts — Unvalidated redirects (line 46-47)

- Any 3xx redirect to any URL is followed without validation
- No max-redirect limit
- **Severity**: Medium — SSRF/open redirect risk
- **Fix**: Validate redirect URL protocol (reject if not http/https), add max 5 redirect limit, validate host is not from a private/reserved IP range (optional hardening)

#### 7. compiler.ts (linker) — --target without validation (lines 37-38)

- `options.target` passed directly to `execFile` as CLI argument
- **Severity**: Low — `execFile` avoids shell injection, cmake-js parsing limits risk
- **Fix**: Validate target against a known set of CMake targets or apply a restrictive regex

#### 8. compiler.ts (linker) — Silent chmod (lines 64-69)

- Empty `catch {}` swallows chmod errors
- **Severity**: Low — binary is already copied, chmod is best-effort
- **Fix**: Log a warning instead of silencing error; throw only if it's a non-recoverable error

#### 9. downloader.ts — Resume corruption (lines 133-156)

- HEAD request checks `accept-ranges: bytes` and server-reported `content-length` but doesn't verify content integrity of previously-downloaded bytes
- Server with incorrect Range handling produces corrupted files
- **Severity**: Medium — silent data corruption
- **Fix**: On mismatch between expected and actual remaining content, fall back to full download (already attempted at line 63-65, but add hash verification of partial content before resuming, or always re-download if integrity is critical)

#### 10. watch-utils.ts — Linux subdir watching (line 93)

- `fs.watch(dir, { recursive: false })` with polling fallback at 1s interval
- **Severity**: Low — UX/performance concern, not security
- **Fix**: Use `chokidar` or `@parcel/watcher` for cross-platform recursive watching; or document the limitation

#### 11. codegen.ts — std::exit(1) (8 occurrences)

- `std::exit(1)` used instead of `return 1` in generated C++, preventing proper stack unwinding
- **Severity**: Low — generated code quality
- **Fix**: Replace `std::exit(1)` with `return 1` in all generated C++ functions that return `int` from `main()`. For lambdas (Func definitions), `std::exit(1)` may be intentional — needs careful analysis

#### 12. disk-cache.ts — Inefficient hash key (lines 30-43)

- `JSON.stringify({sourceCode, ...flags})` embeds source code verbatim in JSON, then hashes the whole string
- Not "double SHA-256" as claimed — it's single-hashed, but JSON.stringify processes the source text unnecessarily
- **Severity**: Low — performance only
- **Fix**: Use `crypto.createHash('sha256').update(sourceCode).update(JSON.stringify(flags)).digest('hex')` to hash incrementally without JSON wrapping the source

#### 13. plugin-manager.ts — loadWasmPlugins no-op loop (lines 42-48)

- `loadPlugins(configs)` call at line 43 does the actual work (calls `registerWasmPlugin` internally)
- The for loop at lines 44-47 is dead code
- **Severity**: Low — dead code, no actual bug
- **Fix**: Remove the no-op loop

#### 14. watch-utils.ts — Unsanitized watch path (line 98)

- `path.join(dir, normalizedName)` where `normalizedName` comes from `fs.watch` callback
- If `filename` is an absolute path (e.g., `/etc/passwd`), `path.normalize()` preserves it and `path.join()` returns the absolute path, ignoring `dir`
- **Severity**: Medium — path traversal via malformed watch event
- **Fix**: Validate that the resolved path is a sub-path of `dir` using `path.relative()`

### Missing Tests Analysis

| Module                      | Approach                       | Key Edge Cases                                                                                                                       | Dependencies                                          |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `downloader.ts`             | Unit + Integration (mock HTTP) | Timeout, redirect max, resume with hash mismatch, server returns wrong content-length, network error recovery                        | `node:https`, `node:http` (mock with nock or vi.mock) |
| `extract.ts`                | Unit with fixtures             | Zip bomb LZMA reject, symlink in tar, path traversal in ZIP, empty archive, corrupted tar.xz                                         | `lzma-native`, `tar` (real fixtures)                  |
| `compiler.ts` (linker)      | Unit (mock execFile)           | Empty target, special chars in target, cmake failure, chmod failure, no binary produced                                              | `cmake-js` (vi.mock), temp dirs                       |
| `setup.ts`                  | Unit (mock download/file)      | Custom path with header, custom path without header, cache miss, download failure, extraction failure                                | `downloader.ts`, `extract.ts` mocks                   |
| `codegen.ts`                | Unit (expand existing)         | Host function generation with edge case params, sanitize identifiers with special chars, escape C++ strings, multi-module edge cases | Types only                                            |
| `plugin-loader.ts`          | Unit (mock imports)            | Disabled plugin, plugin outside project dir, plugin without register(), non-existent module                                          | `pipeline.ts`, `host-function-registry.ts`            |
| `plugin-manager.ts`         | Unit                           | loadWasmPlugins with config, empty config, register/get lifecycle, duplicate plugin IDs                                              | Minimal                                               |
| `host-function-registry.ts` | Unit (expand existing)         | getByName with dot in name, duplicate register, empty register, unicode keys                                                         | None                                                  |
| `native-app-builder.ts`     | Unit                           | No modules added, no output path, cache up-to-date, cache miss, wasmtime path resolution, build with WASI                            | `wasm-io.ts` (mock parse), `build-cache.ts`           |
| `build-pipeline.ts`         | Integration                    | Pipeline run, default pipeline creation, stage failure, empty input, context propagation                                             | All stages (use real implementations or mocks)        |

### Approaches

1. **Single monolithic change**
   - All 13 fixes + all 10 test files in one PR
   - Pros: One review cycle, holistic view
   - Cons: **Massive diff (~800-1200+ lines)** — exceeds 400-line budget by 2-3×
   - Effort: High

2. **3 chained PRs (recommended)**
   - **PR #1**: Security fixes (issues 1-9, no tests)
   - **PR #2**: Code quality fixes (issues 10-14, no tests)
   - **PR #3**: Missing tests for all affected modules
   - Pros: Each PR under 400 lines, focused review, separable concerns
   - Cons: Coordination across chains
   - Effort: Medium

3. **4 chained PRs (alternate)**
   - **PR #1**: Input validation (wasm-io, wasm-leb128, extract, downloader) — ~80 lines
   - **PR #2**: Code quality (compiler chmod, codegen exit, disk-cache hash, plugin-manager no-op, watch-utils path) — ~80 lines
   - **PR #3**: Remaining security (downloader resume, tar symlinks, HTTP timeout) — ~50 lines
   - **PR #4**: Missing tests — ~500+ lines
   - Pros: Even smaller diffs
   - Cons: More PR churn
   - Effort: Medium

4. **Security-only, then deferred tests**
   - Fix security issues only, create a separate follow-up change for tests
   - Pros: Fast security fix
   - Cons: Tests left undone, no verification that fixes work
   - Effort: Low

### Recommendation

**Approach 2 (3 chained PRs)** is the recommended approach:

- **PR #1 — Security fixes** (issues 1-9, ~100-150 lines changed):
  - wasm-io.ts bounds checks
  - extract.ts LZMA memlimit + tar symlink protection
  - downloader.ts HTTP timeout + redirect validation
  - compiler.ts (linker) --target validation
  - downloader.ts resume corruption fix (better fallback logic)
  - This is the most important deliverable

- **PR #2 — Code quality** (issues 10-14, ~80-120 lines changed):
  - codegen.ts replace std::exit(1) with return 1
  - disk-cache.ts hash key efficiency
  - plugin-manager.ts remove dead loop
  - watch-utils.ts path sanitization
  - compiler.ts (linker) chmod error logging
  - watch-utils.ts Linux subdir documentation

- **PR #3 — Missing tests** (~500-800 lines added):
  - Tests for modules fixed in PR #1 (verify fixes)
  - Tests for remaining untested modules
  - Expand existing test coverage (codegen, host-function-registry)

### Risks

- **PR #1 (Security fixes)**: Bounds checking could break on valid-but-edge-case WASM modules we haven't tested yet. Need to ensure test fixtures cover real-world WASM layouts.
- **PR #1 (downloader resume)**: Changing resume logic could break Wasmtime downloads. Must test with real download scenarios.
- **PR #2 (codegen exit)**: Some `std::exit(1)` calls are inside lambdas where `return 1` is not valid (non-returning function). Must carefully distinguish `main()` contexts from lambda contexts.
- **PR #2 (disk-cache hash)**: Changing hash computation invalidates all existing cache entries. Users will experience a cold cache. This is acceptable and worth documenting.
- **PR #3 (Tests)**: Tests for `extract.ts` need real archive fixtures committed to the repo, increasing repo size. Use small minimal fixtures.

### Ready for Proposal

Yes. All 13 issues have been confirmed from source code analysis, the LEB128 limit already has partial mitigation. The missing tests landscape is fully mapped. Proceed to `sdd-propose` with the recommendation for 3 chained PRs.
