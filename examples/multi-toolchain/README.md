# Multi-toolchain — AssemblyScript + C++ en un mismo build

Este ejemplo muestra un proyecto que combina módulos de dos lenguajes (`.wasm.ts` + `.wasm.cpp`) en un único build: el orquestador descubre ambas extensiones, cada una se enruta a su toolchain, y el linker las enlaza juntas en un mismo ejecutable.

## Estructura

```
multi-toolchain/
├── wapp.json            # Configuración con wasi: true
└── src/
    ├── main.wasm.ts     # Punto de entrada AssemblyScript
    └── engine.wasm.cpp  # Módulo C++ con funciones de cómputo
```

## Cómo ejecutar

```bash
cd examples/multi-toolchain
wapp build
./multi-toolchain
```

Salida esperada:

```
Hola desde AssemblyScript!
Multi-toolchain build funciona!
```

## Qué demuestra

- **Descubrimiento multi-extensión**: `wapp build` globea `**/*.wasm.{ts,mjs,as,cpp,cxx,cc,rs}` y `**/*.wasm`.
- **Router por sufijo**: `getExtension()` distingue `.wasm.cpp` de `.wasm` genérico (longest-suffix-first).
- **Salidas intermedias**: los `.wasm` se nombran `{base}.{toolchainId}.wasm` (ej: `engine.cpp.wasm`).

## Requisitos

Toolchain C++ con soporte wasm32 (para `engine.wasm.cpp`).
