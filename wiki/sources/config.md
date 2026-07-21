# Fuente: Referencia de wapp.json

**Ruta**: `docs/reference/config.md`
**Propósito**: Esquema completo del archivo de configuración wapp.json.

## Contenido extraído

- Esquema JSON completo con todos los campos
- `sourceDir`, `outDir`, `output`, `entry`, `moduleMatching`, `wasi`, `target`, `wasmtimePath`
- `targets[]` — lista de destinos para compilación cruzada
- `zigPath` — ruta al compilador Zig
- `optimization` — nivel de optimización del binario (z, s, 0-3)
- `plugins[]` — configuración de plugins (id, enabled, path, config)
- `compiler` — flags del compilador AS (release, runtime, optimizeLevel, shrinkLevel, sourceMap)

Ver [[entities/cli|CLI (wapp)]] para la síntesis.
