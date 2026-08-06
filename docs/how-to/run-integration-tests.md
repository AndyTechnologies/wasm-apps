# Cómo correr los tests de integración

Los tests de integración (`pnpm test:integration`, vía `scripts/test-examples.mjs`) compilan y ejecutan los [ejemplos](../index.md#ejemplos) del repo. Cada ejemplo se compila con `wapp build` y su salida se compara contra `expected-stdout.txt`.

## Prerrequisitos

Además de los requisitos base del proyecto (Node ≥ 22, pnpm, CMake, toolchain C++), los tests usan los toolchains WASM de los ejemplos:

| Toolchain                 | Para qué                                                         | Instalación                                                      |
| ------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| **clang++ + wasm-ld**     | Ejemplos C++ (`.wasm.cpp`) compilan a wasm32                     | `clang++ --target=wasm32` usa `wasm-ld`; en Linux: paquete `lld` |
| **cargo + wasm32 target** | Ejemplos Rust (`.wasm.rs`) compilan con `wasm32-unknown-unknown` | `rustup target add wasm32-unknown-unknown`                       |
| **Wasmtime C-API v46**    | El linker genera el ejecutable nativo                            | Autodescargada por `wapp setup` (no hay que instalarla a mano)   |

En macOS, las toolchains C++ de Apple no incluyen `lld`; instalá LLVM con `brew install llvm` y añadí su `bin/` al `PATH`.

El script detecta toolchains faltantes y **skippea** los ejemplos que los requieran (no falla el run). El ejemplo `precompiled` se regenera automáticamente desde `basico` antes de compilar (su `src/main.wasm` no está versionado).

## Ejecutar

```bash
pnpm -r build   # compila los packages (necesario antes del primer run)
pnpm run test:integration
```

## CI

`.github/workflows/ci.yml` (job `integration-tests`) instala estos toolchains en Linux y macOS: `lld` vía apt en Linux, `brew install llvm` + `PATH` en macOS, y `rustup target add wasm32-unknown-unknown` en ambos. La Wasmtime C-API se cachea entre runs con una clave que incluye `runner.arch`.
