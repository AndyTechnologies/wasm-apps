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

| Capa | Ubicación | Qué almacena | Se invalida por |
|---|---|---|---|
| **Caché del compilador** | `.wapp_cache/compiler/` | `.wasm`, `.d.ts`, `.js`, sourcemaps compilados | Cambios en código fuente o flags del compilador |
| **Manifiesto de build** | `.wapp_build/build-manifest.json` | Hashes WASM + opciones del linker | Cambios en `.wasm` de entrada o en opciones del linker |
| **Caché de descarga** | `~/.wasm-linker/` | Archivo Wasmtime C-API | `wapp setup` o `cache clear` |

## Omitir la caché

La caché del compilador se puede saltar por invocación (aún no expuesto vía CLI). Para el linker, modifica cualquier opción o archivo de entrada para forzar una reconstrucción.
