# How to configure a project

## Using wapp.json

Initialise a project with default config:

```bash
wapp init my-project
```

Edit `wapp.json` to customise behaviour:

```json
{
  "sourceDir": "src",
  "outDir": "wasm-out",
  "output": "my-app",
  "entry": "_start",
  "moduleMatching": "file-name",
  "wasi": false,
  "target": "x86_64-linux",
  "compiler": {
    "release": false,
    "runtime": "incremental",
    "optimizeLevel": 3,
    "shrinkLevel": 0,
    "sourceMap": true
  }
}
```

| Field | Purpose |
|---|---|
| `sourceDir` | Directory containing `.wasm.ts` files |
| `outDir` | Output directory for intermediate `.wasm` files |
| `output` | Name of the final native executable |
| `entry` | Export name to call on startup (default `_start`) |
| `moduleMatching` | How to match imports to source files |
| `wasi` | Enable WASI interface |
| `target` | Cross-compilation target triple |
| `compiler` | AssemblyScript compiler flags |

## CLI overrides

Every config field can be overridden on the command line:

```bash
wapp build --release --output dist/app --wasi --optimize-level 2
```

## No config file

Without `wapp.json`, the tool uses defaults (`src/` → `wasm-out/`, no WASI, entry=`_start`).
