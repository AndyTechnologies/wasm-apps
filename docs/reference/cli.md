# Referencia de CLI

## `wapp` (orquestador)

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

Crea `wapp.json` en el directorio indicado (o el actual). Error si el archivo ya existe.

### build

```
wapp build [options]
```

Descubre archivos fuente de todas las extensiones soportadas en `sourceDir`, los compila a `.wasm` usando el `ToolchainRouter` y enlaza un ejecutable nativo.

**Extensiones soportadas**: `.wasm.ts`, `.wasm.mjs`, `.as`, `.wasm.cpp`, `.wasm.cxx`, `.wasm.cc`, `.wasm.rs`, `.wasm`

| Opción                             | Por defecto           | Descripción                               |
| ---------------------------------- | --------------------- | ----------------------------------------- |
| `-o, --output <file>`              | nombre del directorio | Ruta del ejecutable de salida             |
| `-t, --target <triple>`            | nativa                | Destino de compilación cruzada            |
| `-e, --entry <name>`               | `_start`              | Nombre de la función de entrada           |
| `-m, --module-matching <strategy>` | `file-name`           | Estrategia de resolución de imports       |
| `--source-dir <dir>`               | `src`                 | Directorio fuente                         |
| `--out-dir <dir>`                  | `wasm-out`            | Directorio de salida WASM intermedio      |
| `--release`                        | `false`               | Modo release (optimizado, sin sourcemaps) |
| `--optimize-level <n>`             | `3`                   | Nivel de optimización 0-3                 |
| `--shrink-level <n>`               | `0`                   | Nivel de reducción 0-2                    |
| `--wasi`                           | `false`               | Habilitar WASI                            |

**Archivos intermedios**: Los `.wasm` compilados se nombran como `{base}.{toolchainId}.wasm`:

- `math.wasm.ts` → `math.wasm`
- `engine.wasm.cpp` → `engine.cpp.wasm`
- `crypto.wasm.rs` → `crypto.rust.wasm`
- `library.wasm` → `library.wasm`

### setup

```
wapp setup
```

Descarga y almacena en caché la Wasmtime C-API en `~/.wasm-linker/`. Es seguro re-ejecutarlo.

### cache

```
wapp cache info       Estado de todas las capas de caché
wapp cache clear      Limpiar todas las cachés
```

---

## compiler

```
pnpm run compiler build <files...> [options]
pnpm run compiler watch <files...> [options]
```

Compila archivos fuente a WebAssembly usando el ToolchainRouter.

| Opción                | Por defecto   | Descripción                                       |
| --------------------- | ------------- | ------------------------------------------------- |
| `-o, --outDir <dir>`  | `wasm-out`    | Directorio de salida                              |
| `--release`           | `false`       | Modo release                                      |
| `--runtime <name>`    | `incremental` | Runtime: `incremental`, `minimal`, `stub`, `full` |
| `--optimizeLevel <n>` | `3`           | Optimización 0-3                                  |
| `--shrinkLevel <n>`   | `0`           | Reducción 0-2                                     |
| `--no-sourcemap`      | —             | Deshabilitar sourcemaps                           |
| `--no-parallel`       | —             | Compilación secuencial                            |

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

| Opción                   | Por defecto     | Descripción                         |
| ------------------------ | --------------- | ----------------------------------- |
| `-o, --output <file>`    | _(obligatorio)_ | Ruta del ejecutable de salida       |
| `-t, --target <triple>`  | nativa          | Destino de compilación cruzada      |
| `-e, --entry <name>`     | `_start`        | Función de entrada                  |
| `--wasi`                 | `false`         | Habilitar WASI                      |
| `--module-matching`      | `name-only`     | `name-only` o `file-name`           |
| `--wasmtime-path <path>` | —               | Ruta personalizada a Wasmtime C-API |
