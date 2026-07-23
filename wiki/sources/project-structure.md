# Fuente: Estructura del proyecto

**Ruta**: `docs/explanation/project-structure.md`
**Propósito**: Describe la estructura de directorios y dependencias entre paquetes.

## Contenido extraído

- Árbol de directorios (packages/, examples/, scripts/, .wapp_cache/, .wapp_build/)
- Orden de dependencias: types ← compiler, types ← cli, types ← linker, cli ← compiler, cli ← linker
- Todos los paquetes se versionan juntos via Changesets
- Resolución de módulos: `file-name` vs `name-only`

Ver [[overview|Overview]] para la síntesis.
