# Cómo funciona la caché

Tres capas independientes de caché aceleran las compilaciones repetidas evitando trabajo innecesario.

## Caché del compilador

**Ubicación:** `.wapp_cache/compiler/` (local al proyecto)

**Clave:** SHA-256 de `{sourceCode, runtime, isDev, sourceMap, optimizeLevel, shrinkLevel}`

**Almacenamiento:** Un directorio por clave que contiene `result.json`, `out.wasm`, `out.d.ts`, `out.js`, `out.wasm.map`

Cualquier cambio en el código fuente o en los flags del compilador produce un hash diferente → cache miss → compilación nueva. Entrada idéntica → cache hit → omite `asc.main()` por completo y carga los artefactos desde disco.

## Manifiesto de build

**Ubicación:** `.wapp_build/build-manifest.json` (local al proyecto)

El manifiesto almacena hashes de todos los archivos `.wasm` de entrada más las opciones del linker (entry, target, wasi, moduleMatching, wasmtimePath, wasmtimeVersion). Si el estado actual coincide con el manifiesto, `createNativeApp()` retorna inmediatamente.

## Caché de descarga

**Ubicación:** `~/.wasm-linker/wasmtime/` (global al usuario)

El archivo de Wasmtime C-API (~15 MB) se descarga una vez y se almacena en caché global. Las peticiones HTTP range permiten descargas reanudables. Se limpia con `wapp cache clear` y se regenera con `wapp setup`.

## Gestión de caché

| Comando | Efecto |
|---|---|
| `wapp cache info` | Muestra las tres cachés con tamaño y cantidad de elementos |
| `wapp cache clear` | Elimina las tres cachés por completo |
