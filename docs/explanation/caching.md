# Cómo funciona la caché

Tres capas independientes de caché aceleran las compilaciones repetidas evitando trabajo innecesario.

## Caché del compilador

**Ubicación:** `.wapp_cache/compiler/` (local al proyecto)

**Clave:** SHA-256 de `{sourceCode, runtime, isDev, sourceMap, optimizeLevel, shrinkLevel, toolchainId}`

**Almacenamiento:** Un directorio por clave que contiene `result.json`, `out.wasm`, `out.d.ts`, `out.js`, `out.wasm.map`

La clave incluye el **toolchainId** (`assemblyscript`, `cpp`, `rust`, `precompiled`), por lo que el mismo código fuente compilado con diferentes toolchains produce entradas de caché independientes.

Cualquier cambio en el código fuente, flags del compilador, o toolchain produce un hash diferente → cache miss → compilación nueva.

## Manifiesto de build

**Ubicación:** `.wapp_build/build-manifest.json` (local al proyecto)

El manifiesto almacena hashes de todos los archivos `.wasm` de entrada más las opciones del linker (entry, target, wasi, moduleMatching, wasmtimePath, wasmtimeVersion) más un **templateHash** de los templates Nunjucks. Si cambia algún template Nunjucks, el build se invalida y regenera el C++.

## Caché de descarga

**Ubicación:** `~/.wasm-linker/` (global al usuario)

El archivo de Wasmtime C-API (~15 MB) se descarga una vez y se almacena en caché global. Las peticiones HTTP range permiten descargas reanudables.

## Gestión de caché

| Comando            | Efecto                                                     |
| ------------------ | ---------------------------------------------------------- |
| `wapp cache info`  | Muestra las tres cachés con tamaño y cantidad de elementos |
| `wapp cache clear` | Elimina las tres cachés por completo                       |
