# Estructura del proyecto

```
wasm-apps/
├── packages/
│   ├── types/          # Tipos compartidos, logger, clases de error
│   ├── cli/            # CLI orquestador (wapp)
│   ├── compiler/       # Compilador AS → WASM
│   └── linker/         # Linker WASM → binario nativo
├── examples/           # Archivos .wasm.ts de ejemplo
├── scripts/            # Scripts de build y test
├── .wapp_cache/        # Caché del compilador (gitignored)
├── .wapp_build/        # Manifiesto de build (gitignored)
└── wapp.json           # Configuración del proyecto
```

## Orden de dependencias entre paquetes

```
types ← compiler
types ← cli
types ← linker
cli    ← compiler
cli    ← linker
```

Todos los paquetes se publican juntos con la misma versión via Changesets.

## Resolución de módulos

Los archivos fuente se emparejan con imports WASM usando la estrategia `moduleMatching`:

- **`file-name`** (por defecto): el nombre del import se resuelve contra el nombre del archivo de cada `.wasm` compilado
- **`name-only`**: los módulos se emparejan puramente por su nombre exportado

Esto determina cómo el linker mapea llamadas de import entre múltiples módulos WASM.
