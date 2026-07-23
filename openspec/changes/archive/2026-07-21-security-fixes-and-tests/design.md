# Design: Security Fixes and Tests

## Technical Approach

Three chained PRs on a feature branch. PR#1: 9 security fixes at the input boundary (WASM parser, archive extractor, HTTP downloader, CMake subprocess). PR#2: 4 code-quality fixes at the output boundary (codegen, cache, plugin-manager, watcher). PR#3: vitest suites for 10 currently untested modules using vi.mock for HTTP/filesystem and real minimal fixtures.

All fixes are implementation-level — no capability changes, no new user-facing behavior.

## Architecture Decisions

| Decision                            | Options                                                      | Tradeoffs                                                                                | Chosen                                                                                       |
| ----------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| wasm-io bounds check error handling | throw LinkerError / return null / log+skip                   | throw propagates cleanly through caller chain; null would require null checks everywhere | **Throw `LinkerError`** — consistent with existing error pattern                             |
| codegen std::exit(1) fix            | return 1 / throw / exit                                      | `define_exports` is void; changing return type to `int` keeps call semantics explicit    | **Change to `int` return, `return 1` on error** — caller already patterns `if (!x) return 1` |
| HTTP redirect validation            | allow same-host / allow same-domain / allow same-origin      | Wasmtime downloads redirect on CDN — must allow CDN subdomains                           | **Base-domain match** (e.g., github.com → github.com or *.github.com)                        |
| Tar symlink protection              | filter symlinks / filter absolute paths / both               | `tar` library filter must reject symlinks AND entries with absolute paths                | **Both** — `filter: (path, entry) => entry.type !== 'SymbolicLink' && !path.isAbsolute()`    |
| Disk-cache hash key                 | stream-hash source / hash source separately / keep JSON blob | Separate hash avoids O(source length) string copy in JSON serialization                  | **Hash `sourceCode` first, include hex in canonical object**                                 |

## Data Flow

### PR#1 (Security)

```
[WASM binary] → wasm-io.ts: bounds-check every section/import/export read ─→ LinkerError on OOB
[Archive .xz] → extract.ts: LZMA memlimit + tar symlink filter → DownloadError on violation
[HTTP URL] → downloader.ts: timeout(30s) + maxRedirects(5) + base-domain check → DownloadError on redirect jump
  └─ Resume: verify startByte < serverSize before appending; delete+restart on mismatch
[CMake] → compiler.ts: validate --target against ^[a-zA-Z0-9_-]+$ + log chmod errors
```

### PR#2 (Code Quality)

```
codegen.ts: define_exports() return type void→int, std::exit→return 1
disk-cache.ts: computeKey() hashes source separately from flags
plugin-manager.ts: remove dead [id, plugin] iteration loop
watch-utils.ts: normalize+sanitize filename from fs.watch before onChange
```

### PR#3 (Tests)

```
vitest (vi.mock HTTP) → downloader, extract, setup
vitest (vi.mock fs) → compiler, codegen, native-app-builder, disk-cache
vitest (unit + fixtures) → plugin-loader, plugin-manager, host-function-registry, build-pipeline
```

## File Changes

### PR#1 — Security (~140 lines)

| File                                | Action | Description                                                                                                |
| ----------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| `packages/linker/src/wasm-io.ts`    | Modify | Add bounds checks before every `buffer[pos]` read in section parsing                                       |
| `packages/linker/src/extract.ts`    | Modify | Set `memlimit` on LZMA decompressor; add tar `filter` rejecting symlinks + absolute paths                  |
| `packages/linker/src/downloader.ts` | Modify | Add `timeout: 30000` to HTTP options; limit redirects to 5; validate redirect URL host against base domain |
| `packages/linker/src/compiler.ts`   | Modify | Validate `options.target` with regex `^[a-zA-Z0-9_-]+$`; log chmod error instead of empty `catch {}`       |

### PR#2 — Code Quality (~100 lines)

| File                                    | Action | Description                                                                                                  |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `packages/linker/src/codegen.ts`        | Modify | Change `define_exports` return type `void→int`, replace `std::exit(1)` with `return 1`, add caller check     |
| `packages/compiler/src/disk-cache.ts`   | Modify | Hash `sourceCode` separately with SHA-256 and include hex hex in canonical JSON instead of raw source string |
| `packages/linker/src/plugin-manager.ts` | Modify | Remove dead `for` loop in `loadWasmPlugins`                                                                  |
| `packages/linker/src/watch-utils.ts`    | Modify | Add `path.normalize()` + reject paths containing `..` before passing to `onChange`                           |

### PR#3 — Tests (~650 lines)

