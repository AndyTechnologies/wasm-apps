# Patrones Arquitectónicos

Ocho patrones formales estructuran el código de wasm-apps.

## 1. Microkernel + Strategy — ToolchainRouter

`packages/compiler/src/toolchain-router.ts`, `packages/compiler/src/strategies/`

El router es el núcleo mínimo; las estrategias son plugins internos que implementan la compilación para cada lenguaje. Nuevos lenguajes se agregan implementando `ToolchainStrategy` y registrándolos.

## 2. Pipeline (Tuberías)

`packages/linker/src/build-pipeline.ts`

Etapas secuenciales e independientes (Stage<I,O>) que transforman `.wasm` → binario nativo. Ver [[concepts/pipeline|Pipeline]].

## 3. Strategy (Estrategia)

`packages/types/` (interfaces), `packages/compiler/src/strategies/*`, `packages/linker/src/`

Comportamientos intercambiables para compilación (4 strategies multi-toolchain), linkage (`WasmtimeLinkerStrategy`) y generación de código.

## 4. Builder (Constructor)

`packages/linker/src/native-app-builder.ts`

Construcción paso a paso de un ejecutable nativo con validación previa y caché incremental.

## 5. Repository (Repositorio)

`packages/compiler/src/compiler-cache-repository.ts`, `packages/linker/src/build-cache.ts`, `packages/linker/src/download-cache-repository.ts`

Abstracción de almacenamiento de artefactos cacheados detrás de `ICacheRepository<T>`. Ver [[concepts/caching|Caché Incremental]].

## 6. Nunjucks Template Rendering

`packages/linker/src/template-renderer.ts`, `packages/linker/templates/`

Reemplaza la concatenación de strings para generar C++ con templates declarativos Nunjucks. Soporta herencia de partials, filtros personalizados y directorios de templates custom.

## 7. Microkernel / Plugin (Linker)

`packages/linker/src/plugin-manager.ts`

Núcleo mínimo extensible vía plugins externos con hooks en fases del pipeline. Ver [[concepts/plugin-system|Sistema de Plugins]].

## 8. Command (Comando)

`packages/cli/src/`

Cada operación CLI encapsulada como objeto comando independiente (Command Pattern).
