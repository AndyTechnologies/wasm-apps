# Overview

wasm-apps es una toolchain que transforma código AssemblyScript (`.wasm.ts`) en **ejecutables nativos autocontenidos** para Linux, macOS y Windows.

## Pipeline

```
.wasm.ts ──[compiler]──> .wasm ──[linker]──> binario nativo (ELF/PE/Mach-O)
```

El pipeline sigue el patrón [[concepts/pipeline|Pipeline Architecture]] y usa [[concepts/caching|Caché Incremental]] en 3 capas para evitar trabajo repetido.

## Componentes

1. **Compiler** (`@wasm-apps/compiler`) — usa `assemblyscript/asc` como librería para compilar `.wasm.ts` a WebAssembly binario. Caché en dos niveles (LRU en memoria + disco).
2. **Linker** (`@wasm-apps/linker`) — lee módulos `.wasm`, resuelve dependencias, genera C++ con Wasmtime C-API, compila con cmake-js. Soporta plugins, compilación cruzada, tree-shaking.
3. **CLI** (`@wasm-apps/cli`) — orquestador `wapp` que coordina el pipeline completo con configuración via `wapp.json`. Ver [[entities/compiler|Compiler]], [[entities/linker|Linker]], [[entities/cli|CLI]], [[entities/types|Tipos Compartidos]].

## Diferenciadores

- **Binarios autocontenidos**: sin dependencias de runtime WASM en despliegue
- **Caché incremental**: tres capas (descargas, compilación, build)
- **Multiplataforma**: Linux, macOS, Windows con compilación cruzada
- **Extensible**: 6 patrones arquitectónicos formales — ver [[concepts/architecture-patterns|Patrones Arquitectónicos]]

## Repositorio

GitHub: [AndyTechnologies/wasm-apps](https://github.com/AndyTechnologies/wasm-apps)

- **Licencia**: MIT | **Lenguajes**: TypeScript 87.9%, JavaScript 12.1%
- **Commits**: 68 | **Releases**: 4 (último v1.3.1, Jul 2026)
- **CI**: GitHub Actions (lint → build → test) en push a `dev` y PR a `main`
- **Release**: automático via Changesets al mergear a `main`
