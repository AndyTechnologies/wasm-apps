# `@wasm-apps/linker` — Linker WASM → Ejecutable Nativo

Lee módulos WebAssembly (`.wasm`), resuelve dependencias entre ellos, genera código C++ que los instancia con la C-API de Wasmtime, y compila todo en un ejecutable nativo autocontenido.

## Instalación

```bash
pnpm add @wasm-apps/linker
```

## API

### `createNativeApp(options, quiet?): Promise<string>`

Pipeline completo: parsea `.wasm` → resuelve dependencias → genera C++ → compila con CMake.

```ts
import { createNativeApp } from '@wasm-apps/linker';

const outputPath = await createNativeApp({
  inputPaths: ['wasm-out/modulo.wasm'],
  output: 'dist/mi-app',
  entry: '_start',
  wasi: false,
  moduleMatching: 'file-name',
});
```

**Opciones** (`NativeAppOptions`):

| Campo            | Tipo                       | Descripción                                |
| ---------------- | -------------------------- | ------------------------------------------ |
| `inputPaths`     | `string[]`                 | Rutas a archivos `.wasm`                   |
| `output`         | `string`                   | Ruta del ejecutable de salida              |
| `entry`          | `string`                   | Nombre del export a llamar al iniciar      |
| `wasi`           | `boolean`                  | Habilitar interfaz WASI                    |
| `moduleMatching` | `'name-only'\|'file-name'` | Estrategia de resolución de imports        |
| `target`         | `string`                   | Tripleta de compilación cruzada (opcional) |
| `wasmtimePath`   | `string`                   | Ruta personalizada a Wasmtime C-API        |

### `parseWasmModule(filePath): WasmModuleInfo`

Parsea un archivo `.wasm` y extrae imports, exports y firmas de tipos.

```ts
import { parseWasmModule } from '@wasm-apps/linker';
const info = parseWasmModule('modulo.wasm');
// info.imports, info.exports, info.importFuncTypes
```

### `resolveDependencies(modules, matching): ResolvedLink`

Construye el grafo de dependencias entre módulos WASM y aplica orden topológico (Kahn).

```ts
import { resolveDependencies } from '@wasm-apps/linker';
const resolved = resolveDependencies(modules, 'file-name');
// resolved.order — orden de instanciación
// resolved.exportMap — mapa de exports disponibles
```

### `generateCCode(link, entryPoint, wasi, importFuncTypes?): string`

Genera el código fuente C++ que instancia los módulos con Wasmtime.

### `treeShake(wasmBuffer): Buffer`

Elimina funciones no referenciadas de un binario WASM, reemplazándolas con stubs mínimos (`unreachable`).

### `compileCpp(cppSource, outputPath, options): Promise<void>`

Compila el C++ generado con cmake-js + CMake en un binario nativo.

### `setupWasmtime(wasmtimePath?, ignoreCache?): Promise<void>`

Descarga y cachea la Wasmtime C-API en `~/.wasm-linker/`.

### Gestión de caché

```ts
import { getBuildCacheInfo, clearBuildCache, getCacheInfo, clearCache } from '@wasm-apps/linker';

const buildInfo = getBuildCacheInfo(); // manifiesto en .wapp_build/
const dlInfo = await getCacheInfo(); // descargas en ~/.wasm-linker/
await clearCache(); // limpia caché de descargas
```

### Pipeline de plugins

El linker expone un sistema de plugins con fases del pipeline:

```ts
import { pipeline, loadPlugins, PipelinePhase } from '@wasm-apps/linker';

await loadPlugins(config.plugins);

const ctx = await pipeline.runPhase(PipelinePhase.BeforeCodeGen, {
  sourceDir: 'src',
  outDir: 'wasm-out',
  options: { entry: '_start', wasi: false, moduleMatching: 'file-name' },
});
```

## CLI

```bash
pnpm run linker build <input> -o <output> [options]
pnpm run linker watch <input> -o <output> [options]
pnpm run linker setup
pnpm run linker status
pnpm run linker cache info
pnpm run linker cache clear
```

### build

| Opción                   | Descripción                               |
| ------------------------ | ----------------------------------------- |
| `-o, --output <file>`    | Ruta del ejecutable de salida (requerido) |
| `-t, --target <triple>`  | Destino de compilación cruzada            |
| `-e, --entry <name>`     | Función de entrada (defecto `_start`)     |
| `--wasi`                 | Habilitar WASI                            |
| `--module-matching`      | `name-only` o `file-name`                 |
| `--wasmtime-path <path>` | Ruta personalizada a Wasmtime C-API       |

## Host Functions

El linker incluye un registro de funciones host nativas (`HostFunctionRegistry`) que implementan la stdlib de AssemblyScript en C++:

- **console**: log, debug, info, warn, error, time, timeLog, timeEnd, assert
- **Math**: abs, acos, ..., trunc (38 funciones)
- **Date**: now
- **Performance**: now
- **Process**: exit
- **seed**, **crypto.getRandomValuesN**, **abort**, **trace**

Las funciones se resuelven por módulo+nombre o por nombre desde el módulo `env`.

## Plugins incluidos

| Plugin                  | Propósito                               |
| ----------------------- | --------------------------------------- |
| `stdlib-plugin`         | Registra funciones host built-in        |
| `size-optimizer-plugin` | Optimiza tamaño del binario WASM        |
| `tree-shake-plugin`     | Elimina funciones WASM no referenciadas |

## Dependencias

- `cmake-js` — integración CMake con Node.js
- `cross-spawn` — spawn multiplataforma
- `tar` — extracción de archivos tar
- `commander` — CLI
- `glob` — búsqueda de archivos
- `ora` — spinners de terminal
- `command-exists` — detección de binarios en PATH
- `@wasm-apps/types` — tipos compartidos
