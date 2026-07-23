# `@wasm-apps/compiler` — Compilador AssemblyScript → WASM

Compila archivos AssemblyScript (`.wasm.ts`, `.ts`, `.asm`) a WebAssembly binario usando `assemblyscript/asc` como librería.

## Instalación

```bash
pnpm add @wasm-apps/compiler
```

## API

### `compileWasm(options): Promise<CompileResult>`

Compila código fuente AssemblyScript a WebAssembly.

```ts
import { compileWasm } from '@wasm-apps/compiler';

const result = await compileWasm({
  fileName: 'src/main.wasm.ts',
  sourceCode: 'export function _start(): void { console.log("hola") }',
  isDev: true,
  runtime: 'incremental',
  sourceMap: true,
  optimizeLevel: 3,
});
```

**Opciones** (`CompileOptions`):

| Campo                | Tipo              | Por defecto     | Descripción                               |
| -------------------- | ----------------- | --------------- | ----------------------------------------- |
| `fileName`           | `string`          | _(requerido)_   | Ruta del archivo fuente                   |
| `sourceCode`         | `string`          | _(requerido)_   | Código fuente AssemblyScript              |
| `isDev`              | `boolean`         | `true`          | Modo debug (vs release)                   |
| `runtime`            | `AsRuntime`       | `'incremental'` | Runtime: incremental, minimal, stub, full |
| `sourceMap`          | `boolean`         | `true`          | Generar sourcemap                         |
| `optimizeLevel`      | `number` (0-3)    | `3`             | Nivel de optimización                     |
| `shrinkLevel`        | `number` (0-2)    | `0`             | Nivel de reducción de tamaño              |
| `maxMemoryCacheSize` | `number`          | `100`           | Tamaño máximo de LRU cache en memoria     |
| `aliases`            | `ResolvedAlias[]` | -               | Alias de resolución de imports            |

**Retorna** (`CompileResult`):

| Campo          | Tipo         | Descripción                          |
| -------------- | ------------ | ------------------------------------ |
| `wasmBytes`    | `Uint8Array` | Binario WASM compilado               |
| `dtsContent`   | `string`     | Declaraciones TypeScript generadas   |
| `bindingsJs`   | `string`     | Bindings JS generados                |
| `sourceMap`    | `string`     | Sourcemap (solo si `sourceMap:true`) |
| `dependencies` | `string[]`   | Dependencias resueltas               |
| `hash`         | `string`     | SHA-256 del código fuente            |

### Gestión de caché

```ts
import { getCompileCacheInfo, clearCompileCache } from '@wasm-apps/compiler';

// Estado de la caché de disco
const info = getCompileCacheInfo();
console.log(info.humanSize); // "1.5 MB"

// Limpiar caché
clearCompileCache();
```

## CLI

```bash
pnpm run compiler build <archivos...> [options]
pnpm run compiler watch <archivos...> [options]
```

### build

Compila archivos AssemblyScript a `.wasm`.

| Opción                | Por defecto   | Descripción                               |
| --------------------- | ------------- | ----------------------------------------- |
| `-o, --outDir <dir>`  | `wasm-out`    | Directorio de salida                      |
| `--release`           | `false`       | Modo release (optimizado)                 |
| `--runtime <name>`    | `incremental` | Runtime: incremental, minimal, stub, full |
| `--optimizeLevel <n>` | `3`           | Nivel de optimización 0-3                 |
| `--shrinkLevel <n>`   | -             | Nivel de reducción 0-2                    |
| `--no-sourcemap`      | -             | Deshabilitar sourcemaps en modo debug     |
| `--no-parallel`       | -             | Compilación secuencial                    |

### watch

Vigila archivos y recompila automáticamente al detectar cambios (con debounce de 300ms).

## Caché

El compilador tiene dos niveles de caché:

1. **LRU en memoria** — clave por `fileName`, hasta 100 entradas
2. **Disco** — en `.wapp_cache/compiler/{sha256}/`, clave basada en código fuente + flags de compilación

Si el hash del código fuente coincide con el caché, se omite la invocación de `asc.main()`.

## Dependencias

- `assemblyscript` — compilador AS (usado como librería)
- `commander` — CLI argument parsing
- `glob` — búsqueda de archivos
- `@wasm-apps/types` — tipos compartidos
