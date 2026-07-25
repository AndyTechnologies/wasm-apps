# Guía de contribución

## Requisitos

- Node.js >= 22
- pnpm
- CMake + Ninja (o Make)
- Toolchain C++ (GCC, Clang, MSVC o Zig)
- (opcional) Rust toolchain para tests de integración Rust
- (opcional) clang++ para tests de integración C++

## Setup inicial

```bash
git clone <repo>
cd wasm-apps
pnpm install
pnpm -r build
pnpm run linker setup
```

## Desarrollo

### Comandos disponibles

| Comando                     | Descripción                                             |
| --------------------------- | ------------------------------------------------------- |
| `pnpm -r build`             | Compila todos los paquetes TypeScript                   |
| `pnpm check`                | Prettier + build + vitest run                           |
| `pnpm lint` / `pnpm format` | Prettier check / write                                  |
| `pnpm test:unit`            | Tests unitarios (vitest)                                |
| `pnpm test:integration`     | Build + ejecuta binarios de `examples/` multi-toolchain |
| `pnpm run cli build`        | Build completo vía orquestador                          |
| `pnpm run compiler build`   | Solo compilar fuentes a WASM                            |
| `pnpm run linker build`     | Solo linkear WASM a binario nativo                      |

### Estructura del proyecto

```
wasm-apps/
├── packages/
│   ├── types/          Tipos compartidos, logger, errores
│   ├── cli/            Orquestador CLI (wapp)
│   ├── compiler/       Compilador multi-toolchain (ToolchainRouter + strategies)
│   │   └── src/strategies/  AssemblyScript, C++, Rust, Precompilado
│   └── linker/         Linker WASM → ejecutable nativo (Nunjucks + Wasmtime)
├── examples/           Ejemplos multi-lenguaje (.wasm.ts, .wasm.cpp, .wasm.rs)
├── skills/             AI agent skills (ver AGENTS.md)
├── docs/               Documentación (formato Diátaxis)
└── scripts/            Scripts auxiliares
```

## Convenciones de código

Ver [AGENTS.md](./AGENTS.md) para las convenciones detalladas:

- TypeScript ESM con imports relativos usando extensión `.js`
- `camelCase` para funciones/variables, `PascalCase` para tipos/clases
- Archivos en `kebab-case.ts`
- CLI commands en `snake-case`
- Usar clases de error de `@wasm-apps/types`
- Usar `logger` de `@wasm-apps/types` para toda salida al usuario
- Ejecución de comandos con `execFile`/`execFileSync`, nunca shell
- Rutas siempre con `path.join()`/`path.resolve()` (cross-platform)

## Pull requests

1. Crea una rama desde `dev`: `feature/descripcion` o `fix/descripcion`
2. Asegúrate de que `pnpm check` pase sin errores
3. Si aplica, añade un changeset con `pnpm changeset`
4. Crea el PR hacia `main`

## Testing

### Unit tests

```bash
pnpm test:unit
```

Vitest con `globals: true` en `packages/*/src/**/*.test.ts`.

### Integration tests

```bash
pnpm test:integration
```

Compila y ejecuta ejemplos multi-toolchain (AS, C++, Rust) desde `examples/`. Necesita `pnpm run linker setup` previo.

## Reportar issues

Usa el tracker de GitHub para reportar bugs o sugerir mejoras.
