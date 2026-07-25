# Cómo gestionar la caché

Tres capas independientes de caché aceleran las compilaciones repetidas.

## Ver estado de la caché

```bash
wapp cache info
```

Muestra la ruta, tamaño y cantidad de elementos de cada capa de caché.

## Limpiar todas las cachés

```bash
wapp cache clear
```

Elimina las tres cachés. La siguiente compilación será desde cero.

## Capas de caché

| Capa                     | Ubicación                         | Qué almacena                                         | Se invalida por                                                   |
| ------------------------ | --------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| **Caché del compilador** | `.wapp_cache/compiler/`           | `.wasm`, `.d.ts`, `.js`, sourcemaps compilados       | Cambios en código fuente, flags del compilador, o **toolchainId** |
| **Manifiesto de build**  | `.wapp_build/build-manifest.json` | Hashes WASM + opciones del linker + **templateHash** | Cambios en `.wasm`, opciones del linker, o **templates Nunjucks** |
| **Caché de descarga**    | `~/.wasm-linker/`                 | Archivo Wasmtime C-API                               | `wapp setup` o `cache clear`                                      |

### Toolchain-aware cache key

La clave de caché del compilador incluye el `toolchainId`. Esto significa que el mismo código fuente compilado con diferentes toolchains (ej: AssemblyScript vs C++) produce entradas de caché independientes.

### Template hash

El manifiesto de build incluye un hash de todos los templates Nunjucks. Si modificás algún template, el linker detecta el mismatch y regenera el C++ automáticamente.

## Omitir la caché

Para forzar una reconstrucción completa del linker, modificá cualquier opción o archivo de entrada. Para el compilador, la caché se puede saltar por invocación (aún no expuesto vía CLI).
