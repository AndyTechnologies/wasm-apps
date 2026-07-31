# Design: Bindings Auto-Injection + talc Allocator

## Technical Approach

Vendor `packages/compiler/src/bindings/rust/` as a no_std crate `wasm_apps_bindings` (talc v5). `rust-strategy.ts` injects `wasm_apps_bindings = { path = "<abs>" }` into Cargo.toml — temp template (REQ-2) or existing manifest (REQ-3) — via string manipulation, then restores user files byte-for-byte after build. `wasm_setup!()` macro (REQ-4) installs the talc `#[global_allocator]` + `#[panic_handler]`. **Every Rust consumer MUST invoke `wasm_setup!()`** — validated empirically: dependency rlib object code (non-LTO) references `__rust_alloc`/panic machinery regardless of consumer reachability; console-only consumers fail to link without allocator + panic handler. All Rust claims below were validated with working prototypes on `wasm32-unknown-unknown` (talc 5.0.4).

## Architecture Decisions

### D1: Macro-only allocator vs lib-embedded allocator

| Option                                          | Tradeoff                                                                                                                                                                 | Decision |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Lib hosts allocator + panic_handler (cfg-gated) | Links with zero boilerplate (validated) — but blocks user panic_handler customization (duplicate `panic_impl`), makes macro a duplicate-definition trap, gut REQ-4/REQ-5 | ✗        |
| **Macro emits both; all consumers invoke it**   | talc's documented pattern, user control; one-line boilerplate; requires REQ-5 "rust-hello MUST NOT" amendment (D5)                                                       | ✓        |

### D2: `wasm_setup!()` shape (validated)

`#[macro_export]` only — `pub use alloc::wasm_setup;` is impossible in stable Rust (E0432 unresolved; root re-export E0255 duplicate). `use wasm_apps_bindings::wasm_setup;` import works (validated). Macro references `$crate::alloc::_talc_reexport` (module lives inside `alloc`; root path fails E0433). Expansion: cfg-gated `mod _wasm_apps_alloc` on `all(not(target_feature = "atomics"), target_family = "wasm")`.

### D3: Existing-Cargo.toml lifecycle — backup → inject → build → restore

| Option                                                      | Tradeoff                                                           | Decision |
| ----------------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| Leave injected dep                                          | dirties user/committed manifests, breaks git cleanliness           | ✗        |
| **Backup + restore Cargo.toml AND Cargo.lock in `finally`** | byte-clean workspace even on failure; next build re-injects (fast) | ✓        |

### D4: Injection as pure exported functions

`injectBindingsDependency(manifest, bindingsDir, isWin32)` + `escapeTomlPathValue(p)`: end-of-section insert, create section at EOF if missing, EOL detection (CRLF-aware), idempotence guard (`^\s*wasm_apps_bindings\s*=` → no-op). `generateTempCargoToml` becomes public (REQ-2 literal), composing the injector over the template. Pure, fs-free, unit-testable.

### D5: REQ-5 amendment — rust-hello MUST invoke `wasm_setup!()`

Validated: console-only consumer without allocator fails ("no global memory allocator found but one is required" + panic_handler required). Only D1-A (rejected) avoids this. rust-hello gains `wasm_setup!()`; no `extern crate alloc` needed. Deviation flows to tasks.

## Data Flow

```
.wasm.rs ── RustCompilerStrategy.compile()
  ├─ Cargo.toml? ──no──▶ generateTempCargoToml ─ inject ─▶ write ─▶ cargo build ─▶ [finally] rm temp files
  └─ yes ─▶ backup Cargo.toml + Cargo.lock bytes
        ─▶ injectBindingsDependency() ─▶ write
        ─▶ cargo build --target wasm32-unknown-unknown  (pre-existing subprocess, unchanged)
        ─▶ findWasmOutput() ─▶ wasmBytes
        ─▶ [finally] restore both files (or remove if we created them)
```

## File Changes

