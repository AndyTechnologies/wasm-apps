# Rust hello — Bindings inyectadas en Rust

Este ejemplo muestra un módulo Rust (`.wasm.rs`, `#![no_std]`) que usa la API `console` del crate `wasm_apps_bindings`, inyectado automáticamente por el compilador en el `Cargo.toml`.

## Estructura

```
rust-hello/
├── wapp.json            # Configuración con wasi: true
└── src/
    ├── Cargo.toml       # Sin [dependencies] — el compilador inyecta wasm_apps_bindings
    └── main.wasm.rs     # Módulo Rust que usa wasm_apps_bindings
```

## Cómo ejecutar

```bash
cd examples/rust-hello
wapp build
./rust-hello
```

Salida esperada:

```
Hola desde Rust WASM!
```

## Qué demuestra

- **Bindings inyectadas**: `use wasm_apps_bindings::{console, wasm_setup};` se resuelve al crate vendido por el compilador (`injectBindingsDependency` añade la dependencia `path` al `Cargo.toml`).
- **Sin stdlib**: `#![no_std]` + `crate-type = ["cdylib"]` producen un wasm mínimo.

## Requisitos

`cargo` con target `wasm32-unknown-unknown` (`rustup target add wasm32-unknown-unknown`).
