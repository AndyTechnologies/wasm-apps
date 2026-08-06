# Estructura del proyecto

```
wasm-apps/
├── packages/
│   ├── types/                # Tipos compartidos, logger, clases de error
│   ├── cli/                  # CLI orquestador (wapp)
│   ├── compiler/             # Compilador multi-toolchain
│   │   └── src/
│   │       ├── bindings/     # Bindings inyectados console/fs/wasi (AS, C++, Rust vendido)
│   │       ├── strategies/   # ToolchainStrategy implementations
│   │       │   ├── assemblyscript-strategy.ts  # AS (asc)
│   │       │   ├── cpp-strategy.ts             # C++ (clang++/CMake)
│   │       │   ├── rust-strategy.ts            # Rust (cargo)
│   │       │   ├── precompiled-strategy.ts     # .wasm passthrough
│   │       │   └── toolchain-strategy.ts       # Interfaz base
│   │       └── toolchain-router.ts             # Router Microkernel
│   └── linker/               # Linker WASM → binario nativo
│       └── templates/        # Templates Nunjucks para C++ (main.c.njk genera preopens)
├── examples/                 # Archivos de ejemplo multi-lenguaje
│   ├── cpp-saludo/           # C++ con bindings inyectadas
│   ├── rust-hello/           # Rust con bindings inyectadas
│   ├── as-fs/                # AssemblyScript + filesystem WASI (mounts)
│   ├── rust-fs/              # Rust + filesystem WASI (mounts)
│   ├── mounts-demo/          # C++ + filesystem WASI (mounts)
│   ├── multi-toolchain/      # AS + C++ en un mismo build
│   ├── precompiled/          # WASM precompilado pasa-through
│   ├── custom-template/      # Template Nunjucks personalizado
│   └── plugin-*/             # Ejemplos de plugins
├── skills/                   # AI agent skills (ver AGENTS.md)
├── scripts/                  # Scripts de build y test (test-examples.mjs)
├── .wapp_cache/              # Caché del compilador (gitignored)
├── .wapp_build/              # Manifiesto de build (gitignored)
└── wapp.json                 # Configuración del proyecto
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

## Toolchains disponibles

| Toolchain      | Extensiones                          | Compilador                           | Salida intermedia  |
| -------------- | ------------------------------------ | ------------------------------------ | ------------------ |
| AssemblyScript | `.wasm.ts`, `.wasm.mjs`, `.as`       | `assemblyscript/asc`                 | `{base}.wasm`      |
| C++            | `.wasm.cpp`, `.wasm.cxx`, `.wasm.cc` | clang++ / CMake                      | `{base}.cpp.wasm`  |
| Rust           | `.wasm.rs`                           | cargo (wasm32-unknown-unknown)       | `{base}.rust.wasm` |
| Precompilado   | `.wasm`                              | Passthrough (validación magic bytes) | `{base}.wasm`      |
