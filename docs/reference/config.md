# wapp.json reference

## Schema

```json
{
  "sourceDir": "src",
  "outDir": "wasm-out",
  "output": "my-app",
  "entry": "_start",
  "moduleMatching": "file-name",
  "wasi": false,
  "target": "x86_64-linux",
  "wasmtimePath": "/path/to/wasmtime",
  "compiler": {
    "release": false,
    "runtime": "incremental",
    "optimizeLevel": 3,
    "shrinkLevel": 0,
    "sourceMap": true
  }
}
```

## Fields

### sourceDir
*string, default: `"src"`*

Directory scanned for `.wasm.ts` files. Scanned recursively.

### outDir
*string, default: `"wasm-out"`*

Directory where intermediate `.wasm` files are written.

### output
*string, default: basename of project directory*

Name of the final native executable.

### entry
*string, default: `"_start"`*

WASM export name called on startup.

### moduleMatching
*string, default: `"file-name"`*

- `"file-name"` — match imports to source files by filename stem
- `"name-only"` — match by export name

### wasi
*boolean, default: `false`*

When true, links with WASI interface instead of raw `env` imports.

### target
*string, default: native platform*

Cross-compilation target triple (e.g. `aarch64-linux-gnu`, `x86_64-windows`).

### wasmtimePath
*string, optional*

Override path to a custom Wasmtime C-API installation.

### compiler
*object*

| Field | Type | Default | Description |
|---|---|---|---|
| `release` | boolean | `false` | Release mode (optimised, no sourcemaps) |
| `runtime` | string | `"incremental"` | AS runtime: `incremental`, `minimal`, `stub`, `full` |
| `optimizeLevel` | number | `3` | Optimisation 0-3 |
| `shrinkLevel` | number | `0` | Shrink level 0-2 |
| `sourceMap` | boolean | `true` | Emit sourcemaps (disabled in release) |
