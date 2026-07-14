# CLI reference

## `wapp` (orchestrator)

```
wapp init [dir]
wapp build [options]
wapp setup
wapp cache info
wapp cache clear
```

### init

```
wapp init [dir]
```

Creates `wapp.json` in the given directory (or current). Errors if the file already exists.

### build

```
wapp build [options]
```

Compiles all `.wasm.ts` in `sourceDir` and links a single native executable.

| Option | Default | Description |
|---|---|---|
| `-o, --output <file>` | directory basename | Output executable path |
| `-t, --target <triple>` | native | Cross-compilation target |
| `-e, --entry <name>` | `_start` | Entry function name |
| `-m, --module-matching <strategy>` | `file-name` | Import resolution strategy |
| `--source-dir <dir>` | `src` | Source directory |
| `--out-dir <dir>` | `wasm-out` | Intermediate WASM output |
| `--release` | `false` | Release mode (optimised, no sourcemaps) |
| `--optimize-level <n>` | `3` | Optimisation level 0-3 |
| `--shrink-level <n>` | `0` | Shrink level 0-2 |
| `--wasi` | `false` | Enable WASI |

### setup

```
wapp setup
```

Downloads and caches the Wasmtime C-API in `~/.wasm-linker/wasmtime/`. Safe to re-run — uses HTTP range requests for resumable downloads.

### cache

```
wapp cache info       Status of all cache layers
wapp cache clear      Wipe all caches
```

---

## compiler

```
pnpm run compiler build <files...> [options]
pnpm run compiler watch <files...> [options]
```

| Option | Default | Description |
|---|---|---|
| `-o, --outDir <dir>` | `wasm-out` | Output directory |
| `--release` | `false` | Release mode |
| `--runtime <name>` | `incremental` | Runtime: `incremental`, `minimal`, `stub`, `full` |
| `--optimizeLevel <n>` | `3` | Optimisation 0-3 |
| `--shrinkLevel <n>` | `0` | Shrink 0-2 |
| `--no-sourcemap` | — | Disable sourcemaps |
| `--no-parallel` | — | Sequential compilation |

---

## linker

```
pnpm run linker build <input> -o <output> [options]
pnpm run linker watch <input> -o <output> [options]
pnpm run linker setup
pnpm run linker status
pnpm run linker cache info
pnpm run linker cache clear
```

| Option | Default | Description |
|---|---|---|
| `-o, --output <file>` | *(required)* | Output executable path |
| `-t, --target <triple>` | native | Cross-compilation target |
| `-e, --entry <name>` | `_start` | Entry function |
| `--wasi` | `false` | Enable WASI |
| `--module-matching` | `name-only` | `name-only` or `file-name` |
| `--wasmtime-path <path>` | — | Custom Wasmtime C-API path |
