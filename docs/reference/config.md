# Referencia de wapp.json

## Esquema

```json
{
  "sourceDir": "src",
  "outDir": "wasm-out",
  "output": "mi-app",
  "entry": "_start",
  "moduleMatching": "file-name",
  "wasi": false,
  "target": "x86_64-linux",
  "wasmtimePath": "/ruta/a/wasmtime",
  "compiler": {
    "release": false,
    "runtime": "incremental",
    "optimizeLevel": 3,
    "shrinkLevel": 0,
    "sourceMap": true
  }
}
```

## Campos

### sourceDir
*string, por defecto: `"src"`*

Directorio donde se buscan archivos `.wasm.ts`. Se escanea recursivamente.

### outDir
*string, por defecto: `"wasm-out"`*

Directorio donde se escriben los archivos `.wasm` intermedios.

### output
*string, por defecto: nombre base del directorio del proyecto*

Nombre del ejecutable nativo final.

### entry
*string, por defecto: `"_start"`*

Nombre del export WASM que se ejecuta al iniciar.

### moduleMatching
*string, por defecto: `"file-name"`*

- `"file-name"` — empareja imports con archivos fuente por nombre de archivo
- `"name-only"` — empareja por nombre de export

### wasi
*boolean, por defecto: `false`*

Cuando es `true`, enlaza con la interfaz WASI en lugar de imports `env` directos.

### target
*string, por defecto: plataforma nativa*

Tripleta de destino para compilación cruzada (ej. `aarch64-linux-gnu`, `x86_64-windows`).

### wasmtimePath
*string, opcional*

Ruta personalizada a una instalación de Wasmtime C-API.

### compiler
*object*

| Campo | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `release` | boolean | `false` | Modo release (optimizado, sin sourcemaps) |
| `runtime` | string | `"incremental"` | Runtime de AS: `incremental`, `minimal`, `stub`, `full` |
| `optimizeLevel` | number | `3` | Nivel de optimización 0-3 |
| `shrinkLevel` | number | `0` | Nivel de reducción 0-2 |
| `sourceMap` | boolean | `true` | Generar sourcemaps (deshabilitado en release) |
