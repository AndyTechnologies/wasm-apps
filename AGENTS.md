# AGENTS.md — wasm-apps

Toolchain: `.wasm.ts` → **compiler** (AssemblyScript/asc) → `.wasm` → **linker** (C++ codegen + cmake-js) → ejecutable nativo (ELF/PE/Mach-O) via Wasmtime C-API.

## Arquitectura

```
wasm-apps/
├── packages/
│   ├── types/       # Tipos compartidos, logger, clases de error
│   ├── cli/         # Orquestador wapp (Command Pattern)
│   ├── compiler/    # Compilador AS → WASM (assemblyscript/asc como librería)
│   └── linker/      # Linker WASM → ejecutable nativo
├── examples/        # Proyectos de ejemplo para tests de integración
├── docs/            # Documentación Diátaxis
├── scripts/         # test-examples.mjs
└── wiki/            # LLM wiki persistente (ver sección abajo)
```

Entrypoints: `packages/cli/src/cli.ts` (CLI `wapp`), `packages/compiler/src/index.ts` (`compileWasm`), `packages/linker/src/index.ts` (`createNativeApp`).

Patrones: Command (CLI), Repository (caché), Strategy (compiler/linker/codegen), Builder (NativeAppBuilder), Pipeline (Stage<I,O>), Microkernel/Plugin (PluginManager + WasmPlugin).

## Desarrollo

### Setup

```bash
pnpm install
pnpm -r build                    # Compila todos los paquetes (tsc)
pnpm run linker setup             # Descarga Wasmtime C-API (~15 MB)
```

### Comandos

| Comando                                   | Qué hace                                                     |
| ----------------------------------------- | ------------------------------------------------------------ |
| `pnpm -r build`                           | Compila todos los paquetes con tsc (también es el typecheck) |
| `pnpm check`                              | `prettier --check .` + build + `vitest run`                  |
| `pnpm lint` / `pnpm format`               | Prettier check / write                                       |
| `pnpm test:unit`                          | `vitest run`                                                 |
| `pnpm test:integration`                   | Build + ejecuta binarios de `examples/` via node             |
| `pnpm run cli build`                      | Build completo vía orquestador                               |
| `pnpm run compiler build <file> -o <dir>` | Solo compilar AS → WASM                                      |
| `pnpm run linker build <wasm> -o <bin>`   | Solo linkear WASM → binario                                  |

### Testing

- **Unit tests**: vitest con `globals: true`, busca `packages/*/src/**/*.test.ts`
- **Integration tests**: compila y ejecuta los ejemplos en `examples/`. Necesita `pnpm run linker setup` previo (cmake + wasmtime descargado).
- tsconfig **excluye** `src/*.test.ts` de la compilación (`tsc` los salta), vitest los incluye por separado.

### CI (`.github/workflows/ci.yml`)

- **Push a `dev` o `main`** y **PR hacia `main`** gatillan CI.
- 3 jobs encadenados: `lint` (pnpm check en ubuntu) → `unit-tests` (ubuntu, macos, windows matrix) → `integration-tests` (ubuntu + macOS, necesita cmake + setup).
- Cache de wasmtime (`~/.wasm-linker/`) keyeado por runner + CMakeLists.txt.
- Node 24 + pnpm.

### Release (`.github/workflows/release.yml` + `.github/workflows/auto-pr.yml`)

El release flow reemplazó Changesets por un workflow automático:

1. Hacer un commit con mensaje `Release v{version}` en `dev`.
2. `auto-pr.yml` detecta el patrón y crea automáticamente un PR de `dev` → `main`.
3. Al mergear el PR, `release.yml` publica a npm con Trusted Publisher (`--provenance`) y crea un GitHub Release.

**Detalles**:

- Solo se publican los packages cuya versión cambió respecto a npm. Si ninguno cambió, el workflow falla.
- 4 paquetes publicados independientemente, acceso público, OIDC/Trusted Publishers.
- No se necesita NPM_TOKEN — usa `id-token: write` para provenance.

### Rama y PR

- `main` = estable. `dev` = trabajo diario. Merge PRs de `dev` → `main`.
- `pnpm check` debe pasar antes del PR.

## Convenciones de código

### TypeScript / ESM

- `"type": "module"` — usar `import`/`export`, nunca `require()`
- Imports relativos con extensión `.js`: `import { foo } from './bar.js'`
- `node:` prefix: `import path from 'node:path'`, `import { execFile } from 'node:child_process'`
- Ejecución de comandos: `execFile`/`execFileSync` de `node:child_process`. No se usa `cross-spawn`.

