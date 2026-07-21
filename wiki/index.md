# Wiki de wasm-apps

Toolchain que compila AssemblyScript (`.wasm.ts`) a WebAssembly y lo enlaza en ejecutables nativos autocontenidos (ELF/PE/Mach-O) usando Wasmtime C-API.

## Entidades

| Página                                | Descripción                                        |
| ------------------------------------- | -------------------------------------------------- |
| [[overview\|Overview]]                | Síntesis del proyecto                              |
| [[entities/compiler\|Compilador]]     | Compila AS → WASM via `assemblyscript/asc`         |
| [[entities/linker\|Linker]]           | Enlaza WASM → ejecutable nativo con Wasmtime C-API |
| [[entities/cli\|CLI (wapp)]]          | Orquestador unificado del pipeline                 |
| [[entities/types\|Tipos Compartidos]] | Interfaces, errores, logger compartidos            |

## Conceptos

| Página                                                       | Descripción                                     |
| ------------------------------------------------------------ | ----------------------------------------------- |
| [[concepts/pipeline\|Pipeline]]                              | Arquitectura de tuberías (Stage<I,O>)           |
| [[concepts/caching\|Caché Incremental]]                      | Tres capas de caché (compiler, build, download) |
| [[concepts/plugin-system\|Sistema de Plugins]]               | Microkernel/Plugin via PluginManager            |
| [[concepts/cross-compilation\|Compilación Cruzada]]          | Targets multi-plataforma                        |
| [[concepts/host-functions\|Host Functions]]                  | stdlib nativa en C++                            |
| [[concepts/architecture-patterns\|Patrones Arquitectónicos]] | 6 patrones formales                             |

## Fuentes (raw)

| Página                                       | Fuente original                         |
| -------------------------------------------- | --------------------------------------- |
| [[sources/readme\|README]]                   | `README.md`                             |
| [[sources/cli-readme\|CLI README]]           | `packages/cli/README.md`                |
| [[sources/compiler-readme\|Compiler README]] | `packages/compiler/README.md`           |
| [[sources/linker-readme\|Linker README]]     | `packages/linker/README.md`             |
| [[sources/types-readme\|Types README]]       | `packages/types/README.md`              |
| [[sources/architecture\|Arquitectura]]       | `docs/explanation/architecture.md`      |
| [[sources/caching-explanation\|Caché]]       | `docs/explanation/caching.md`           |
| [[sources/how-it-works\|Cómo funciona]]      | `docs/explanation/how-it-works.md`      |
| [[sources/project-structure\|Estructura]]    | `docs/explanation/project-structure.md` |
| [[sources/cli-reference\|CLI Reference]]     | `docs/reference/cli.md`                 |
| [[sources/config\|Config (wapp.json)]]       | `docs/reference/config.md`              |
| [[sources/host-api\|Host API]]               | `docs/reference/host-api.md`            |
| [[sources/getting-started\|Getting Started]] | `docs/tutorial/getting-started.md`      |
| [[sources/github-repo\|GitHub Repo]]         | `wiki/raw/github-repo-2026-07-18.md`    |

## Artefactos generados

(Las respuestas del LLM a queries — comparaciones, análisis, síntesis — se archivan aquí.)

---

**Páginas**: 25 | **Fuentes**: 14 | **Última actualización**: 2026-07-18
