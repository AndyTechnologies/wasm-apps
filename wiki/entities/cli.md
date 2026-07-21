# CLI (`@wasm-apps/cli`)

Orquestador `wapp` que coordina el pipeline completo: descubre archivos `.wasm.ts`, los compila a WASM y linkea un ejecutable nativo.

## Comandos

| Comando                | Descripción                                |
| ---------------------- | ------------------------------------------ |
| `wapp init [dir]`      | Crea `wapp.json` con valores por defecto   |
| `wapp build [options]` | Compila + linkea                           |
| `wapp dev [options]`   | Build + watch con recompilación automática |
| `wapp setup`           | Descarga Wasmtime C-API                    |
| `wapp cache info`      | Estado de todas las cachés                 |
| `wapp cache clear`     | Limpia cachés                              |

## API pública

| Función                              | Descripción                                                         |
| ------------------------------------ | ------------------------------------------------------------------- |
| `resolveConfig(rootDir, overrides?)` | Resuelve configuración combinando `wapp.json` + defaults + CLI args |
| `initProject(rootDir, overrides?)`   | Crea `wapp.json`                                                    |
| `buildProject(options)`              | Pipeline completo de build                                          |
| `devCommand(options)`                | Build + watch con recompilación automática                          |
| `cacheInfo()`                        | Estado de las 3 capas de caché                                      |
| `clearCache(options?)`               | Limpia caché(es) específicas                                        |

## Arquitectura interna

Usa **Command Pattern**: cada operación es un objeto `ICommand` independiente. El invocador (`cli.ts`) parsea args con Commander, obtiene el comando del registro y lo ejecuta. Ver [[concepts/architecture-patterns|Patrones Arquitectónicos]].

## Dependencias

- `commander` — CLI argument parsing
- `glob` — búsqueda de archivos
- `@wasm-apps/types` — [[entities/types|Tipos Compartidos]]
- `@wasm-apps/compiler` — [[entities/compiler|Compilador]]
- `@wasm-apps/linker` — [[entities/linker|Linker]]
