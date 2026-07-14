# AGENTS.md — wasm-apps

## Descripción del proyecto

Toolchain que compila AssemblyScript (`.wasm.ts`) a WebAssembly y lo enlaza en ejecutables nativos autocontenidos (ELF/PE/Mach-O) usando Wasmtime C-API.

Pipeline: `.wasm.ts` → **compiler** (assemblyscript/asc) → `.wasm` → **linker** (codegen C++ + cmake-js) → binario nativo

## Arquitectura

```
wasm-apps/
├── packages/
│   ├── types/          # Tipos compartidos, logger, clases de error
│   │   └── src/
│   │       └── index.ts, logger.ts
│   ├── cli/            # Orquestador wapp
│   │   └── src/
│   │       ├── cli.ts      # Comandos (init/build/setup/cache)
│   │       └── index.ts    # Lógica (resolveConfig, buildProject, cacheInfo)
│   ├── compiler/       # Compilador AS → WASM
│   │   └── src/
│   │       ├── index.ts     # compileWasm() — API principal
│   │       ├── cli.ts       # CLI build/watch
│   │       ├── cache.ts     # LRU cache en memoria
│   │       ├── disk-cache.ts # Caché persistente en .wapp_cache/compiler/
│   │       └── utils.ts     # hashString, resolveImportPath, parseExports
│   └── linker/         # Linker WASM → ejecutable nativo
│       └── src/
│           ├── index.ts      # createNativeApp() — API principal
│           ├── cli.ts        # CLI build/watch/setup/status/cache
│           ├── build-cache.ts # Manifiesto en .wapp_build/build-manifest.json
│           ├── codegen.ts    # Generación de C++ con host functions
│           ├── linker.ts     # Resolución de dependencias (topological sort)
│           ├── wasm-io.ts    # Parseo de módulos WASM
│           ├── compiler.ts   # Compilación C++ con cmake-js
│           ├── wasmtime-dl.ts # Descarga/cache de Wasmtime C-API
│           ├── downloader.ts  # HTTP download con reanudación
│           ├── extract.ts     # Extracción tar.xz/zip
│           ├── setup.ts       # Setup de dependencias
│           └── cache.ts       # Gestión de caché en disco (~/.wasm-linker/)
├── examples/            # .wasm.ts de ejemplo
├── scripts/             # Scripts auxiliares (run-built-bin.mjs)
└── wapp.json            # Configuración de ejemplo del proyecto
```

## Desarrollo

### Setup inicial

```bash
pnpm install
pnpm -r build        # Compila todos los paquetes TypeScript
pnpm run linker setup  # Descarga Wasmtime C-API
```

### Comandos comunes

```bash
pnpm run cli build                    # Build completo vía orquestador
pnpm run cli build --release          # Build release optimizado
pnpm run cli cache info               # Ver estado de las 3 cachés
pnpm run cli cache clear              # Limpiar todas las cachés
pnpm run compiler build <file> -o <dir>  # Solo compilar
pnpm run linker build <wasm> -o <bin>    # Solo linkear
pnpm run test                         # Build + ejecutar binario
```

## Caché incremental

### Compiler cache (`.wapp_cache/compiler/`)
- **Ubicación**: proyecto-local, dentro de `.wapp_cache/compiler/`
- **Clave**: SHA-256 de `{sourceCode, runtime, isDev, sourceMap, optimizeLevel, shrinkLevel}`
- **Almacenamiento**: un directorio por clave con `result.json`, `out.wasm`, `out.d.ts`, `out.js`, `out.wasm.map`
- **Invalidación automática**: cualquier cambio en source o flags cambia la clave
- **Gestión**: `wapp cache info` / `wapp cache clear`
- **Archivo clave**: `packages/compiler/src/disk-cache.ts`

### Linker build cache (`.wapp_build/build-manifest.json`)
- **Ubicación**: proyecto-local, dentro de `.wapp_build/build-manifest.json`
- **Manifiesto**: contiene hashes de todos los `.wasm` de entrada + opciones (entry, target, wasi, moduleMatching, wasmtimePath, wasmtimeVersion) + hash del binario generado
- **Invalidación**: cualquier cambio en `.wasm` o en opciones regenera el binario
- **Gestión**: `wapp cache info` / `wapp cache clear`
- **Archivo clave**: `packages/linker/src/build-cache.ts`

### Download cache (`~/.wasm-linker/`)
- **Ubicación**: global en `~/.wasm-linker/`
- **Contenido**: Wasmtime C-API descargada
- **Gestión**: `wapp cache clear` la elimina; `wapp setup` la regenera
- **Archivo clave**: `packages/linker/src/cache.ts`

## Convenciones de código

### TypeScript
- `"type": "module"` en todos los packages → usar `import`/`export` ESM
- Extensiones `.js` en imports locales: `import { foo } from './bar.js'` (aunque el源码 sea `.ts`)
- Sin sintaxis `require()`; usar `import` siempre
- `node:` prefix para módulos built-in: `import path from 'node:path'`

### Nombrado
- `camelCase` para funciones y variables
- `PascalCase` para tipos, interfaces, clases
- Archivos: `kebab-case.ts`
- CLI commands: `snake-case` (e.g., `--source-dir`, `--optimize-level`)

### Errores
Usar las clases de error en `@wasm-apps/types`:
- `CompilerError` — errores del compilador AS
- `LinkerError` — errores del linker
- `ConfigError` — errores de configuración
- `CMakeError` — errores de cmake
- `DownloadError` — errores de descarga

