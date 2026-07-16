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

Compila todos los `.wasm.ts` en `sourceDir` y enlaza un ejecutable nativo.

| Opción | Por defecto | Descripción |
|---|---|---|
| `-o, --output <file>` | nombre del directorio | Ruta del ejecutable de salida |
| `-t, --target <triple>` | nativa | Destino de compilación cruzada |
| `-e, --entry <name>` | `_start` | Nombre de la función de entrada |
| `-m, --module-matching <strategy>` | `file-name` | Estrategia de resolución de imports |
| `--source-dir <dir>` | `src` | Directorio fuente |
| `--out-dir <dir>` | `wasm-out` | Directorio de salida WASM intermedio |
| `--release` | `false` | Modo release (optimizado, sin sourcemaps) |
| `--optimize-level <n>` | `3` | Nivel de optimización 0-3 |
| `--shrink-level <n>` | `0` | Nivel de reducción 0-2 |
| `--wasi` | `false` | Habilitar WASI |

### setup

```
wapp setup
```

Descarga y almacena en caché la Wasmtime C-API en `~/.wasm-linker/wasmtime/`. Es seguro re-ejecutarlo — usa peticiones HTTP range para descargas reanudables.

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

| Opción | Por defecto | Descripción |
|---|---|---|
| `-o, --outDir <dir>` | `wasm-out` | Directorio de salida |
| `--release` | `false` | Modo release |
| `--runtime <name>` | `incremental` | Runtime: `incremental`, `minimal`, `stub`, `full` |
| `--optimizeLevel <n>` | `3` | Optimización 0-3 |
| `--shrinkLevel <n>` | `0` | Reducción 0-2 |
| `--no-sourcemap` | — | Deshabilitar sourcemaps |
| `--no-parallel` | — | Compilación secuencial |

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

| Opción | Por defecto | Descripción |
|---|---|---|
| `-o, --output <file>` | *(obligatorio)* | Ruta del ejecutable de salida |
| `-t, --target <triple>` | nativa | Destino de compilación cruzada |
| `-e, --entry <name>` | `_start` | Función de entrada |
| `--wasi` | `false` | Habilitar WASI |
| `--module-matching` | `name-only` | `name-only` o `file-name` |
| `--wasmtime-path <path>` | — | Ruta personalizada a Wasmtime C-API |
