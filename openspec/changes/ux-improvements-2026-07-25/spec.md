# Delta Spec: ux-improvements-2026-07-25

## Change: ux-improvements-2026-07-25

### Specs Written

| Domain   | Type  | Requirements | Scenarios |
| -------- | ----- | ------------ | --------- |
| cli      | Delta | 3            | 4         |
| linker   | Delta | 2            | 4         |
| compiler | Delta | 2            | 3         |

---

# Domain: cli (DELTA)

## Purpose

Extend the `wapp build` and `wapp dev` commands with a `--verbose` flag to control output verbosity. Update CLI descriptions to reflect multi-toolchain support (AssemblyScript, C++, Rust).

## MODIFIED Requirements

### Requirement: Multi-Toolchain CLI Description

The `wapp build --help` output **MUST** describe that the tool supports AssemblyScript, C++, and Rust sources.

The current description `"Compila los archivos .wasm.ts y linkea el ejecutable nativo"` **MUST** change to something like `"Compila archivos .wasm.ts, .wasm.cpp, .wasm.rs a WebAssembly y linkea ejecutables nativos"`.

The main `wapp --help` description **MUST** change from `"Compila y linkea proyectos AssemblyScript en ejecutables nativos"` to `"Compila y linkea proyectos multi-lenguaje (AssemblyScript, C++, Rust) en ejecutables nativos"`.

#### Scenario: wapp --help shows multi-toolchain

- GIVEN a user runs `wapp --help`
- WHEN the help text is displayed
- THEN it **MUST** mention AssemblyScript, C++, and Rust support

#### Scenario: wapp build --help shows multi-toolchain

- GIVEN a user runs `wapp build --help`
- WHEN the help text is displayed
- THEN it **MUST** mention .wasm.ts, .wasm.cpp, .wasm.rs extensions

---

### Requirement: --verbose Flag on Build and Dev Commands

The `wapp build` and `wapp dev` commands **MUST** accept a `--verbose` flag.

When `--verbose` is **not** set (default), cmake-js output **MUST** be suppressed from the user's terminal.

When `--verbose` **is** set, the full cmake-js compilation log **MUST** be displayed.

The flag **MUST** default to `false`.

#### Scenario: Build without --verbose

- GIVEN a project with C++ sources
- WHEN `wapp build` runs (no --verbose)
- THEN cmake-js INFO RUN lines **MUST NOT** appear
- AND the final "Ejecutable creado:" message **MUST** still show

#### Scenario: Build with --verbose

- GIVEN a project with C++ sources
- WHEN `wapp build --verbose` runs
- THEN cmake-js INFO RUN lines **MUST** appear
- AND all cmake configure/build output **MUST** be visible

---

# Domain: linker (DELTA)

## Purpose

Suppress cmake-js output by default, add progress feedback during compilation, and reduce non-critical warning noise.

## MODIFIED Requirements

### Requirement: Conditional cmake-js Output

The `compileCpp` function **MUST** accept a `verbose` parameter.

When `verbose` is `false`, cmake-js stdout and stderr **MUST NOT** be piped to the terminal.

When `verbose` is `true`, cmake-js output **MUST** be piped to the terminal as before.

The cmake-js binary **SHOULD** be called with `--log-level error` when not verbose, and `--log-level info` when verbose.

#### Scenario: Default build suppresses cmake output

- GIVEN `compileCpp` called with `verbose: false`
- WHEN cmake-js executes
- THEN `child.stdout.pipe(process.stdout)` **MUST NOT** be called
- AND the cmake-js INFO RUN lines **MUST NOT** appear in terminal

#### Scenario: Verbose build shows cmake output

- GIVEN `compileCpp` called with `verbose: true`
- WHEN cmake-js executes
- THEN cmake-js INFO RUN lines **MUST** appear in terminal

---

### Requirement: Progress Feedback During cmake Build

The `compileCpp` function **MUST** show a progress indication while cmake-js is compiling.

The indication **MUST** be a `logger.detail` message like `"Compilando enlace nativo..."` shown before the cmake call.

The indication **MUST** not add noise to CI logs (CI piped output is unaffected by TTY).

#### Scenario: Progress shown during cmake

- GIVEN `compileCpp` called
- WHEN cmake-js starts building
- THEN `logger.detail` with "Compilando enlace nativo..." **MUST** be logged

---

### Requirement: chmod Warning Downgraded

The `logger.warn` for chmod failure in `compileCpp` **MUST** be changed to `logger.detail`.

A chmod failure after copying the binary is non-critical (the binary still exists and is usable).

#### Scenario: chmod failure in non-verbose mode

- GIVEN a build on a platform where chmod fails (e.g. certain permissions setups)
- WHEN the binary is built successfully
- THEN the chmod error **MUST NOT** appear as a warning
- AND the function **MUST** still return success

---

# Domain: compiler (DELTA)

## Purpose

Fix mixed-language messages and reduce tree-shake output noise.

## MODIFIED Requirements

### Requirement: Spanish User-Facing Messages

The `ToolchainRouter.register()` warning message **MUST** be in Spanish.

Current: `"Overwriting existing strategy \"{id}\""`
New: `"Sobrescribiendo estrategia existente \"{id}\""`

#### Scenario: Strategy overwrite shows Spanish message

- GIVEN a strategy with id 'asm' is registered
- WHEN a second strategy with the same id is registered
- THEN `logger.warn("Sobrescribiendo estrategia existente \"asm\"")` **MUST** be called

---

### Requirement: Tree-Shake Detail Level

The tree-shake plugin **MUST** use `logger.detail` instead of `logger.info` for size saving messages.

Current: `ctx.logger.info(...)`
New: `ctx.logger.detail(...)`

This ensures tree-shake size info only appears with `--verbose` (since `detail` messages are implementation-level).

#### Scenario: Tree-shake without verbose

- GIVEN a build with tree-shake active and `verbose: false`
- WHEN the build completes
- THEN tree-shake size savings **MUST NOT** appear in normal output

#### Scenario: Tree-shake with verbose

- GIVEN a build with tree-shake active and `verbose: true`
- WHEN the build completes
- THEN tree-shake size savings **MUST** appear (since detail is shown somewhere in verbose mode)

---

# End of Specs
