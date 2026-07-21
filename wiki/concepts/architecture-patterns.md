# Patrones Arquitectónicos

Seis patrones formales estructuran el código de wasm-apps.

## 1. Pipeline (Tuberías)

`packages/linker/src/build-pipeline.ts`

Etapas secuenciales e independientes (Stage<I,O>) que transforman `.wasm` → binario. Ver [[concepts/pipeline|Pipeline]].

## 2. Strategy (Estrategia)

`packages/types/` (interfaces), `packages/compiler/src/assemblyscript-compiler-strategy.ts`, `packages/linker/src/wasmtime-linker-strategy.ts`, `packages/linker/src/default-codegen-strategy.ts`

Comportamientos intercambiables para compilación (`[[entities/compiler|Compiler]]`), linkage (`[[entities/linker|Linker]]`) y generación de código.

## 3. Builder (Constructor)

`packages/linker/src/native-app-builder.ts`

Construcción paso a paso de un ejecutable nativo con validación previa y caché incremental.

## 4. Repository (Repositorio)

`packages/compiler/src/compiler-cache-repository.ts`, `packages/linker/src/linker-manifest-repository.ts`, `packages/linker/src/download-cache-repository.ts`

Abstracción de almacenamiento de artefactos cacheados detrás de `ICacheRepository<T>`.

## 5. Microkernel / Plugin

`packages/linker/src/plugin-manager.ts`, `packages/linker/src/plugin-loader.ts`, `packages/linker/src/pipeline.ts`

Núcleo mínimo extensible vía plugins. Ver [[concepts/plugin-system|Sistema de Plugins]].

## 6. Command (Comando)

`packages/cli/src/commands/`

Cada operación CLI encapsulada como objeto `ICommand` independiente en el [[entities/cli|CLI]].
