# Tasks: UX Improvements for wasm-apps CLI

## Review Workload Forecast

| Field                   | Value     |
| ----------------------- | --------- |
| Estimated changed lines | ~100      |
| 400-line budget risk    | Low       |
| Chained PRs recommended | No        |
| Suggested split         | Single PR |
| Delivery strategy       | single-pr |
| Chain strategy          | pending   |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                     | Likely PR | Focused test command              | Runtime harness                     | Rollback boundary                              |
| ---- | ------------------------ | --------- | --------------------------------- | ----------------------------------- | ---------------------------------------------- |
| 1    | All changes in single PR | PR 1      | `pnpm -r build && pnpm test:unit` | Manual: `wapp build` on C++ project | All 6 files via `git checkout HEAD -- <files>` |

## Phase 1: CLI --verbose Flag

- [x] 1.1 Add `--verbose` option to `wapp build` command in `packages/cli/src/cli.ts` (commander `.option('--verbose', 'Muestra informacion detallada de compilacion')`)
- [x] 1.2 Add `--verbose` option to `wapp dev` command in `packages/cli/src/cli.ts` (commander `.option`)
- [x] 1.3 Thread `args.verbose` through `buildProject()` call in `packages/cli/src/commands/build-command.ts`
- [x] 1.4 Thread `args.verbose` through `devCommand()` call in `packages/cli/src/commands/dev-command.ts`
- [x] 1.5 Add `verbose?: boolean` to `buildProject()` options type in `packages/cli/src/index.ts`; pass through `linkNativeApp()`
- [x] 1.6 Add `verbose?: boolean` to `devCommand()` options type in `packages/cli/src/index.ts`; pass through to `linkNativeApp()`
- [x] 1.7 Add `verbose` param to `linkNativeApp()` signature in `packages/cli/src/index.ts`; pass `!verbose` as `quiet` to `createNativeApp()`; pass `verbose` to `compileCpp()`

## Phase 2: cmake-js Suppression + Progress

- [x] 2.1 Add `verbose` param to `compileCpp()` signature in `packages/linker/src/compiler.ts` (default `false`)
- [x] 2.2 Conditionally pipe `child.stdout/stderr` only when `verbose=true` in `compileCpp()`
- [x] 2.3 Add `--log-level error` (default) or `--log-level info` (verbose) to cmake-js args
- [x] 2.4 Add `logger.detail("Compilando enlace nativo...")` before cmake call in `compileCpp()`
- [x] 2.5 Downgrade chmod warning from `logger.warn` to `logger.detail` in `packages/linker/src/compiler.ts`

## Phase 3: CLI Descriptions Update

- [x] 3.1 Update main `wapp --help` description in `packages/cli/src/cli.ts` to `"Compila y linkea proyectos multi-lenguaje (AssemblyScript, C++, Rust) en ejecutables nativos"`
- [x] 3.2 Update `wapp build --help` description to mention `.wasm.ts`, `.wasm.cpp`, `.wasm.rs` extensions

## Phase 4: Minor UX Fixes

- [x] 4.1 Change `ctx.logger.info` → `ctx.logger.detail` for tree-shake size output in `packages/linker/src/tree-shake-plugin.ts`
- [x] 4.2 Translate `"Overwriting existing strategy \"{id}\""` → `"Sobrescribiendo estrategia existente \"{id}\""` in `packages/compiler/src/toolchain-router.ts`

## Phase 5: Verify

- [x] 5.1 `pnpm -r build` passes
- [x] 5.2 `pnpm vitest run` passes (unit tests)
- [x] 5.3 `pnpm test:integration` passes (examples)
- [ ] 5.4 Manual: `wapp build` without `--verbose` shows no cmake-js INFO RUN lines
- [ ] 5.5 Manual: `wapp build --verbose` shows cmake-js output
- [ ] 5.6 Manual: `wapp build --help` mentions AS/C++/Rust support
- [ ] 5.7 Manual: `wapp --help` mentions multi-lenguaje

### Testing Strategy

- **Unit tests**: All existing tests must pass (`pnpm vitest run`) — verbose defaults to `false`, so existing paths unchanged.
- **Integration tests**: `pnpm test:integration` must pass — examples compile and link correctly.
- **Manual verification**: Run `wapp build` on a C++ project with/without `--verbose` to confirm suppression and progress feedback.
- **RED tests**: None needed — this is a UX polish change with no new behaviors requiring test-first development.
