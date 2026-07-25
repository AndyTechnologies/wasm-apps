# Compilador (`@wasm-apps/compiler`)

Compila archivos fuente multi-lenguaje a WebAssembly binario usando un **ToolchainRouter** (Microkernel + Strategy Pattern).

## ToolchainRouter

El router enruta cada archivo a la estrategia de compilación correcta según su extensión (longest-suffix-first):

| Estrategia                        | Extensiones                          | Compilador                                |
| --------------------------------- | ------------------------------------ | ----------------------------------------- |
| `AssemblyScriptToolchainStrategy` | `.wasm.ts`, `.wasm.mjs`, `.as`       | `assemblyscript/asc`                      |
| `CppCompilerStrategy`             | `.wasm.cpp`, `.wasm.cxx`, `.wasm.cc` | clang++ / CMake                           |
| `RustCompilerStrategy`            | `.wasm.rs`                           | cargo + wasm32-unknown-unknown            |
| `PrecompiledWasmStrategy`         | `.wasm`                              | Passthrough con validación de magic bytes |

## API principal

`compileWasm(options: CompileOptions): Promise<CompileResult>` — **@deprecated**, usa `ToolchainRouter` con las estrategias correspondientes.

```typescript
import { ToolchainRouter, AssemblyScriptToolchainStrategy } from '@wasm-apps/compiler';

const router = new ToolchainRouter();
router.register(new AssemblyScriptToolchainStrategy());
const result = await router.compileFile({ fileName: 'math.wasm.ts', sourceCode: '...' });
```

## Caché

Dos niveles, clave incluye `toolchainId`:

1. **LRU en memoria** — clave por SHA-256 del source
2. **Disco** — en `.wapp_cache/compiler/{sha256}/`, clave basada en `SHA-256(source + flags + toolchainId)`

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

## Estrategias

Cada estrategia implementa `ToolchainStrategy`:

```typescript
interface ToolchainStrategy {
  readonly id: ToolchainId;
  readonly name: string;
  readonly extensions: string[];
  isAvailable(): Promise<boolean>;
  compile(options: ToolchainCompileOptions): Promise<ToolchainResult>;
}
```

Para agregar un nuevo lenguaje, implementá `ToolchainStrategy` y registralo en el router. Ver [[concepts/architecture-patterns|Patrones Arquitectónicos]].
