# Tasks: Bindings Auto-Injection (talc Allocator)

## Review Workload Forecast

| Field                   | Value                                     |
| ----------------------- | ----------------------------------------- |
| Estimated changed lines | ~2,100 (additions ~730, deletions ~1,400) |
| 800-line budget risk    | High                                      |
| Chained PRs recommended | Yes                                       |
| Suggested split         | PR 1 → PR 2 → PR 3 (stacked-to-main)      |
| Delivery strategy       | auto-chain                                |
| Chain strategy          | pending (recommended: stacked-to-main)    |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                        | Likely PR   | Focused test command                                | Runtime harness                                                           | Rollback boundary                                        |
| ---- | ------------------------------------------- | ----------- | --------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1    | Vendored crate + injection + unit tests     | PR 1 (~700) | `pnpm --filter @wasm-apps/compiler test`            | N/A — pure-fn tests + mocked execFile; real cargo build covered by Unit 3 | revert rust-strategy.ts + tests, delete `bindings/rust/` |
| 2    | rust examples migrate + Cargo.lock regen    | PR 2 (~680) | `node scripts/test-examples.mjs rust-hello rust-fs` | real build+run of both rust examples (cargo, wasm32 target)               | git revert restores deleted example copies               |
| 3    | as/cpp examples cleanup + full verification | PR 3 (~730) | `pnpm -r build && node scripts/test-examples.mjs`   | real full example suite (all 5 examples)                                  | git revert restores as-fs/cpp-saludo/mounts-demo copies  |

Threat matrix: all rows N/A (design) — no RED-test tasks.

## Phase 1: Vendored Crate

- [x] 1.1 Create `packages/compiler/src/bindings/rust/Cargo.toml`: `wasm_apps_bindings`, edition 2021, `talc = "5"`
- [x] 1.2 Create `src/lib.rs`: `#![no_std]`; `pub mod alloc; pub mod console; pub mod fs; pub mod wasi;`
- [x] 1.3 Create `src/alloc.rs`: `#[doc(hidden)] pub mod _talc_reexport` (re-export `talc::wasm::{WasmDynamicTalc, new_wasm_dynamic_allocator}`) + `#[macro_export] wasm_setup!()` cfg-gated `all(not(target_feature = "atomics"), target_family = "wasm")`, paths `$crate::alloc::_talc_reexport::…` (D2: NO `pub use` — E0432/E0255)
- [x] 1.4 Create `src/wasi.rs`: copy `bindings/wasi.rs`; add `extern crate alloc;` + `use alloc::vec; use alloc::vec::Vec;` + `pub fn __wasi_fd_prestat_dir_name` (fs.rs calls it; E0603)
- [x] 1.5 Create `src/console.rs` (copy as-is, no alloc) and `src/fs.rs` (copy + alloc imports, same as wasi.rs)
- [x] 1.6 Verify crate: `cargo check --target wasm32-unknown-unknown` inside `bindings/rust/` compiles clean

## Phase 2: Injection in rust-strategy.ts

- [x] 2.1 Add `BINDINGS_RUST_DIR` via `fileURLToPath(import.meta.url)` (mirror cpp-strategy `__dirname` pattern)
- [x] 2.2 Export `escapeTomlPathValue(p)`: escape `\` → `\\`, `"` → `\"` (win32 paths)
- [x] 2.3 Export `injectBindingsDependency(manifest, bindingsDir, isWin32 = false)`: append dep under `[dependencies]` (create section at EOF if absent), CRLF-aware EOL, idempotence guard `^\s*wasm_apps_bindings\s*=` → no-op; string-based, no TOML parser (REQ-3)
- [x] 2.4 Make `generateTempCargoToml(sourceFile, bindingsDir, isWin32)` public; append `wasm_apps_bindings = { path = "<abs bindings/rust>" }` (REQ-2)
- [x] 2.5 `compile()`: inject both paths; for existing manifest backup Cargo.toml+Cargo.lock bytes → inject → build → restore in `finally` (byte-clean even on failure, D3); temp-Cargo.toml cleanup stays

## Phase 3: Unit Tests (REQ-6)

- [x] 3.1 `injectBindingsDependency`: existing deps byte-identical, dep appended last, missing section created at EOF, idempotent no-op, CRLF preserved (fixture strings)
- [x] 3.2 win32 escaping: `C:\apps\wasm-apps\…` → `C:\\apps\\wasm-apps\\…` via `escapeTomlPathValue` + injector with `isWin32`
- [x] 3.3 `generateTempCargoToml`: `[dependencies]` + absolute binding path literal
- [x] 3.4 `compile()`: existing manifest restored after success AND after failure; temp Cargo.toml still cleaned (fixture dirs + mocked `execFile`)

## Phase 4: Example Migrations (REQ-5)

- [x] 4.1 rust-hello `src/main.wasm.rs`: `use wasm_apps_bindings::{console, wasm_setup};` + `wasm_setup!()` (D5: MUST invoke — rlib refs alloc/panic machinery); drop `mod wasi; mod console;`; delete `console.rs`, `wasi.rs`
- [x] 4.2 rust-fs `src/main.wasm.rs`: `use wasm_apps_bindings::{console, fs, wasi, wasm_setup};` + `wasm_setup!()`; keep `extern crate alloc;`; delete `console.rs`, `wasi.rs`, `fs.rs`
- [ ] 4.3 as-fs: delete `src/console.ts`, `src/fs.ts` (path injection already shipped)
- [ ] 4.4 cpp-saludo: delete `src/console.h`, `src/wasi.h` (`-I` injection shipped)
- [ ] 4.5 mounts-demo: delete `src/console.h`, `src/fs.h`, `src/wasi.h`

## Phase 5: Locks + Full Verification

- [x] 5.1 Regenerate `examples/{rust-hello,rust-fs}/src/Cargo.lock` (gains wasm_apps_bindings, talc 5.0.4, lock_api, allocator-api2)
- [ ] 5.2 `pnpm -r build` + unit suite green (REQ-6 scenario)
- [ ] 5.3 `node scripts/test-examples.mjs`: all 5 examples build+run with zero local copies; rust-fs runs on talc (REQ-4 scenario)
