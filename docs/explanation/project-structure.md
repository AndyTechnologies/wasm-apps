# Project structure

```
wasm-apps/
├── packages/
│   ├── types/          # Shared types, logger, error classes
│   ├── cli/            # Orchestrator CLI (wapp)
│   ├── compiler/       # AS → WASM compiler
│   └── linker/         # WASM → native binary linker
├── examples/           # Sample .wasm.ts files
├── scripts/            # Build and test helpers
├── .wapp_cache/        # Compiler cache (gitignored)
├── .wapp_build/        # Build manifest (gitignored)
└── wapp.json           # Project configuration
```

## Package dependency order

```
types ← compiler
types ← cli
types ← linker
cli    ← compiler
cli    ← linker
```

All packages publish together with the same version via Changesets.

## Module resolution

Source files are matched to WASM imports using the `moduleMatching` strategy:

- **`file-name`** (default): the import name is resolved against the filename stem of each compiled `.wasm`
- **`name-only`**: modules are matched purely by their exported name

This determines how the linker maps import calls across multiple WASM modules.
