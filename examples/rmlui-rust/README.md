# rmlui-rust — Rust RmlUI Example

Demonstrates calling `env.Rml_*` host functions from a Rust WASM module
using raw `extern "C"` FFI declarations.

## Structure

```
rmlui-rust/
├── wapp.json              # Toolchain config with rmlui-plugin enabled
├── src/
│   ├── Cargo.toml         # Rust crate config (cdylib, no_std)
│   └── lib.wasm.rs        # Rust source — calls env.Rml_* host functions
├── ui/
│   ├── main.rml           # RmlUI document template
│   └── style.rcss         # RmlUI stylesheet
└── README.md
```

## How it works

| Layer | Role |
|-------|------|
| **RmlUI plugin** | Registers `env.Rml_*` host functions in the linker |
| **Generated main.cpp** | Initialises SDL3/GL3/RmlUI, defines bridge bodies, runs event loop |
| **Rust WASM module** | Calls host functions to create context, load document, manipulate DOM |

## How to run

```bash
cd examples/rmlui-rust
wapp build
./rmlui-rust
```

Requires SDL3 and OpenGL 3.3. The Rust compiler must target `wasm32-wasip1`:

```bash
rustup target add wasm32-wasip1
```

## Notes

- The example uses `#![no_main]` and raw `extern "C"` FFI — no std dependency.
- For production Rust projects, use the generated `rmlui_bindings.rs` crate
  from `packages/types/src/rmlui_bindings.rs` which provides safe wrappers
  with `RmluiError` enum and `Result<T, RmluiError>` return types.
- String arguments must be null-terminated. The helper `to_c_str` in this
  example is a simplified version; a real binding would use `CString` from `alloc`.
