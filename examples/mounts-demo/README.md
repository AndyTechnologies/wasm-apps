# Mounts demo — Preopens WASI desde C++

Este ejemplo muestra cómo declarar `mounts` en `wapp.json` para exponer un directorio del host dentro del WASM, y leerlo con la API `fs` desde C++.

## Estructura

```
mounts-demo/
├── wapp.json            # wasi: true + mounts: [{ host: "data", guest: "/mnt/data" }]
├── data/
│   └── greeting.txt     # Archivo montado en /mnt/data/greeting.txt
└── src/
    └── main.wasm.cpp    # Lee y escribe el contenido montado en stdout
```

## Cómo ejecutar

```bash
cd examples/mounts-demo
wapp build
./mounts-demo
```

Salida esperada:

```
Opening file...
Hello from the mounted directory!
```

## Qué demuestra

- **Preopens WASI**: `wapp.json` → `"mounts": [{ "host": "data", "guest": "/mnt/data" }]`. El host relativo se resuelve contra el cwd del build y se embebe como ruta absoluta; el guest debe ser absoluto (`/mnt/data`).
- **Validación en build-time**: si `data/` no existe o el guest no empieza con `/`, el linker falla con `ConfigError`.
- **Permisos completos**: el preopen se configura con READ|WRITE (los ejemplos fs escriben y leen).
- **Bindings fs**: `#include "fs.h"` + `fs::readFile(...)` vienen de los bindings inyectados.

## Variaciones

Los ejemplos [as-fs](../as-fs/README.md) (AssemblyScript) y [rust-fs](../rust-fs/README.md) (Rust) demuestran lo mismo en los otros lenguajes.