| File                                                     | Action | Description                                                                                                                                                                                                                                                    |
| -------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/compiler/src/bindings/rust/Cargo.toml`         | Create | `wasm_apps_bindings`, edition 2021, `talc = "5"`                                                                                                                                                                                                               |
| `packages/compiler/src/bindings/rust/src/lib.rs`         | Create | `#![no_std]`, `pub mod wasi; console; fs; alloc;`                                                                                                                                                                                                              |
| `packages/compiler/src/bindings/rust/src/alloc.rs`       | Create | `_talc_reexport` (re-exports `talc::wasm::{WasmDynamicTalc, new_wasm_dynamic_allocator}`) + `wasm_setup!()` (D2)                                                                                                                                               |
| `packages/compiler/src/bindings/rust/src/wasi.rs`        | Create | copy of `bindings/wasi.rs` + `extern crate alloc;` `use alloc::vec; use alloc::vec::Vec;` after `#![allow]`; `pub fn __wasi_fd_prestat_dir_name` (fs.rs calls it; E0603)                                                                                       |
| `packages/compiler/src/bindings/rust/src/console.rs`     | Create | copy as-is (no alloc)                                                                                                                                                                                                                                          |
| `packages/compiler/src/bindings/rust/src/fs.rs`          | Create | copy + alloc imports (same as wasi.rs)                                                                                                                                                                                                                         |
| `packages/compiler/src/strategies/rust-strategy.ts`      | Modify | `BINDINGS_RUST_DIR` (mirror cpp-strategy `__dirname` pattern); public `generateTempCargoToml(sourceFile, bindingsDir, isWin32)`; export `injectBindingsDependency`/`escapeTomlPathValue`; compile(): inject both paths, backup/restore Cargo.toml + Cargo.lock |
| `packages/compiler/src/strategies/rust-strategy.test.ts` | Modify | REQ-6 tests (below)                                                                                                                                                                                                                                            |
| `examples/rust-hello/src/main.wasm.rs`                   | Modify | `use wasm_apps_bindings::{console, wasm_setup};` + `wasm_setup!()`; drop `mod wasi; mod console;`                                                                                                                                                              |
| `examples/rust-hello/src/{console.rs,wasi.rs}`           | Delete |                                                                                                                                                                                                                                                                |
| `examples/rust-fs/src/main.wasm.rs`                      | Modify | `use wasm_apps_bindings::{console, fs, wasi, wasm_setup};` + `wasm_setup!()`; keep `extern crate alloc;`                                                                                                                                                       |
| `examples/rust-fs/src/{console.rs,wasi.rs,fs.rs}`        | Delete |                                                                                                                                                                                                                                                                |
| `examples/{rust-hello,rust-fs}/src/Cargo.lock`           | Modify | regenerate: gains wasm_apps_bindings, talc 5.0.4, lock_api, allocator-api2                                                                                                                                                                                     |
| `examples/as-fs/src/{console.ts,fs.ts}`                  | Delete | `--path` injection already shipped (index.ts:105); no main edit                                                                                                                                                                                                |
| `examples/cpp-saludo/src/{console.h,wasi.h}`             | Delete | `-I` injection already shipped; no main edit                                                                                                                                                                                                                   |
| `examples/mounts-demo/src/{console.h,fs.h,wasi.h}`       | Delete | idem                                                                                                                                                                                                                                                           |

## Interfaces / Contracts

```rust
// alloc.rs (core — rest of crate mirrors bindings/ with the 2-3 additions above)
#[doc(hidden)]
pub mod _talc_reexport {
    pub use talc::wasm::{new_wasm_dynamic_allocator, WasmDynamicTalc};
}
#[macro_export]
macro_rules! wasm_setup {
    () => {
        #[cfg(all(not(target_feature = "atomics"), target_family = "wasm"))]
        mod _wasm_apps_alloc {
            #[global_allocator]
            static TALC: $crate::alloc::_talc_reexport::WasmDynamicTalc =
                unsafe { $crate::alloc::_talc_reexport::new_wasm_dynamic_allocator() };
            #[panic_handler]
            fn wasm_apps_panic(_info: &core::panic::PanicInfo) -> ! {
                core::arch::wasm32::unreachable()
            }
        }
    };
}
```

```ts
// rust-strategy.ts — exported for tests
export function escapeTomlPathValue(p: string): string {
  return p.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
export function injectBindingsDependency(manifest: string, bindingsDir: string, isWin32 = false): string;
```

Example mains: rust-hello = `#![no_std]` + `use wasm_apps_bindings::{console, wasm_setup};` + `wasm_setup!();` + `console::log(...)` (validated, no `extern crate alloc`). rust-fs adds `extern crate alloc;` + `fs::read_file(b"/mnt/data/greeting.txt")` via `wasm_apps_bindings::{console, fs, wasi}`.

## Testing Strategy

| Layer       | What                                                                                                                                               | Approach                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Unit        | `injectBindingsDependency`: existing deps byte-identical, dep appended last in section, missing section created at EOF, idempotent, CRLF preserved | pure-fn assertions on fixture strings           |
| Unit        | win32 escaping: `C:\apps\wasm-apps\...` → `C:\\apps\\wasm-apps\\...`                                                                               | `escapeTomlPathValue` + injector with `isWin32` |
| Unit        | `generateTempCargoToml`: `[dependencies]` + dep line with absolute bindings/rust path (REQ-2)                                                      | direct call                                     |
| Unit        | compile(): existing manifest restored after success AND failure; temp Cargo.toml still cleaned (REQ-6)                                             | fixture dirs + mocked `execFile`                |
| Integration | 5 examples build + run with zero local copies (REQ-5); rust-fs runs on talc (REQ-4)                                                                | existing `scripts/test-examples.mjs`            |

## Threat Matrix

N/A — no routing, shell-command, subprocess, VCS/PR-automation, executable-file-classification, or process-integration boundary is introduced or modified. Rows: Documentation-like paths (N/A — no new file-classification logic), Git repository selection (N/A — no git ops), Commit state (N/A), Push state (N/A), PR commands (N/A). The `cargo build` subprocess is pre-existing and untouched; new code only reads/writes manifest files with backup/restore.

## Migration / Rollout

No data migration. Example Cargo.lock files regenerated during apply. Runtime behavior: Rust projects with existing Cargo.toml get a transient dep during build only; workspace stays byte-clean after.

## Open Questions

None blocking. (Non-blocking note: `target/` dirs remain after builds — pre-existing temp-case behavior, out of scope.)
