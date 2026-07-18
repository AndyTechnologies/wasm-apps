# Guía de contribución

## Requisitos

- Node.js >= 22
- pnpm
- CMake + Ninja (o Make)
- Toolchain C++ (GCC, Clang, MSVC, o Zig)

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

| Comando                   | Descripción                           |
| ------------------------- | ------------------------------------- |
| `pnpm -r build`           | Compila todos los paquetes TypeScript |
| `pnpm lint`               | Ejecuta ESLint + Prettier             |
| `pnpm lint:fix`           | Corrige errores de linter y formato   |
| `pnpm format`             | Formatea el código con Prettier       |
| `pnpm test:unit`          | Ejecuta tests unitarios con Vitest    |
| `pnpm test:integration`   | Ejecuta tests de integración          |
| `pnpm check`              | Lint + typecheck + tests unitarios    |
| `pnpm run cli build`      | Build completo del orquestador        |
| `pnpm run compiler build` | Solo compilar AS a WASM               |
| `pnpm run linker build`   | Solo linkear WASM a binario nativo    |

### Estructura del proyecto

```
wasm-apps/
├── packages/
│   ├── types/          Tipos compartidos, logger, errores
│   ├── cli/            Orquestador CLI (wapp)
│   ├── compiler/       Compilador AS → WASM
│   └── linker/         Linker WASM → ejecutable nativo
├── examples/           Ejemplos .wasm.ts
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

## Pull requests

1. Crea una rama desde `dev`: `feature/descripcion` o `fix/descripcion`
2. Asegúrate de que `pnpm check` pase sin errores
3. Si aplica, añade un changeset con `pnpm changeset`
4. Crea el PR hacia `main`

## Testing

No hay framework de testing formal para integración. El test actual build el proyecto y ejecuta el binario resultante:

```bash
pnpm run test
```

Para tests unitarios:

```bash
pnpm run test:unit
```

## Reportar issues

Usa el tracker de GitHub para reportar bugs o sugerir mejoras.
