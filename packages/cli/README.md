# `@wasm-apps/cli` — Orquestador `wapp`

CLI unificada que coordina el pipeline completo: descubre archivos fuente multi-extension (`.wasm.ts`, `.wasm.cpp`, `.wasm.rs`, `.wasm`, etc.), los compila a WebAssembly y linkea un ejecutable nativo autocontenido. Lee la configuración de `wapp.json` y admite sobrescrituras por línea de comandos.

## Instalación

```bash
# Global
pnpm install --global @wasm-apps/cli

# O local desde el repo
pnpm install --global ./packages/cli
```

## Uso rápido

```bash
wapp init mi-proyecto
cd mi-proyecto
echo 'export function _start(): void { console.log("hola mundo"); }' > src/main.wasm.ts
wapp setup
wapp build
./hello
```

## API

### `resolveConfig(rootDir, overrides?): WappConfig`

Resuelve la configuración del proyecto, combinando `wapp.json` (si existe) con valores por defecto y sobrescrituras.

```ts
import { resolveConfig } from '@wasm-apps/cli';

const config = resolveConfig('/ruta/al/proyecto', { entry: 'main' });
```

### `initProject(rootDir, overrides?): WappConfig`

Crea un archivo `wapp.json` en el directorio especificado. Error si ya existe.

### `buildProject(options): Promise<void>`

Pipeline completo de build:

1. Carga plugins del pipeline
2. Compila todos los `.wasm.ts` del `sourceDir` a `.wasm`
3. Linkea un ejecutable nativo

```ts
import { buildProject } from '@wasm-apps/cli';

await buildProject({
  rootDir: process.cwd(),
  entry: '_start',
  release: true,
  wasi: false,
});
```

### `devCommand(options): Promise<void>`

Construye inicialmente y luego vigila cambios en el directorio fuente, recompilando y relinkeando automáticamente.

### `cacheInfo(): Promise<void>`

Muestra el estado de las tres capas de caché (descargas, compilación, build).

### `clearCache(options?): Promise<void>`

Limpia caché(es) específicas: `--build`, `--linker`, `--all`.

## CLI

```bash
wapp init [dir]
wapp build [options]
wapp setup
wapp cache info
wapp cache clear [options]
```

### init

Crea `wapp.json` con valores por defecto:

```json
{
  "sourceDir": "src",
  "outDir": "wasm-out",
  "entry": "_start",
  "moduleMatching": "file-name",
  "compiler": {
    "release": false,
    "runtime": "incremental",
    "optimizeLevel": 3,
    "shrinkLevel": 2,
    "sourceMap": true
  }
}
```

### build

| Opción                             | Descripción                    | Por defecto                  |
| ---------------------------------- | ------------------------------ | ---------------------------- |
| `-o, --output <file>`              | Ruta del ejecutable de salida  | Nombre del directorio raíz   |
| `-t, --target <triple>`            | Compilación cruzada            | Nativo                       |
| `-e, --entry <name>`               | Función de entrada             | `_start`                     |
| `-m, --module-matching <strategy>` | Estrategia de resolución       | De `wapp.json` o `file-name` |
| `--source-dir <dir>`               | Directorio fuente `.wasm.ts`   | De `wapp.json` o `src`       |
| `--out-dir <dir>`                  | Directorio `.wasm` intermedios | De `wapp.json` o `wasm-out`  |
| `--release`                        | Modo release (optimizado)      | `false`                      |
| `--optimize-level <n>`             | Nivel de optimización 0-3      | De `wapp.json` o `3`         |
| `--shrink-level <n>`               | Nivel de reducción 0-2         | De `wapp.json`               |
| `--wasi`                           | Habilitar WASI                 | `false`                      |

### setup

Descarga y cachea la Wasmtime C-API en `~/.wasm-linker/`.

### cache

```bash
wapp cache info       # Estado de todas las capas de caché
wapp cache clear      # Limpia caché de proyecto (build + compilación)
wapp cache clear --linker  # Solo caché de descargas
wapp cache clear --all     # Todo
```

## Configuración (`wapp.json`)

| Campo            | Tipo      | Por defecto    | Descripción                                                    |
| ---------------- | --------- | -------------- | -------------------------------------------------------------- |
| `sourceDir`      | `string`  | `"src"`        | Directorio de archivos `.wasm.ts`                              |
| `outDir`         | `string`  | `"wasm-out"`   | Directorio de salida `.wasm`                                   |
| `output`         | `string`  | nombre del dir | Nombre del ejecutable                                          |
| `entry`          | `string`  | `"_start"`     | Función de entrada                                             |
| `moduleMatching` | `string`  | `"file-name"`  | Estrategia de matching                                         |
| `wasi`           | `boolean` | `false`        | Habilitar WASI                                                 |
| `mounts`         | `array`   | —              | Preopens WASI: `[{ "host", "guest" }]` (requiere `wasi: true`) |
| `target`         | `string`  | nativa         | Tripleta de compilación cruzada                                |
| `compiler`       | `object`  | —              | Flags del compilador (multi-toolchain)                         |
| `plugins`        | `array`   | —              | Plugins del pipeline                                           |
| `optimization`   | `object`  | —              | Configuración de optimización del linker                       |

## Dependencias

- `commander` — CLI argument parsing
- `glob` — búsqueda de archivos
- `picocolors` — colores en terminal
- `@wasm-apps/types` — tipos compartidos
- `@wasm-apps/compiler` — compilador AS → WASM
- `@wasm-apps/linker` — linker WASM → binario nativo
