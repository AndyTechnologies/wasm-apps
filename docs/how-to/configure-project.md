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
  "target": "x86_64-linux",
  "compiler": {
    "release": false,
    "runtime": "incremental",
    "optimizeLevel": 3,
    "shrinkLevel": 2,
    "sourceMap": true
  }
}
```

| Campo            | Propósito                                                    |
| ---------------- | ------------------------------------------------------------ |
| `sourceDir`      | Directorio que contiene archivos `.wasm.ts`                  |
| `outDir`         | Directorio de salida para archivos `.wasm` intermedios       |
| `output`         | Nombre del ejecutable nativo final                           |
| `entry`          | Nombre del export a llamar al iniciar (por defecto `_start`) |
| `moduleMatching` | Cómo emparejar imports con archivos fuente                   |
| `wasi`           | Habilitar interfaz WASI                                      |
| `target`         | Tripleta de destino para compilación cruzada                 |
| `compiler`       | Flags del compilador AssemblyScript                          |

## Sobrescrituras desde CLI

Cada campo de configuración se puede sobrescribir desde la línea de comandos:

```bash
wapp build --release --output dist/app --wasi --optimize-level 2
```

## Sin archivo de configuración

Sin `wapp.json`, la herramienta usa valores por defecto (`src/` → `wasm-out/`, sin WASI, entry=`_start`).