| File                                                           | Action | Description                                                               |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `packages/linker/src/__tests__/downloader.test.ts`             | Create | HTTP timeout, redirect limit, resume integrity, hash mismatch via vi.mock |
| `packages/linker/src/__tests__/extract.test.ts`                | Create | LZMA memlimit, tar symlink rejection, path traversal via fixtures         |
| `packages/linker/src/__tests__/setup.test.ts`                  | Create | Integration flow: download → extract → verify header                      |
| `packages/linker/src/__tests__/compiler.test.ts`               | Create | Target validation, chmod error logging, cmake-js failure via vi.mock      |
| `packages/linker/src/__tests__/codegen.test.ts`                | Create | Generator functions output format, exit→return check                      |
| `packages/linker/src/__tests__/plugin-loader.test.ts`          | Create | Built-in plugin loading, external path validation, register checks        |
| `packages/linker/src/__tests__/plugin-manager.test.ts`         | Create | Register/get/remove compiler/linker/codegen/wasm plugins                  |
| `packages/linker/src/__tests__/host-function-registry.test.ts` | Create | (already exists — skip; tests in PR#3 are additive)                       |
| `packages/linker/src/__tests__/native-app-builder.test.ts`     | Create | Builder pattern: setter chain, validate, cache check                      |
| `packages/linker/src/__tests__/build-pipeline.test.ts`         | Create | Stage orchestration: ParseModules → Resolve → GenerateCode → Compile      |

Wait — `host-function-registry.test.ts` already exists. The proposal says 10 modules need tests, but 4 already have tests (wasm-io, codegen, pipeline, host-function-registry). Of the remaining, these need new tests: downloader, extract, setup, compiler, plugin-loader, plugin-manager, native-app-builder, build-pipeline, and disk-cache (already has test but may need hash-key test), and watch-utils. That's 10.

Let me adjust to match the actual untested modules:

| File                                                        | Action | Description                                           |
| ----------------------------------------------------------- | ------ | ----------------------------------------------------- |
| `packages/linker/src/__tests__/downloader.test.ts`          | Create | Timeout, redirect limit, resume integrity via vi.mock |
| `packages/linker/src/__tests__/extract.test.ts`             | Create | LZMA memlimit, tar symlink filter, path traversal     |
| `packages/linker/src/__tests__/setup.test.ts`               | Create | Download → extract → verify integration               |
| `packages/linker/src/__tests__/compiler.test.ts`            | Create | Target validation, chmod logging, cmake failure       |
| `packages/linker/src/__tests__/plugin-loader.test.ts`       | Create | Built-in + custom plugin loading                      |
| `packages/linker/src/__tests__/plugin-manager.test.ts`      | Create | Full register/get/iterate API                         |
| `packages/linker/src/__tests__/native-app-builder.test.ts`  | Create | Builder setters, validate, cache up-to-date           |
| `packages/linker/src/__tests__/build-pipeline.test.ts`      | Create | Stage lifecycle, error propagation                    |
| `packages/linker/src/__tests__/watch-utils.test.ts`         | Create | Watch path sanitization, debounce, poll scan          |
| `packages/compiler/src/__tests__/disk-cache-update.test.ts` | Create | Hash key determinism after source-hash change         |

## Testing Strategy

| Layer       | What                                                         | Approach                               |
| ----------- | ------------------------------------------------------------ | -------------------------------------- |
| Unit        | downloader, extract, compiler, plugin-loader, plugin-manager | vi.mock for HTTP, fs; pure logic tests |
| Unit        | codegen, wasm-io, disk-cache                                 | Pure function tests with fixtures      |
| Integration | setup, native-app-builder, build-pipeline                    | Real archive fixtures + vi.mock HTTP   |
| Edge        | OOB padding, LZMA bomb, tar symlink, redirect loop           | Crafted malicious fixtures             |

## Threat Matrix

N/A — the matrix rows (documentation-like paths, git repository/commit/push/PR commands) target VCS routing and executable-file classification boundaries. This design's process integration touches only `execFile` for cmake-js (already scoped to a resolved npm binary path) and HTTP downloads (no shell routing). The `--target` validation regex prevents argument injection; the redirect domain check prevents SSRF-to-different-origin. No threat-matrix row is applicable; the existing `execFile` with fixed binary path + validated argument is sufficient defense.

## Migration / Rollout

- **Cache invalidation**: the disk-cache hash key change (PR#2) will cause a one-time cache miss for all entries. Acceptable — logged as known risk in proposal.
- **No data migration**: all fixes are in-memory code changes.
- **Feature flags**: none — all fixes activate immediately.
- **Rollback**: `git revert` per PR on the feature branch; all 3 are independent.

## Open Questions

- None blocking.
