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
| **Caché de deps RmlUI**  | `~/.wasm-linker/rmlui/`           | SDL3, RmlUi, fuentes y markers de versión            | `wapp setup` (re-descarga si el marker falta)                     |

### Caché de dependencias RmlUI

El plugin `rmlui-plugin` descarga y compila sus dependencias nativas una sola vez en `~/.wasm-linker/rmlui/`:

| Subdirectorio | Contenido                                                            |
| ------------- | -------------------------------------------------------------------- |
| `sdl/`        | SDL3 3.2.4 (tarball de fuentes; win32 usa el VC.zip precompilado)    |
| `rmlui/`      | RmlUi 6.2 (tarball de fuentes, build CMake estático)                 |
| `fonts/`      | LatoLatin (Regular/Bold/Italic) + NotoEmoji, usadas por los ejemplos |
| `src/`        | Fuentes descargadas (tarballs originales)                            |

Versiones fijadas: **RmlUi 6.2**, **SDL3 3.2.4**, **Wasmtime 46.0.1** (esta última en `~/.wasm-linker/wasmtime-*`).

Cada dependencia deja un marker `{dep}.{version}.ok` (ej: `rmlui.6.2.ok`, `sdl.3.2.4.ok`); si el marker falta o el checksum SHA256 no coincide, `wapp setup` re-descarga y purga la entrada corrupta. En Linux/macOS el build de SDL3 tiene un fallback a compilación de fuentes si el binario 404.

### Toolchain-aware cache key

La clave de caché del compilador incluye el `toolchainId`. Esto significa que el mismo código fuente compilado con diferentes toolchains (ej: AssemblyScript vs C++) produce entradas de caché independientes.

### Template hash

El manifiesto de build incluye un hash de todos los templates Nunjucks. Si modificás algún template, el linker detecta el mismatch y regenera el C++ automáticamente.

## Omitir la caché

Para forzar una reconstrucción completa del linker, modificá cualquier opción o archivo de entrada. Para el compilador, la caché se puede saltar por invocación (aún no expuesto vía CLI).
