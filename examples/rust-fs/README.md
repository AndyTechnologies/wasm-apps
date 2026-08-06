# Rust FS — Preopens WASI desde Rust

Este ejemplo muestra cómo leer un archivo de un directorio montado (`mounts` de `wapp.json`) usando las APIs `fs` y `wasi` del crate `wasm_apps_bindings` desde Rust.

## Estructura

```
rust-fs/
├── wapp.json            # wasi: true + mounts: [{ host: "data", guest: "/mnt/data" }]
├── data/
│   └── greeting.txt     # Archivo montado en /mnt/data/greeting.txt
└── src/
    ├── Cargo.toml       # Sin [dependencies] — el compilador inyecta wasm_apps_bindings
    └── main.wasm.rs     # Lee /mnt/data/greeting.txt con fs::read_file
```

## Cómo ejecutar

```bash
cd examples/rust-fs
wapp build
./rust-fs
```

Salida esperada:

```
Opening file...
Hello from the mounted directory!
```

## Qué demuestra

- **Preopens WASI**: el host `data` se monta en `/mnt/data` con permisos completos (READ|WRITE).
- **Bindings inyectadas**: `use wasm_apps_bindings::{console, fs, wasi, wasm_setup};` se resuelve al crate vendido por el compilador.
- **Fallback elegante**: si el archivo no está disponible, imprime `(no mounted dir)` en lugar de fallar.

## Requisitos

`cargo` con target `wasm32-unknown-unknown`.