### Logging
Usar `logger` de `@wasm-apps/types`:
```ts
logger.info(msg)      // cyan
logger.success(msg)   // green
logger.warn(msg)      // yellow
logger.error(msg)     // red
logger.step(msg)      // bold blue
logger.detail(msg)    // dim
```

### Testing
```bash
pnpm run test    # Build + ejecuta binario compilado
```

No hay framework de testing formal — el test actual build el proyecto y ejecuta el binario resultante.

## Reglas multiplataforma

Este proyecto debe funcionar en **Linux**, **macOS** y **Windows**.

### Rutas de archivo
- Usar SIEMPRE `path.join()`, `path.resolve()`, `path.basename()`, `path.parse()`
- NUNCA concatenar strings con `/` o `\`
- NUNCA usar `split('/')` o `replace()` para manipular separadores de ruta
- Normalizar con `path.normalize()` cuando se reciban paths de fuentes externas (callbacks de `fs.watch`, input de usuario)

### Ejecución de comandos
- Usar `cross-spawn` para `spawn()` (import from `cross-spawn`)
- Para exec sincrónico simple: `child_process.execFileSync()` (evita el shell)
- Añadir `.exe` en Windows: `process.platform === 'win32' ? '.exe' : ''`
- Envolver `process.on('SIGINT'/'SIGTERM')` con `if (process.platform !== 'win32')`

### Platform detection
- Usar `process.platform` o `os.platform()` (devuelven `'win32'`, `'darwin'`, `'linux'`)
- Para binarios: `process.platform === 'win32'` para decidir extensión
- Para rutas de caché: `os.homedir()` para directorio home
- Para temp: `os.tmpdir()` — NUNCA `/tmp`

### Linting implícito
- `fs.mkdirSync` con `{ recursive: true }` para crear directorios
- `fs.rmSync` con `{ recursive: true, force: true }` para eliminar directorios
- Evitar `fs.chmod`/`fs.chown` (no portables)
- Usar `os.EOL` para join de líneas en archivos generados

## Commits

Formato: `tipo(scope): mensaje en español`

Tipos:
- `feat` — nueva funcionalidad
- `fix` — corrección
- `chore` — tareas de mantenimiento
- `docs` — documentación
- `refactor` — refactorización

Scope: `compiler`, `linker`, `cli`, `root`, `types`

Ejemplos:
```
feat(compiler): caché de disco proyecto-local para compilación incremental
fix(linker): usar path.parse() en vez de split('/') para rutas Windows
chore: ignorar .wapp_cache/ en gitignore
```

Antes de cada commit:
1. `pnpm -r build` debe pasar sin errores
2. Verificar que el binario se ejecute (`pnpm run test` si aplica)

## Dependencias clave

| Paquete | Propósito |
|---------|-----------|
| `assemblyscript` | Compilador AS → WASM (usado como librería, no CLI) |
| `commander` | CLI argument parsing |
| `cmake-js` | Integración CMake con Node.js |
| `cross-spawn` | Spawn multiplataforma |
| `picocolors` | Colores en terminal |
| `command-exists` | Detectar binarios en PATH |
| `ora` | Spinners de terminal |
| `glob` | Búsqueda de archivos con glob patterns |
| `tar` | Extracción de archivos tar |

## Estructura del wapp.json

```json
{
  "sourceDir": "src",
  "outDir": "wasm-out",
  "output": "mi-app",
  "entry": "_start",
  "moduleMatching": "file-name",
  "wasi": false,
  "target": "x86_64-linux",
  "wasmtimePath": "/ruta/personalizada",
  "compiler": {
    "release": false,
    "runtime": "incremental",
    "optimizeLevel": 3,
    "shrinkLevel": 0,
    "sourceMap": true
  }
}
```

## Preguntas frecuentes para IA

**Q**: ¿Dónde está el punto de entrada del CLI?
**A**: `packages/cli/src/cli.ts` — define comandos con Commander. La lógica está en `packages/cli/src/index.ts`.

**Q**: ¿Cómo añadir un nuevo comando al CLI?
**A**: 1) Añadir la lógica en el `index.ts` del scope correspondiente. 2) Registrar el comando en el `cli.ts`. 3) Exportar e importar la función.

**Q**: ¿Cómo funciona el caché del compilador?
**A**: `disk-cache.ts` calcula un SHA-256 del source + flags. Si existe en `.wapp_cache/compiler/{key}/`, retorna los artefactos sin invocar `asc.main()`. Ver `compileWasm()` en `compiler/src/index.ts`.

**Q**: ¿Cómo funciona el caché del linker?
**A**: `build-cache.ts` guarda un manifiesto JSON en `.wapp_build/build-manifest.json` con hashes de los `.wasm` de entrada y opciones. `isBuildUpToDate()` compara el estado actual vs el manifiesto. Si coincide, `createNativeApp()` retorna inmediatamente.

**Q**: ¿Dónde se gestionan las cachés desde el CLI?
**A**: En `packages/cli/src/index.ts`, las funciones `cacheInfo()` y `clearCache()` integran las 3 capas.

**Q**: ¿Qué debo tener en cuenta para Windows?
**A**: Ver sección "Reglas multiplataforma" arriba. Atención especial a: separadores de ruta, extensión `.exe`, comandos shell, y signals.
