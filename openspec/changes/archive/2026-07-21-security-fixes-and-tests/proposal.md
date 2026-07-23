# Proposal: Security Fixes and Tests

## Intent

Systematic security hardening and test coverage for wasm-apps. 13 confirmed issues across the linker and compiler packages must be fixed, and 10 modules lacking adequate tests must be covered to prevent regression. Fixes are split into security/correctness and code-quality batches to keep PRs reviewable.

## Scope

### In Scope

- **PR #1 — Security fixes**: 9 issues (OOB reads in wasm-io, LZMA memlimit in extract, tar symlink protection, HTTP timeout, redirect validation, resume corruption, --target validation, silent chmod catch)
- **PR #2 — Code quality fixes**: 4 issues (std::exit(1) in codegen, inefficient hash key in disk-cache, dead loop in plugin-manager, unsanitized watch path)
- **PR #3 — Missing tests**: Full test suites for 10 modules (downloader, extract, compiler, setup, codegen, plugin-loader, plugin-manager, host-function-registry, native-app-builder, build-pipeline)

### Out of Scope

- New features or user-facing capabilities
- Refactoring beyond the identified fixes
- Cross-compilation target additions
- LEB128 loop limit (already mitigated in wasm-leb128.ts)
- Linux subdir polling performance (documented limitation)

## Capabilities

> No spec-level behavior changes — all fixes are implementation-level hardening. No existing specs are modified, and no new capabilities are introduced.

### New Capabilities

None

### Modified Capabilities

None

## Approach

**3 chained PRs** targeting a feature branch:

1. **PR #1 (~100-150 lines)**: Bounds checks in wasm-io, LZMA memlimit + tar filter in extract, HTTP timeout + redirect validation in downloader, resume integrity fix, --target validation + chmod warning in compiler.
2. **PR #2 (~80-120 lines)**: Replace std::exit(1) with return 1 in codegen (main() context only), incremental hash in disk-cache, remove dead loop in plugin-manager, sanitize watch path.
3. **PR #3 (~500-800 lines)**: Comprehensive vitest suites for all 10 untested modules using vi.mock for HTTP/filesystem and real fixtures for archives.

## Affected Areas

| Area                                    | Impact   | Description                          |
| --------------------------------------- | -------- | ------------------------------------ |
| `packages/linker/src/wasm-io.ts`        | Modified | Add bounds checks on section parsing |
| `packages/linker/src/extract.ts`        | Modified | LZMA memlimit + tar symlink filter   |
| `packages/linker/src/downloader.ts`     | Modified | Timeout, redirect limit, resume fix  |
| `packages/linker/src/compiler.ts`       | Modified | Target validation + chmod error log  |
| `packages/linker/src/codegen.ts`        | Modified | std::exit → return in main context   |
| `packages/linker/src/plugin-manager.ts` | Modified | Remove dead loop                     |
| `packages/linker/src/watch-utils.ts`    | Modified | Sanitize fs.watch path               |
| `packages/compiler/src/disk-cache.ts`   | Modified | Incremental hash key                 |
| `packages/linker/src/__tests__/`        | New      | 10 test files                        |

## Risks

| Risk                                          | Likelihood | Mitigation                         |
| --------------------------------------------- | ---------- | ---------------------------------- |
| Bounds checks break valid edge-case WASM      | Low        | Test with real-world WASM fixtures |
| Resume change breaks Wasmtime downloads       | Low        | Manual download test after fix     |
| std::exit(1) in lambda contexts misidentified | Medium     | Careful code review per occurrence |
| Hash change invalidates compiler cache        | High       | Acceptable — documented cache miss |
| Test fixtures increase repo size              | Low        | Use minimal archives (< 1KB each)  |

## Rollback Plan

Each PR is independently revertable. A bad security fix reverts via git revert on the feature branch without affecting code quality or test PRs. If all 3 merged, full revert of the feature branch to `dev`.

## Dependencies

- vitest (already configured in project)
- nock or vi.mock for HTTP mocking in downloader tests
- Minimal archive fixtures (.tar.xz, .wasm) committed to repo

## Success Criteria

- [ ] All 13 issues resolved (verified by code review)
- [ ] All 10 modules have passing test suites
- [ ] PR diffs within 400-line review budget each
- [ ] `pnpm -r build` passes
- [ ] `pnpm run test` (build + run binary) passes
- [ ] No regressions in existing test suites
