# bindings-auto-injection Specification

## Purpose

Vendored `wasm_apps_bindings` crate + Cargo.toml path-dep injection (temp + existing) + talc v5 allocator via `wasm_setup!()`. Rust projects stop copying bindings.

## Requirements

### Requirement: REQ-1 — Vendored Bindings Crate

The compiler **MUST** ship a vendored crate at `packages/compiler/src/bindings/rust/` named `wasm_apps_bindings`. `src/lib.rs` **MUST** declare `#![no_std]` and expose `pub mod wasi; pub mod console; pub mod fs; pub mod alloc;` plus `pub use alloc::wasm_setup;`. The crate **MUST** contain `wasi.rs`, `console.rs`, `fs.rs` with internal `use crate::wasi` refs resolving against the crate root.

#### Scenario: Crate layout present

- GIVEN the repository tree
- THEN `Cargo.toml` and `src/{lib,alloc,wasi,console,fs}.rs` exist under `bindings/rust`

#### Scenario: no_std re-exports compile

- GIVEN the crate source compiled for wasm32-unknown-unknown
- THEN all four modules and `wasm_setup` are available from the crate root

### Requirement: REQ-2 — Path-Dep Injection into Temp Cargo.toml

`generateTempCargoToml` in `rust-strategy.ts` **MUST** append `wasm_apps_bindings = { path = "<abs path to bindings/rust>" }` under its `[dependencies]` section. The path **MUST** be absolute.

#### Scenario: Temp manifest carries binding dep

- GIVEN a `.wasm.rs` source with no Cargo.toml, WHEN `generateTempCargoToml` runs
- THEN output has `[dependencies]` followed by `wasm_apps_bindings = { path = ... }` pointing at `bindings/rust`

### Requirement: REQ-3 — Path-Dep Injection into Existing Cargo.toml

When Cargo.toml already exists, the strategy **MUST** append the same line under the existing `[dependencies]`, creating the section if absent. Other content (features, comments, deps) **MUST** stay unchanged. Injection **MUST** be string-based (no TOML parser dependency). On win32, backslashes in the path value **MUST** be escaped as `\\`; other platforms need no escaping.

#### Scenario: Existing `[dependencies]` preserved

- GIVEN a Cargo.toml with `[dependencies]` containing other deps
- WHEN the strategy compiles the source
- THEN the binding line is appended last; prior content byte-identical

#### Scenario: Missing `[dependencies]` created

- GIVEN a Cargo.toml with no `[dependencies]` section
- WHEN the strategy compiles the source
- THEN a `[dependencies]` section with the binding line is appended at the end

#### Scenario: win32 path shape

- GIVEN a bindings path like `C:\apps\wasm-apps\...\bindings\rust` on win32
- WHEN the dependency line is injected
- THEN the TOML value contains `C:\\apps\\wasm-apps\\...`

### Requirement: REQ-4 — talc v5 Allocator via `wasm_setup!()`

The crate **MUST** depend on `talc = "5"`. `src/alloc.rs` **MUST** define `#[macro_export] macro_rules! wasm_setup` emitting a `#[global_allocator]` static of `$crate::_talc_reexport::WasmDynamicTalc` via `new_wasm_dynamic_allocator()`, plus a `#[panic_handler]` fn. The static **MUST** be cfg-gated on `all(not(target_feature = "atomics"), target_family = "wasm")`. A `#[doc(hidden)] pub mod _talc_reexport` **MUST** re-export those talc items.

#### Scenario: Allocator compiles on wasm

- GIVEN `wasm_setup!()` in a crate targeting wasm32 without atomics
- WHEN the crate builds
- THEN the talc global allocator and panic handler compile and link

#### Scenario: Non-wasm target unaffected

- GIVEN a host build of a crate invoking `wasm_setup!()`
- THEN the allocator static is cfg'd out; build succeeds

### Requirement: REQ-5 — Examples Consume Auto-Bindings

Rust examples **MUST** import bindings from `wasm_apps_bindings`; local copies **MUST** be deleted: rust-fs (`console.rs`, `wasi.rs`, `fs.rs`), rust-hello (`console.rs`, `wasi.rs`), as-fs (`console.ts`, `fs.ts`), cpp-saludo (`console.h`, `wasi.h`), mounts-demo (`console.h`, `fs.h`, `wasi.h`). rust-fs **MUST** invoke `wasm_setup!()` (its `Vec` usage needs an allocator); rust-hello **MUST NOT** require it.

#### Scenario: rust-fs builds with talc

- GIVEN rust-fs with local copies deleted and `wasm_setup!()` invoked, WHEN built and run
- THEN it compiles, links, and runs using the talc allocator

#### Scenario: Bindings available without copies

- GIVEN the five examples with local copies deleted, WHEN each is built and run
- THEN all behave as before deletion

### Requirement: REQ-6 — Injection Unit Tests

`rust-strategy.test.ts` **MUST** add unit tests for: temp Cargo.toml injection, existing Cargo.toml injection with and without `[dependencies]`, and win32 path escaping. Tests **MUST** assert injected line content and preservation of other manifest content.

#### Scenario: Test suite covers both injection paths

- GIVEN the updated test file, WHEN the unit suite runs
- THEN all injection and escaping cases pass

---

# End of Specs
