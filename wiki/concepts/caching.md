# Caché Incremental

Tres capas independientes de caché aceleran las compilaciones repetidas.

## Compiler Cache

- **Ubicación**: `.wapp_cache/compiler/{sha256}/` (local al proyecto)
- **Clave**: SHA-256 de `{sourceCode, runtime, isDev, sourceMap, optimizeLevel, shrinkLevel}`
- **Contenido**: `result.json`, `out.wasm`, `out.d.ts`, `out.js`, `out.wasm.map`
- **Invalidación**: cualquier cambio en source o flags cambia el hash
- **Implementación**: `CompilerCacheRepository` (ICacheRepository)

## Build Cache

- **Ubicación**: `.wapp_build/build-manifest.json` (local al proyecto)
- **Contenido**: hashes de todos los `.wasm` de entrada + opciones del linker
- **Invalidación**: cualquier cambio en `.wasm` o en opciones regenera el binario
- **Implementación**: `LinkerManifestRepository` (ICacheRepository)

## Download Cache

- **Ubicación**: `~/.wasm-linker/` (global al usuario)
- **Contenido**: Wasmtime C-API (~15 MB) descargada
- **Gestión**: `wapp cache clear` la elimina; `wapp setup` la regenera
- **Implementación**: `DownloadCacheRepository` (ICacheRepository)

## Implementación

Cada capa implementa `ICacheRepository<T>` (Repository Pattern). Ver [[concepts/architecture-patterns|Patrones Arquitectónicos]] y [[concepts/plugin-system|Sistema de Plugins]] (el `HostFunctionRegistry` también usa este patrón de registro).

- **Compiler Cache** → [[entities/compiler|Compilador]]
- **Build Cache** → [[entities/linker|Linker]]
- **Download Cache** → [[entities/linker|Linker]]

## Gestión desde CLI

| Comando                     | Efecto                             |
| --------------------------- | ---------------------------------- |
| `wapp cache info`           | Muestra las tres cachés con tamaño |
| `wapp cache clear`          | Elimina las tres cachés            |
| `wapp cache clear --linker` | Solo caché de descargas            |
| `wapp cache clear --all`    | Todo                               |
