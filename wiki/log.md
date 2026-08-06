# Log de wasm-apps

## [2026-07-18] ingest | Inicialización del wiki

- Ingest de las fuentes existentes: README.md, docs/, y READMEs de los 4 paquetes
- Creadas páginas de entidades: compiler, linker, cli, types
- Creadas páginas de conceptos: pipeline, caching, plugin-system, cross-compilation, host-functions, architecture-patterns
- Creado index.md y log.md
- Configurada sección LLM Wiki en AGENTS.md

## [2026-07-18] lint | Revisión de consistencia del wiki

- Páginas afectadas: [[index]], [[entities/compiler]], [[entities/linker]], [[entities/cli]], [[entities/types]], [[concepts/host-functions]], [[sources/architecture]], [[sources/caching-explanation]], [[sources/how-it-works]], [[sources/project-structure]], [[sources/cli-reference]], [[sources/config]], [[sources/host-api]], [[sources/getting-started]]
- Corregido contador de páginas en index.md (12 → 16)
- Añadido comando `dev` faltante en entities/cli.md
- Añadidas cross-references entre entities y concepts (compiler → caching + architecture-patterns, linker → pipeline + caching + plugin-system + cross-compilation + host-functions, cli → architecture-patterns)
- Añadidos inbound links a páginas huérfanas (types, host-functions, cross-compilation)
- Creadas 8 fuentes faltantes para docs/ (architecture, caching-explanation, how-it-works, project-structure, cli-reference, config, host-api, getting-started)

## [2026-07-18] ingest | GitHub Repository Page

- Páginas afectadas: [[overview]], [[sources/github-repo]], [[raw/github-repo-2026-07-18]]
- Capturada metadata del repositorio GitHub: 68 commits, 4 releases (v1.3.1), licencia MIT, TypeScript 87.9%
- Actualizado overview.md con releases, CI y stats
- Registrada fuente en raw/ + sources/

## [2026-07-18] lint | Segunda revisión de consistencia

- Páginas afectadas: [[index]], [[overview]], [[concepts/pipeline]], [[concepts/caching]], [[concepts/plugin-system]], [[concepts/cross-compilation]], [[sources/github-repo]]
- Corregido contador en index.md (16 → 25)
- overview.md: añadidos links a entities y concepts
- concepts/pipeline.md: añadido link a entities/linker.md, concepts/plugin-system.md, concepts/architecture-patterns.md
- concepts/caching.md: añadidos links a entities/compiler.md, entities/linker.md, concepts/architecture-patterns.md
- concepts/plugin-system.md: añadidos links a entities/linker.md, concepts/pipeline.md, concepts/architecture-patterns.md
- concepts/cross-compilation.md: añadido link a entities/linker.md
- sources/github-repo.md: añadido link directo a raw/

## [2026-07-18] lint | Cuarta revisión — enlace faltante en sources/getting-started.md

- Páginas afectadas: [[sources/getting-started]]
- sources/getting-started.md: añadido link a overview para mantener consistencia con las otras 13 fuentes

## [2026-07-18] lint | Tercera revisión — cross-references menores

- Páginas afectadas: [[overview]], [[concepts/caching]], [[concepts/host-functions]], [[concepts/architecture-patterns]], [[sources/github-repo]]
- overview.md: añadidos links a concepts/pipeline, concepts/caching
- concepts/caching.md: añadido link a concepts/plugin-system
- concepts/host-functions.md: añadido link a concepts/plugin-system
- concepts/architecture-patterns.md: añadidos links a entities/compiler, entities/linker, entities/cli
- sources/github-repo.md: añadido link a overview

## [2026-08-06] actualizacion-por-codigo | Feature web-console-fs-api-examples (bindings inyectadas + mounts WASI)

- Páginas afectadas: [[entities/compiler]], [[entities/linker]], [[entities/cli]], [[entities/types]], [[concepts/host-functions]], [[overview]], [[index]]
- entities/compiler.md: añadida sección "Bindings inyectadas" (console/fs/wasi: rewrite de imports AS, `-I` C++, crate vendido `wasm_apps_bindings` en Rust)
- entities/linker.md: añadida sección "Preopens WASI (mounts)" (validación ConfigError, hosts relativos al cwd del build, `wasi_config.preopen_dir` con READ|WRITE, mounts en el build manifest) y `mounts` en NativeAppOptions
- entities/cli.md: nota de passthrough de `config.mounts` al linker
- entities/types.md: añadido `MountSpec` a la tabla de tipos
- concepts/host-functions.md: añadida sección "Bindings inyectadas (console/fs/wasi)"
- overview.md: bindings y mounts en componentes/diferenciadores
- index.md: actualizado pie de actualización (2026-08-06)
