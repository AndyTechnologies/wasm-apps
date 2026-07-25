## Design: UX Improvements

### Technical Approach

Thread a `--verbose` boolean (default `false`) from the CLI entry point down through the entire build pipeline. The existing `createNativeApp` already has a `quiet` parameter — we invert the verbose flag (`!verbose`) and pass it as `quiet`. For `compileCpp`, we add a new `verbose` parameter that controls cmake-js output piping and log level. Non-essential noise (chmod warnings, tree-shake stats) is demoted to `logger.detail`.

### Data Flow (--verbose)

```
CLI (cli.ts)
  │  --verbose flag (boolean, default false)
  │
  ├─ BuildCommand.execute(args)
  │     args.verbose ──────────────────────────────────────┐
  │                                                         │
  ├─ DevCommand.execute(args)                               │
  │     args.verbose ───────────────────────────────────────┤
  │                                                         │
  ▼                                                         │
buildProject({ ..., verbose })  ◄───────────────────────────┘
  │
  │  buildProject({ ..., verbose })
  │     │
  │     ├─ compileProjectFiles()           (no change needed here)
  │     │
  │     └─ linkNativeApp(wasmFiles, ..., verbose)
  │            │
  │            └─ createNativeApp(options, quiet = !verbose)
  │                   │
  │                   ├─ isBuildUpToDate() — conditionally skipped
  │                   │   when quiet (already implemented)
  │                   │
  │                   ├─ module detail logs — hidden when quiet
  │                   │   (already implemented)
  │                   │
  │                   ├─ "Resolving dependencies" / "Generating C++"
  │                   │   — hidden when quiet (already implemented)
  │                   │
  │                   └─ compileCpp(cpp, outputPath, options, verbose)
  │                          │
  │                          ├─ cmake-js stdout/stderr piping
  │                          │   ONLY when verbose=true
  │                          │
  │                          ├─ --log-level error (default)
  │                          │   --log-level info  (verbose)
  │                          │
  │                          ├─ logger.detail("Compilando enlace...")
  │                          │   (shown always, it's detail level)
  │                          │
  │                          └─ chmod warning → logger.detail
  │                             (was logger.warn)
```

### File Changes

| File                                         | Action | Description                                                                                                                                          |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/cli/src/cli.ts`                    | Modify | Add `--verbose` option to `build` and `dev` commands; update program description to mention AS/C++/Rust                                              |
| `packages/cli/src/commands/build-command.ts` | Modify | Thread `args.verbose` through `buildProject()` call                                                                                                  |
| `packages/cli/src/commands/dev-command.ts`   | Modify | Thread `args.verbose` through `devCommand()` call                                                                                                    |
| `packages/cli/src/index.ts`                  | Modify | Add `verbose?: boolean` to `buildProject()` options; add `verbose?: boolean` to `devCommand()` options; pass through `linkNativeApp()`               |
| `packages/linker/src/index.ts`               | Modify | Add `verbose` param to `linkNativeApp()` signature; pass `!verbose` as `quiet` to `createNativeApp()`; add `verbose` param to `compileCpp()` call    |
| `packages/linker/src/compiler.ts`            | Modify | Add `verbose` param to `compileCpp()`; conditionally pipe stdout/stderr; add `--log-level` to cmake-js args; demote chmod warning to `logger.detail` |
| `packages/compiler/src/toolchain-router.ts`  | Modify | Translate "Overwriting existing strategy" warn message to Spanish                                                                                    |
| `packages/linker/src/tree-shake-plugin.ts`   | Modify | Change `ctx.logger.info` → `ctx.logger.detail` for tree-shake size output                                                                            |

### Interfaces

```typescript
// packages/cli/src/cli.ts
.option('--verbose', 'Muestra informacion detallada de compilacion')

program.description('Compila (.wasm.ts, .wasm.cpp, .wasm.rs) y linkea ejecutables nativos')

// packages/cli/src/index.ts — buildProject
export async function buildProject(options: {
  rootDir: string;
  output?: string;
  target?: string;
  entry?: string;
  moduleMatching?: ModuleMatchingStrategy;
  wasi?: boolean;
  release?: boolean;
  optimizeLevel?: number;
  shrinkLevel?: number;
  sourceDir?: string;
  outDir?: string;
  verbose?: boolean;             // ← ADD
}): Promise<void>

// packages/cli/src/index.ts — devCommand
export async function devCommand(options: {
  rootDir: string;
  output?: string;
  target?: string;
  entry?: string;
  wasi?: boolean;
  release?: boolean;
  sourceDir?: string;
  outDir?: string;
  verbose?: boolean;             // ← ADD
}): Promise<void>

// packages/cli/src/index.ts — linkNativeApp (internal, not exported)
async function linkNativeApp(..., verbose = false): Promise<void>  // ← ADD verbose param

// packages/linker/src/compiler.ts — compileCpp
export async function compileCpp(
  cppSource: string,
  outputPath: string,
  options: NativeAppOptions,
  verbose = false,               // ← ADD
): Promise<void>
```

Note: `createNativeApp(options, quiet = false)` already exists — no signature change needed, just pass `!verbose` as `quiet`.

### Non-functional changes

| Location                                       | Change                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/compiler/src/toolchain-router.ts:25` | `"Overwriting existing strategy"` → `"Sobrescribiendo estrategia existente"` |
| `packages/linker/src/tree-shake-plugin.ts:27`  | `ctx.logger.info(...)` → `ctx.logger.detail(...)`                            |
| `packages/linker/src/compiler.ts:78`           | `logger.warn(...)` → `logger.detail(...)`                                    |

### Testing Strategy

- **Manual verification**: Run `wapp build` on a C++ project without `--verbose` → no cmake-js output, just "Built:" line. Run `wapp build --verbose` → full cmake-js output visible.
- **Existing tests**: All tests pass with `pnpm -r build && pnpm test:unit` — the `verbose` default is `false`, so existing behavior for non-verbose paths is preserved exactly.
- **Tree-shake**: Verify `logger.detail` output only appears with `--verbose` (detail is already the project's convention for non-critical info).
- **Edge cases**: CMake error messages should still surface even without `--verbose` (stderr is captured in the error callback even when not piped).
