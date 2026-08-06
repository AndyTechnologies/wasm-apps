# C++ saludo — Bindings inyectadas en C++

Este ejemplo muestra un módulo C++ (`.wasm.cpp`) que usa la API `console` de los bindings inyectados por el compilador, sin copiar ningún binding en el proyecto.

## Estructura

```
cpp-saludo/
├── wapp.json            # Configuración con wasi: true
└── src/
    └── main.wasm.cpp    # Módulo C++ que usa console.h
```

## Cómo ejecutar

```bash
cd examples/cpp-saludo
wapp build
./cpp-saludo
```

Salida esperada:

```
Hola desde C++ WASM!
```

## Qué demuestra

- **Bindings inyectadas**: `#include "console.h"` se resuelve al directorio de bindings del compilador (vía `-I`), no a una copia local.
- **WASI habilitado**: `wasi: true` en `wapp.json` enlaza las llamadas estándar de C++.

## Requisitos

Toolchain C++ con soporte wasm32 (`clang++` + `wasm-ld`). El ejemplo se skippea en los tests de integración si el toolchain no está disponible.