### Errores

Usar clases de `@wasm-apps/types`: `CompilerError`, `LinkerError`, `ConfigError`, `CMakeError`, `DownloadError`.

### Logging

Usar `logger` de `@wasm-apps/types`:

```ts
logger.info(msg); // cyan
logger.success(msg); // green
logger.warn(msg); // yellow
logger.error(msg); // red
logger.step(msg); // bold blue
logger.detail(msg); // dim
```

### Commits

```
tipo(scope): mensaje en español
```

Tipos: `feat | fix | chore | docs | refactor`. Scopes: `compiler | linker | cli | types | root`.

Antes del commit: `pnpm -r build` debe pasar.

### Cross-platform (IMPORTANTE)

Este proyecto corre en Linux, macOS y Windows.

- **Rutas**: siempre `path.join()`/`path.resolve()`. Nunca concatenar `/` o `\`. Nunca `split('/')`.
- **Binarios**: añadir `.exe` con `process.platform === 'win32' ? '.exe' : ''`
- **Temp**: `os.tmpdir()`, nunca `/tmp`
- **Signals**: envolver `SIGINT`/`SIGTERM` con `if (process.platform !== 'win32')`
- **mkdir/rm**: `{ recursive: true }` siempre; `rmSync` con `{ force: true }`
- **Newlines**: `os.EOL` para archivos generados
- **Commands**: `execFile`/`execFileSync` evitan el shell. Para procesos largos no hay wrapper de spawn — usar directamente `node:child_process`.

## Caché incremental

Tres capas independientes, gestionables vía `wapp cache info` / `wapp cache clear`:

| Capa         | Ubicación                         | Clave                        | Propósito                                                   |
| ------------ | --------------------------------- | ---------------------------- | ----------------------------------------------------------- |
| Compiler     | `.wapp_cache/compiler/{sha256}/`  | SHA-256 de source + flags    | Evita recompilar AS con `asc.main()`                        |
| Linker build | `.wapp_build/build-manifest.json` | Hashes de `.wasm` + opciones | Evita regenerar binario si nada cambió                      |
| Download     | `~/.wasm-linker/`                 | —                            | Wasmtime C-API descargada (se re-descarga con `wapp setup`) |

Cada capa implementa `ICacheRepository<T>` y tiene su propio repositorio (`CompilerCacheRepository`, `LinkerManifestRepository`, `DownloadCacheRepository`).

## wapp.json

Configuración del proyecto (generado por `wapp init`):

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
    "shrinkLevel": 0,
    "sourceMap": true
  }
}
```

## graphify

Este proyecto tiene un grafo de conocimiento en `graphify-out/`. Para preguntas de código:

1. Usar `codegraph_explore` MCP tool cuando esté disponible.
2. Si no, `graphify query "<pregunta>"`, `graphify path "<A>" "<B>"`, `graphify explain "<concepto>"`.
3. Después de modificar código: `graphify update .` (solo AST, sin costo de API).
4. Existe `graphify-out/wiki/index.md` para navegación general.

## LLM Wiki (`wiki/`)

Wiki persistente de documentación en markdown con cross-references estilo Obsidian (`[[page]]`).

Estructura:

```
wiki/
├── index.md         # Catálogo de páginas
├── log.md           # Append-only: operaciones del wiki
├── overview.md      # Síntesis del proyecto
├── entities/        # Componentes (compiler, linker, cli, types)
├── concepts/        # Ideas transversales (pipeline, caching, plugins...)
├── sources/         # Fuentes ingestadas (inmutables)
└── artifacts/       # Respuestas archivadas del LLM
```

Workflows:

- **Ingest**: leer fuente, actualizar páginas + `index.md`, añadir a `log.md`.
- **Lint**: buscar contradicciones, claims obsoletos, páginas huérfanas.
- **Actualización por código**: revisar `git diff`, actualizar entidades/conceptos afectados.

## Notas

- Linter: solo Prettier (el ESLint config existe pero NO se ejecuta en CI).
- `pnpm run cli build` = orquestador completo (compiler + linker). Útil para desarrollo.
- El CLI se puede instalar global: `pnpm install --global ./packages/cli` → `wapp` disponible.
- Host functions implementadas en C++ para console, Math, Date, Performance, Process, seed.
- Soporta cross-compilation via targets como `x86_64-linux-gnu`, `aarch64-macos`, etc.
