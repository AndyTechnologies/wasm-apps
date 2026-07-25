# Proposal: UX Improvements for wasm-apps CLI

## Intent

Improve the CLI user experience by fixing noisy output, adding verbosity control, and polishing the most glaring UX issues. Users currently see verbose cmake-js output during normal builds, outdated Spanish-only CLI descriptions for a multi-toolchain tool, and no progress feedback during 10-30s C++ builds.

## Scope

### In Scope

- Add `--verbose` flag to `wapp build` command
- Suppress cmake-js stdout/stderr by default; pipe only when `--verbose`
- Update CLI descriptions to reflect multi-toolchain support (AS, C++, Rust)
- Standardize user-facing messages to Spanish
- Add progress feedback during cmake build (spinner or periodic dots)
- Suppress non-critical chmod warning noise
- Use `logger.detail` for tree-shake size output (less noisy)

### Out of Scope

- Standalone `compiler/cli.ts` refactor (separate change)
- Full i18n framework
- Interactive spinners / TUI
- WASM/WASI runtime UX

## Capabilities

### New Capabilities

- `cli-verbosity`: CLI verbosity flag (`--verbose`) plumbing through build pipeline to suppress/emit toolchain output

### Modified Capabilities

- `cli-build`: Build command behavior changes — adds `--verbose` flag, suppresses cmake-js noise by default, adds progress feedback
- `compiler-cpp`: `compileCpp` function signature changes to accept verbosity flag; suppress chmod warning noise; emit progress during cmake build

## Approach

1. Add `--verbose` flag to `wapp build` command in `packages/cli/src/commands/build.ts`
2. Thread `--verbose` through `buildProject()` → `linkNativeApp()` → `createNativeApp()` → `compileCpp()`
3. In `packages/linker/src/compiler.ts`, conditionally pipe `child.stdout/stderr` only when `verbose=true`; add periodic progress dots during cmake build
4. Update CLI help text in `packages/cli/src/index.ts` to mention AssemblyScript, C++, and Rust support
5. Replace English log messages in `packages/compiler/src/toolchain-router.ts` with Spanish
6. Change `logger.info` to `logger.detail` for tree-shake size output in `packages/compiler/src/tree-shake-plugin.ts`
7. Silence chmod warning in `compiler.ts` (only log on verbose)

## Affected Areas

| Area                                         | Impact   | Description                                                                 |
| -------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `packages/cli/src/commands/build.ts`         | Modified | Add `--verbose` flag definition                                             |
| `packages/cli/src/index.ts`                  | Modified | Update CLI description text (multi-toolchain)                               |
| `packages/linker/src/index.ts`               | Modified | Thread `verbose` through `linkNativeApp` → `createNativeApp` → `compileCpp` |
| `packages/linker/src/compiler.ts`            | Modified | Conditional cmake-js output piping; progress dots; suppress chmod warning   |
| `packages/compiler/src/toolchain-router.ts`  | Modified | Translate "Overwriting existing strategy" to Spanish                        |
| `packages/compiler/src/tree-shake-plugin.ts` | Modified | Change `logger.info` to `logger.detail` for size savings                    |

## Risks

| Risk                                                    | Likelihood | Mitigation                                                                                       |
| ------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| Verbose flag threading breaks existing callers          | Low        | Thread through with default `false`; all existing calls work unchanged                           |
| cmake build progress dots interfere with CI log parsing | Low        | Only emit when stdout is TTY; CI pipes to file → no TTY → no dots                                |
| Spanish messages break non-Spanish users                | Low        | Per project convention (AGENTS.md), user-facing messages are Spanish; internal logs stay English |

## Rollback Plan

Revert the 6 modified files via `git checkout HEAD -- <files>`. The `--verbose` flag addition is backward-compatible (default `false`).

## Dependencies

None — purely internal CLI/toolchain changes.

## Success Criteria

- [ ] `wapp build` runs silently (only "Built: <path>") for C++ projects without `--verbose`
- [ ] `wapp build --verbose` shows full cmake-js output
- [ ] `wapp build --help` mentions AssemblyScript, C++, and Rust support
- [ ] All user-facing log messages in Spanish
- [ ] Tree-shake size output only appears with `--verbose` (via `logger.detail`)
- [ ] No chmod warning noise in normal builds
- [ ] CI passes (`pnpm -r build && pnpm test:unit`)
