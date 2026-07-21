# Tasks: Security Fixes and Tests

## Review Workload Forecast

| Field                   | Value                                             |
| ----------------------- | ------------------------------------------------- |
| Estimated changed lines | ~890 (140 + 100 + 650)                            |
| 400-line budget risk    | Medium                                            |
| Chained PRs recommended | Yes                                               |
| Suggested split         | PR #1 Security → PR #2 Code Quality → PR #3 Tests |
| Delivery strategy       | auto-chain                                        |
| Chain strategy          | feature-branch-chain                              |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal                                                  | Likely PR | Focused test command                                                           | Runtime harness      | Rollback boundary                     |
| ---- | ----------------------------------------------------- | --------- | ------------------------------------------------------------------------------ | -------------------- | ------------------------------------- |
| 1    | Security hardening of input boundaries                | PR #1     | `cd packages/linker && npx tsc --noEmit`                                       | `pnpm -r build`      | Revert PR #1 commit on feature branch |
| 2    | Code-quality fixes (codegen, cache, plugins, watcher) | PR #2     | `cd packages/linker && npx tsc --noEmit && cd ../compiler && npx tsc --noEmit` | `pnpm -r build`      | Revert PR #2 commit on feature branch |
| 3    | New test suites for 10 untested modules               | PR #3     | `vitest run packages/linker/src/__tests__/downloader.test.ts` (per file)       | `pnpm run test:unit` | Revert PR #3 commit on feature branch |

## Phase 1: Security Fixes (PR #1)

- [x] 1.1 Add bounds checks before every `buffer[pos]` read in `wasm-io.ts` section parsing — throw `LinkerError` on OOB
- [x] 1.2 Set LZMA `memlimit` + add tar `filter` rejecting symlinks + absolute paths in `extract.ts`
- [x] 1.3 Add `timeout: 30000` + `maxRedirects: 5` + base-domain redirect validation in `downloader.ts`
- [x] 1.4 Add resume integrity check: verify `startByte < serverSize` before appending in `downloader.ts`
- [x] 1.5 Validate `options.target` with `^[a-zA-Z0-9_-]+$` regex + log chmod error in `compiler.ts`

## Phase 2: Code Quality Fixes (PR #2)

- [x] 2.1 Change `define_exports` return type `void→int`, replace `std::exit(1)` with `return 1` in `codegen.ts`
- [x] 2.2 Hash `sourceCode` separately with SHA-256 in `disk-cache.ts computeKey()`, include hex in canonical JSON
- [x] 2.3 Remove dead `for` loop in `plugin-manager.ts loadWasmPlugins()`
- [x] 2.4 Add `path.normalize()` + reject paths containing `..` before `onChange` in `watch-utils.ts`

## Phase 3: Test Suites (PR #3)

- [x] 3.1 Extend `packages/linker/src/downloader.test.ts` — timeout, redirects, resume, hash mismatch (6 tests)
- [x] 3.2 Extend `packages/linker/src/extract.test.ts` — LZMA memlimit, tar symlink filter, path traversal (3 tests)
- [x] 3.3 Create `packages/linker/src/setup.test.ts` — download→extract→verify integration flow (6 tests)
- [x] 3.4 Extend `packages/linker/src/compiler.test.ts` — target validation, chmod logging, cmake-js failure (7 tests)
- [x] 3.5 Create `packages/linker/src/plugin-loader.test.ts` — built-in + external plugin loading (7 tests)
- [x] 3.6 Extend `packages/linker/src/plugin-manager.test.ts` — register/get lifecycle (16 tests)
- [x] 3.7 Create `packages/linker/src/native-app-builder.test.ts` — builder setters, validate, cache check (12 tests)
- [x] 3.8 Create `packages/linker/src/build-pipeline.test.ts` — stage lifecycle, error propagation (6 tests)
- [x] 3.9 Extend `packages/linker/src/watch-utils.test.ts` — path sanitization, debounce behavior (10 tests)
- [x] 3.10 Create `packages/compiler/src/disk-cache-update.test.ts` — hash key determinism after source-hash change (9 tests)
