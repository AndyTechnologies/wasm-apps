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
    "shrinkLevel": 2,
    "sourceMap": true
  }
}
```

## Campos

### sourceDir

_string, por defecto: `"src"`_

Directorio donde se buscan archivos `.wasm.ts`. Se escanea recursivamente.

### outDir

_string, por defecto: `"wasm-out"`_

Directorio donde se escriben los archivos `.wasm` intermedios.

### output

_string, por defecto: nombre base del directorio del proyecto_

Nombre del ejecutable nativo final.

### entry

_string, por defecto: `"_start"`_

Nombre del export WASM que se ejecuta al iniciar.

### moduleMatching

_string, por defecto: `"file-name"`_

- `"file-name"` — empareja imports con archivos fuente por nombre de archivo
- `"name-only"` — empareja por nombre de export

### wasi

_boolean, por defecto: `false`_

Cuando es `true`, enlaza con la interfaz WASI en lugar de imports `env` directos.

### target

_string, por defecto: plataforma nativa_

Tripleta de destino para compilación cruzada (ej. `aarch64-linux-gnu`, `x86_64-windows`).

### wasmtimePath

_string, opcional_

Ruta personalizada a una instalación de Wasmtime C-API.

### targets

_array de objetos, opcional_

Lista de destinos para compilación cruzada. Cada entrada define:

| Campo    | Tipo    | Descripción                                   |
| -------- | ------- | --------------------------------------------- |
| `name`   | string  | Nombre identificador del destino              |
| `triple` | string  | Tripleta de destino (ej. `aarch64-linux-gnu`) |
| `output` | string  | Nombre del ejecutable de salida (opcional)    |
| `entry`  | string  | Punto de entrada (opcional, hereda del raíz)  |
| `wasi`   | boolean | Usar WASI en este destino (opcional)          |

### zigPath

_string, opcional_

Ruta al compilador Zig, usado como toolchain cross-compilador. Si no se especifica, se busca `zig` en el PATH.

### optimization

_object, opcional_

Configuración de optimización del binario generado:

| Campo   | Tipo   | Por defecto | Descripción                                                                  |
| ------- | ------ | ----------- | ---------------------------------------------------------------------------- |
| `level` | string | `"z"`       | Nivel de optimización: `z` (tamaño), `s` (menor tamaño), `0`-`3` (velocidad) |

### plugins

_array de objetos, opcional_

Lista de plugins del pipeline WASM. Cada entrada define:

| Campo     | Tipo    | Descripción                                    |
| --------- | ------- | ---------------------------------------------- |
| `id`      | string  | Identificador único del plugin                 |
| `enabled` | boolean | Si el plugin está activo                       |
| `path`    | string  | Ruta al módulo del plugin (opcional)           |
| `config`  | object  | Configuración específica del plugin (opcional) |

### compiler

_object_

| Campo           | Tipo    | Por defecto     | Descripción                                             |
| --------------- | ------- | --------------- | ------------------------------------------------------- |
| `release`       | boolean | `false`         | Modo release (optimizado, sin sourcemaps)               |
| `runtime`       | string  | `"incremental"` | Runtime de AS: `incremental`, `minimal`, `stub`, `full` |
| `optimizeLevel` | number  | `3`             | Nivel de optimización 0-3                               |
| `shrinkLevel`   | number  | `2`             | Nivel de reducción 0-2                                  |
| `sourceMap`     | boolean | `true`          | Generar sourcemaps (deshabilitado en release)           |
