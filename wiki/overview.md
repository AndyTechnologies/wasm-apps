# Overview

wasm-apps es una toolchain que transforma código **AssemblyScript**, **C++** y **Rust** en **ejecutables nativos autocontenidos** para Linux, macOS y Windows.

## Pipeline

```
.wasm.ts|.wasm.cpp|.wasm.rs|.wasm ──[ToolchainRouter]──> .wasm ──[linker]──> binario nativo (ELF/PE/Mach-O)
```

El pipeline usa un **ToolchainRouter** (Microkernel + Strategy) para enrutar cada archivo fuente a su toolchain, y el linker genera C++ con **templates Nunjucks** + cmake-js + Wasmtime C-API. Usa [[concepts/caching|Caché Incremental]] en 3 capas.

## Componentes

1. **Compiler** (`@wasm-apps/compiler`) — ToolchainRouter con 4 estrategias: AssemblyScript (asc), C++ (clang++/CMake), Rust (cargo), Precompilado (magic bytes). Caché en dos niveles con clave extendida por toolchainId. Inyecta bindings `console`/`fs`/`wasi` a los tres lenguajes (AS por rewrite de imports, C++ por `-I`, Rust por crate vendido `wasm_apps_bindings`).
2. **Linker** (`@wasm-apps/linker`) — lee módulos `.wasm`, resuelve dependencias, genera C++ con Nunjucks templates, compila con cmake-js. Soporta plugins, compilación cruzada, templates personalizados y preopens WASI (`mounts` de `wapp.json` → `wasi_config.preopen_dir`).
3. **CLI** (`@wasm-apps/cli`) — orquestador `wapp` que coordina el pipeline completo con configuración via `wapp.json`. Ver [[entities/compiler|Compiler]], [[entities/linker|Linker]], [[entities/cli|CLI]], [[entities/types|Tipos Compartidos]].

## Diferenciadores

- **Multi-lenguaje**: AssemblyScript, C++, Rust en un mismo pipeline
- **Bindings inyectadas**: APIs `console`/`fs`/`wasi` sin copias locales en el proyecto
- **Preopens WASI**: acceso a directorios del host via `mounts` en `wapp.json` (validados en build-time)
- **Binarios autocontenidos**: sin dependencias de runtime WASM en despliegue
- **Caché incremental**: tres capas (descargas, compilación, build) con toolchain-aware keys
- **Multiplataforma**: Linux, macOS, Windows con compilación cruzada
- **Templates personalizables**: el código C++ generado se puede adaptar con templates Nunjucks propios
- **Extensible**: 7 patrones arquitectónicos formales — ver [[concepts/architecture-patterns|Patrones Arquitectónicos]]

## Repositorio

GitHub: [AndyTechnologies/wasm-apps](https://github.com/AndyTechnologies/wasm-apps)

- **Licencia**: MIT | **Lenguajes**: TypeScript 87.9%, JavaScript 12.1%
- **Commits**: 68 | **Releases**: 4 (último v1.3.1, Jul 2026)
- **CI**: GitHub Actions (lint → build → test) en push a `dev` y PR a `main`
- **Release**: automático via Changesets al mergear a `main`
