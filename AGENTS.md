# wasm-apps — Agent Instructions

Toolchain:

```
.wasm.ts|.wasm.cpp|.wasm.rs|.wasm  ──[ToolchainRouter]──>  .wasm  ──[Nunjucks + cmake-js]──>  ejecutable nativo (ELF/PE/Mach-O)
```

- **Compiler** (`ToolchainRouter` + 4 `ToolchainStrategy`): ensambla AssemblyScript (.wasm.ts/.wasm.mjs/.as), compila C++ (.wasm.cpp/.wasm.cxx/.wasm.cc) via clang++/CMake, compila Rust (.wasm.rs) via cargo, o pasa-through WASM precompilado (.wasm). Produce `{base}.{toolchainId}.wasm`.
- **Linker**: lee los `.wasm`, genera C++ con templates Nunjucks, compila con cmake-js + Wasmtime C-API.

Documentación completa del proyecto en [docs/](docs/index.md).

## Conventions

Reglas que el agente IA debe seguir al escribir código. Lo demás del proyecto (setup, arquitectura, CI, release) está documentado en `docs/`.

### TypeScript / ESM

- `"type": "module"` — usar `import`/`export`, nunca `require()`
- Imports relativos con extensión `.js`: `import { foo } from './bar.js'`
- `node:` prefix para módulos core: `import path from 'node:path'`, `import { execFile } from 'node:child_process'`
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

### Cross-platform (IMPORTANTE — el proyecto corre en Linux, macOS y Windows)

| Aspecto  | Regla                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------- |
| Rutas    | Siempre `path.join()`/`path.resolve()`. Nunca concatenar `/` o `\`. Nunca `split('/')`.             |
| Binarios | `process.platform === 'win32' ? '.exe' : ''`                                                        |
| Temp     | `os.tmpdir()`, nunca `/tmp`                                                                         |
| Signals  | `SIGINT`/`SIGTERM` solo con `if (process.platform !== 'win32')`                                     |
| mkdir/rm | Siempre `{ recursive: true }`; `rmSync` con `{ force: true }`                                       |
| Newlines | `os.EOL` para archivos generados                                                                    |
| Commands | `execFile`/`execFileSync` evitan el shell. Para procesos largos, `node:child_process` directamente. |

## Skills Index

Cuando trabajes en este proyecto, carga la skill relevante ANTES de escribir código.

| Skill                  | Cuándo usarla                                                                  | Ruta                                                                           |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `branch-pr`            | Al crear un PR, abrir un branch, o preparar cambios para review.               | [`skills/branch-pr/SKILL.md`](skills/branch-pr/SKILL.md)                       |
| `chained-pr`           | Cuando un cambio es demasiado grande (>400 líneas) o requiere PRs encadenados. | [`skills/chained-pr/SKILL.md`](skills/chained-pr/SKILL.md)                     |
| `cognitive-doc-design` | Al escribir documentación que debe reducir carga cognitiva.                    | [`skills/cognitive-doc-design/SKILL.md`](skills/cognitive-doc-design/SKILL.md) |
| `comment-writer`       | Al redactar comentarios humanos, feedback de PR, o respuestas a issues.        | [`skills/comment-writer/SKILL.md`](skills/comment-writer/SKILL.md)             |
| `issue-creation`       | Al crear un issue de GitHub, reportar un bug, o solicitar una feature.         | [`skills/issue-creation/SKILL.md`](skills/issue-creation/SKILL.md)             |
| `work-unit-commits`    | Al dividir implementación en commits entregables o PRs encadenados.            | [`skills/work-unit-commits/SKILL.md`](skills/work-unit-commits/SKILL.md)       |

## Wiki (LLM persistence)

Wiki persistente en `wiki/` para contexto entre sesiones. Formato markdown con cross-references estilo Obsidian (`[[page]]`).

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
