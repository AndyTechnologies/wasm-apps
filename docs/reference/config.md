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
    "sourceMap": true,
    "toolchains": {
      "assemblyscript": { "runtime": "minimal" },
      "cpp": { "optimizeLevel": 2 },
      "rust": { "release": true }
    }
  },
  "linker": {
    "templatePath": "./custom-templates"
  }
}
```

## Campos

### sourceDir

_string, por defecto: `"src"`_

Directorio donde se buscan archivos fuente. Se escanea recursivamente para todas las extensiones soportadas: `.wasm.ts`, `.wasm.mjs`, `.as`, `.wasm.cpp`, `.wasm.cxx`, `.wasm.cc`, `.wasm.rs`, `.wasm`.

### outDir

_string, por defecto: `"wasm-out"`_

Directorio donde se escriben los archivos `.wasm` intermedios con nombres `{base}.{toolchainId}.wasm`.

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

Cuando es `true`, enlaza con la interfaz WASI en lugar de imports `env` directos. **Requerido** para toolchains C++ y Rust que usen llamadas estándar (`printf`, `println!`, etc.).

### target

_string, por defecto: plataforma nativa_

Tripleta de destino para compilación cruzada (ej. `aarch64-linux-gnu`, `x86_64-windows`).

### wasmtimePath

_string, opcional_

Ruta personalizada a una instalación de Wasmtime C-API.

### targets

_array de objetos, opcional_

Lista de destinos para compilación cruzada. Cada entrada define:

| Campo    | Tipo    | Descripción                      |
| -------- | ------- | -------------------------------- |
| `name`   | string  | Nombre identificador del destino |
| `triple` | string  | Tripleta de destino              |
| `output` | string  | Nombre del ejecutable (opcional) |
| `entry`  | string  | Punto de entrada (opcional)      |
| `wasi`   | boolean | Usar WASI (opcional)             |

### zigPath

_string, opcional_

Ruta al compilador Zig, usado como toolchain cross-compilador.

### optimization

_object, opcional_

Configuración de optimización del binario generado:

| Campo   | Tipo   | Por defecto | Descripción                                   |
| ------- | ------ | ----------- | --------------------------------------------- |
| `level` | string | `"z"`       | Nivel: `z` (tamaño), `s`, `0`-`3` (velocidad) |

### plugins

_array de objetos, opcional_

Lista de plugins del pipeline. Ver `docs/USER_PLUGINS.md`.

### compiler

_object_

| Campo           | Tipo    | Por defecto     | Descripción                                   |
| --------------- | ------- | --------------- | --------------------------------------------- |
| `release`       | boolean | `false`         | Modo release (optimizado, sin sourcemaps)     |
| `runtime`       | string  | `"incremental"` | Runtime de AS (solo AssemblyScript)           |
| `optimizeLevel` | number  | `3`             | Nivel de optimización 0-3                     |
| `shrinkLevel`   | number  | `2`             | Nivel de reducción 0-2                        |
| `sourceMap`     | boolean | `true`          | Generar sourcemaps (deshabilitado en release) |

#### compiler.toolchains

_object, opcional_

Overrides de configuración por toolchain. Cada clave (`assemblyscript`, `cpp`, `rust`, `precompiled`) acepta los mismos campos que `compiler`. Los valores se combinan con los globales:

```json
{
  "compiler": {
    "release": true,
    "optimizeLevel": 3,
    "toolchains": {
      "cpp": { "optimizeLevel": 2 },
      "rust": { "release": false }
    }
  }
}
```

En este ejemplo:

- AssemblyScript recibe `release: true, optimizeLevel: 3`
- C++ recibe `release: true, optimizeLevel: 2` (override parcial)
- Rust recibe `release: false, optimizeLevel: 3` (override parcial)

### linker

_object, opcional_

| Campo          | Tipo   | Por defecto | Descripción                                             |
| -------------- | ------ | ----------- | ------------------------------------------------------- |
| `templatePath` | string | —           | Ruta a directorio con templates Nunjucks personalizados |
