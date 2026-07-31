# Proposal: Automatic binding injection + talc allocator

## Intent

WASM-side bindings (console, wasi, fs) live in `packages/compiler/src/bindings/`. Projects must manually copy them into their `src/`, which is error-prone and drift-prone. Make bindings auto-available per toolchain: C++ via `-I` include path and AssemblyScript via `--path` are already shipped; Rust gets a vendored `wasm_apps_bindings` crate injected as a path dependency, plus a talc v5 allocator with a `wasm_setup!()` convenience macro.

## Scope

### In Scope

- New vendored crate `packages/compiler/src/bindings/rust/`: `Cargo.toml` (name `wasm_apps_bindings`), `src/lib.rs` (re-exports), `src/alloc.rs` (talc v5 + `wasm_setup!()`), copied `wasi.rs`, `console.rs`, `fs.rs`
- `rust-strategy.ts` Cargo.toml injection: both no-Cargo.toml (temp) and existing-Cargo.toml cases; string-based manipulation (no TOML parser dep); Windows backslash escaping in path values
- `wasm_setup!()` macro: `#[global_allocator]` via `talc::wasm::WasmDynamicTalc` + `new_wasm_dynamic_allocator()`, `#[panic_handler]`; cfg-gated `all(not(target_feature = "atomics"), target_family = "wasm")`
- Examples updated to consume auto-bindings; local copies deleted (console.h, wasi.h, console.ts, fs.ts, console.rs, wasi.rs, fs.rs) from cpp-saludo, mounts-demo, as-fs, rust-hello, rust-fs
- Unit tests in `rust-strategy.test.ts` covering both injection cases

### Out of Scope

- C++/AS injection rework (already shipped)
- TOML parser dependency
- Non-wasm allocator targets or atomics support
- Bindings for other runtimes (e.g., JS host)

## Capabilities

### New Capabilities

- `bindings-auto-injection`: auto-availability of toolchain bindings — vendored Rust crate layout, Cargo.toml path-dep injection (temp + existing), talc v5 `wasm_setup!()` allocator/panic macro

### Modified Capabilities

- None

## Approach

1. Vendor crate: copy existing `wasi.rs`/`console.rs`/`fs.rs` into `bindings/rust/src/`; `lib.rs` re-exports modules (existing `crate::wasi` internal refs resolve unchanged — crate root is the bindings crate); `alloc.rs` defines `wasm_setup!()` exporting the talc allocator.
2. Injection: `generateTempCargoToml` and the existing-Cargo.toml path both append `wasm_apps_bindings = { path = "<abs path to bindings/rust>" }` under `[dependencies]`; create section if missing; escape `\` on win32.
3. Example cleanup: point sources at the crate, delete local binding copies.
4. Tests: unit tests for both Cargo.toml paths + path escaping.

## Affected Areas

| Area                                                              | Impact   | Description                                                               |
| ----------------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| `packages/compiler/src/bindings/rust/`                            | New      | Vendored crate (Cargo.toml, lib.rs, alloc.rs, wasi.rs, console.rs, fs.rs) |
| `packages/compiler/src/strategies/rust-strategy.ts`               | Modified | Cargo.toml injection (temp + existing)                                    |
| `packages/compiler/src/strategies/rust-strategy.test.ts`          | Modified | Injection tests                                                           |
| `examples/{rust-hello,rust-fs,cpp-saludo,as-fs,mounts-demo}/src/` | Modified | Consume auto-bindings; delete local copies                                |

## Risks

| Risk                                                                   | Likelihood | Mitigation                                                                  |
| ---------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| String manipulation corrupts user Cargo.toml (feature flags, comments) | Med        | Append-only under `[dependencies]`; unit tests with real-ish fixtures       |
| talc v5 API drift from exploration                                     | Low        | Pin `talc = "5"`; verify against vendored source at apply time              |
| rust-fs alloc failure without `wasm_setup!()` (Vec needs allocator)    | Med        | Macro required for alloc-using crates; documented in example; test coverage |
| Windows path backslashes break TOML                                    | Low        | Escape `\`; test covers win32 path shapes                                   |

## Rollback Plan

- Revert `rust-strategy.ts` injection change; delete `bindings/rust/`; restore example local copies from git. Bindings remain available via manual copy as today.

## Dependencies

- talc v5 (fetched from crates.io during example builds)
- rustup target `wasm32-unknown-unknown` (existing prerequisite)

## Success Criteria

- [ ] All examples build and run with zero local binding copies
- [ ] rust-fs runs with talc allocator via `wasm_setup!()`
- [ ] `pnpm -r build` + unit tests pass; injection tests cover temp and existing Cargo.toml
