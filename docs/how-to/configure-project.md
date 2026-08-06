# Cómo configurar un proyecto

## Usando wapp.json

Inicializa un proyecto con la configuración por defecto:

```bash
wapp init mi-proyecto
```

Edita `wapp.json` para personalizar el comportamiento:

```json
{
  "sourceDir": "src",
  "outDir": "wasm-out",
  "output": "mi-app",
  "entry": "_start",
  "moduleMatching": "file-name",
  "wasi": false,
  "mounts": [{ "host": "data", "guest": "/mnt/data" }],
  "target": "x86_64-linux",
  "compiler": {
    "release": false,
    "runtime": "incremental",
    "optimizeLevel": 3,
    "shrinkLevel": 2,
    "sourceMap": true,
    "toolchains": {
      "cpp": { "optimizeLevel": 2 },
      "rust": { "release": true }
    }
  }
}
```

| Campo                 | Propósito                                                                       |
| --------------------- | ------------------------------------------------------------------------------- |
| `sourceDir`           | Directorio con archivos fuente (`.wasm.ts`, `.wasm.cpp`, `.wasm.rs`, etc.)      |
| `outDir`              | Directorio de salida para archivos `.wasm` intermedios                          |
| `output`              | Nombre del ejecutable nativo final                                              |
| `entry`               | Nombre del export a llamar al iniciar (por defecto `_start`)                    |
| `moduleMatching`      | Cómo emparejar imports con archivos fuente                                      |
| `wasi`                | Habilitar interfaz WASI (requerido para C++ con `printf`)                       |
| `mounts`              | Preopens WASI: directorios host montados en rutas guest (requiere `wasi: true`) |
| `target`              | Tripleta de destino para compilación cruzada                                    |
| `compiler`            | Flags globales del compilador                                                   |
| `compiler.toolchains` | Overrides por toolchain (assemblyscript, cpp, rust, precompiled)                |

### Per-Toolchain Config

El campo `compiler.toolchains` permite configurar cada toolchain por separado:

```json
{
  "compiler": {
    "release": true,
    "optimizeLevel": 3,
    "toolchains": {
      "assemblyscript": { "runtime": "minimal", "sourceMap": true },
      "cpp": { "optimizeLevel": 2 },
      "rust": { "release": false }
    }
  }
}
```

Cada toolchain recibe los valores globales combinados con sus overrides. Los campos no especificados en un toolchain heredan del global.

## Sobrescrituras desde CLI

Cada campo de configuración se puede sobrescribir desde la línea de comandos:

```bash
wapp build --release --output dist/app --wasi --optimize-level 2
```

## Sin archivo de configuración

Sin `wapp.json`, la herramienta usa valores por defecto (`src/` → `wasm-out/`, sin WASI, entry=`_start`).
