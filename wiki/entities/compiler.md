# Compilador (`@wasm-apps/compiler`)

Compila archivos AssemblyScript (`.wasm.ts`, `.ts`, `.asm`) a WebAssembly binario usando `assemblyscript/asc` como librería (no como CLI).

## API principal

`compileWasm(options: CompileOptions): Promise<CompileResult>`

| Campo          | Tipo         | Descripción                |
| -------------- | ------------ | -------------------------- |
| `wasmBytes`    | `Uint8Array` | Binario WASM compilado     |
| `dtsContent`   | `string`     | Declaraciones TS generadas |
| `bindingsJs`   | `string`     | Bindings JS generados      |
| `sourceMap`    | `string`     | Sourcemap (opcional)       |
| `dependencies` | `string[]`   | Dependencias resueltas     |
| `hash`         | `string`     | SHA-256 del código fuente  |

## Caché

Dos niveles:

1. **LRU en memoria** — clave por `fileName`, hasta 100 entradas
2. **Disco** — en `.wapp_cache/compiler/{sha256}/`, clave basada en código fuente + flags de compilación

Ver [[concepts/caching|Caché Incremental]].

## CLI

```bash
pnpm run compiler build <files...> [options]
pnpm run compiler watch <files...> [options]
```

## Dependencias clave

- `assemblyscript` — compilador AS
- `commander` — CLI argument parsing
- `glob` — búsqueda de archivos
- `@wasm-apps/types` — [[entities/types|Tipos Compartidos]]

## Estrategia

Implementa `ICompilerStrategy` (Strategy Pattern). Actualmente solo existe `AssemblyScriptCompilerStrategy`, pero la interfaz permite añadir compiladores alternativos (Rust, Zig, etc.). Ver [[concepts/architecture-patterns|Patrones Arquitectónicos]].
