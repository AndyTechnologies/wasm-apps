# Arquitectura de wasm-apps

## Visión General

wasm-apps es una toolchain que transforma código AssemblyScript, C++ o Rust en ejecutables nativos autocontenidos (ELF/PE/Mach-O) usando Wasmtime C-API.

```
.wasm.ts|.wasm.cpp|.wasm.rs|.wasm  ──► ToolchainRouter ──► .wasm ──► Linker (Nunjucks + Wasmtime) ──► Binario nativo
```

## Diagrama de Bloques

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLI (wapp)                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Init    │  │  Build   │  │   Dev    │  │  Setup   │  │  Cache   │  │
│  │ Command  │  │ Command  │  │ Command  │  │ Command  │  │ Command  │  │
│  └──────────┘  └────┬─────┘  └──────────┘  └──────────┘  └──────────┘  │
│                     │                                                  │
│               ┌─────▼──────┐                                           │
│               │  Pipeline  │                                           │
│               │ Orchestrat.│                                           │
│               └─────┬──────┘                                           │
│                     │                                                  │
└─────────────────────┼──────────────────────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Compiler      │ │     Linker      │ │      Types      │
│  (Microkernel)  │ │   (Pipeline)    │ │  (Compartido)   │
│                 │ │                 │ │                 │
│ ToolchainRouter │ │ Wasmtime        │ │ Interfaces      │
│  ├─ AS Strategy │ │ Nunjucks Temp.  │ │ Errores         │
│  ├─ C++ Strategy│ │ PluginManager   │ │ Logger          │
│  ├─ Rust Strategy│ │ Build Cache     │ │ Caché           │
│  └─ Precompiled │ └─────────────────┘ └─────────────────┘
└─────────────────┘
```

## Patrones Arquitectónicos

### 1. Microkernel + Strategy — ToolchainRouter

**Propósito**: Enrutar archivos fuente al compilador correcto según su extensión, manteniendo el núcleo mínimo y las estrategias como plugins internos.

**Ubicación**: `packages/compiler/src/toolchain-router.ts`, `packages/compiler/src/strategies/`

**Implementación**:

```typescript
interface ToolchainStrategy {
  readonly id: ToolchainId;
  readonly name: string;
  readonly extensions: string[];
  isAvailable(): Promise<boolean>;
  compile(options: ToolchainCompileOptions): Promise<ToolchainResult>;
}

class ToolchainRouter {
  register(strategy: ToolchainStrategy): void;
  resolveForExtension(extension: string): ToolchainStrategy | undefined;
  getExtension(filePath: string): string;
  async compileFile(options: ToolchainCompileOptions): Promise<ToolchainResult>;
}
```

**Estrategias registradas**:

| Estrategia                        | Extensiones                          | Compilador                |
| --------------------------------- | ------------------------------------ | ------------------------- |
| `AssemblyScriptToolchainStrategy` | `.wasm.ts`, `.wasm.mjs`, `.as`       | `assemblyscript/asc`      |
| `CppCompilerStrategy`             | `.wasm.cpp`, `.wasm.cxx`, `.wasm.cc` | clang++ / CMake           |
| `RustCompilerStrategy`            | `.wasm.rs`                           | cargo (wasm32)            |
| `PrecompiledWasmStrategy`         | `.wasm`                              | Passthrough (magic bytes) |

**Resolución longest-suffix-first**: El router siempre elige el sufijo más largo, por lo que `.wasm.ts` gana contra `.wasm` genérico. Esto permite tener archivos `.wasm.cpp` sin que el router los confunda con `.wasm` precompilados.

**Extensión**: Para añadir un nuevo lenguaje, implementá `ToolchainStrategy` y registralo en el router:

```typescript
class ZigCompilerStrategy implements ToolchainStrategy {
  readonly id = 'zig';
  readonly extensions = ['.wasm.zig'];
  async compile(options: ToolchainCompileOptions): Promise<ToolchainResult> {
    // compilar Zig a WASM
  }
}
router.register(new ZigCompilerStrategy());
```

---

### 2. Pipeline Architecture (Tuberías)

**Propósito**: Orquestar las etapas de transformación de fuente a binario como una secuencia de stages independientes.

**Ubicación**: `packages/linker/src/build-pipeline.ts`

**Implementación**:

```typescript
interface Stage<I, O> {
  readonly name: string;
  execute(input: I, context: PipelineContext): Promise<O>;
}

class BuildPipeline {
  addStage(stage: Stage<any, any>): this;
  async run(initialInput: any, context?: PipelineContext): Promise<any>;
}
```

**Etapas definidas**:

- `ParseModulesStage` — Lee y parsea módulos `.wasm`
- `ResolveDependenciesStage` — Resuelve dependencias (orden topológico)
- `GenerateCodeStage` — Genera código C++ con Nunjucks templates
- `CompileCppStage` — Compila con cmake-js

**Uso**:

```typescript
const pipeline = BuildPipeline.createDefaultPipeline(outputPath, {
  entry: '_start',
  wasi: false,
  moduleMatching: 'file-name',
});
const result = await pipeline.run(wasmFiles);
```

---

### 3. Strategy Pattern — Compiladores y Linkers

**Propósito**: Encapsular comportamientos intercambiables detrás de interfaces comunes.

**Interfaces** (en `packages/types/src/index.ts`):

```typescript
interface ICompilerStrategy {
  readonly name: string;
  compile(source: string, options: CompileOptions): Promise<WasmArtifact>;
}

interface ILinkerStrategy {
  readonly name: string;
  link(modules: WasmModuleInfo[], options: NativeAppOptions): Promise<string>;
}
```

**Implementaciones actuales**:

- `AssemblyScriptToolchainStrategy` / `CppCompilerStrategy` / `RustCompilerStrategy` / `PrecompiledWasmStrategy` — compiladores
- `WasmtimeLinkerStrategy` — Linker usando Wasmtime C-API

---

### 4. Builder Pattern — NativeAppBuilder

**Propósito**: Separar la construcción de un ejecutable nativo de su representación.

**Ubicación**: `packages/linker/src/native-app-builder.ts`

```typescript
const binary = await new NativeAppBuilder()
  .addWasmModule('main.wasm')
  .addWasmModule('utils.wasm')
  .setEntry('_start')
  .setTarget('x86_64-linux')
  .setWasi(false)
  .setOutputPath('./dist/app')
  .build();
```

---

### 5. Repository Pattern — Caché

**Propósito**: Abstraer el almacenamiento de artefactos cacheados.

**Interfaz** (en `packages/types/src/index.ts`):

```typescript
interface ICacheRepository<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
}
```

**Implementaciones**:

| Repositorio                | Almacena            | Clave                                 | Ubicación                         |
| -------------------------- | ------------------- | ------------------------------------- | --------------------------------- |
| `CompilerCacheRepository`  | Artefactos WASM     | SHA-256(source + flags + toolchainId) | `.wapp_cache/compiler/{key}/`     |
| `LinkerManifestRepository` | Manifiesto de build | Hashes WASM + options + templateHash  | `.wapp_build/build-manifest.json` |
| `DownloadCacheRepository`  | Wasmtime C-API      | —                                     | `~/.wasm-linker/`                 |

---

### 6. Nunjucks Template Rendering

**Propósito**: Reemplazar la concatenación de strings en C++ con templates declarativos, permitiendo personalización.

**Ubicación**: `packages/linker/src/template-renderer.ts`, `packages/linker/templates/`

**Flujo**:

1. `codegen.ts` construye un `NunjucksTemplateContext` desde `ResolvedLink`
2. `template-renderer.ts` configura un entorno Nunjucks con autoescape: false
3. Renderiza `main.c.njk` que incluye partials (`_preamble.c.njk`, `_host-functions.c.njk`, `_module-buffers.c.njk`, etc.)
4. El resultado es código C++ que se compila con cmake-js

**Personalización**: Se puede apuntar a un directorio de templates custom vía `wapp.json` → `linker.templatePath`. Los partials faltantes caen en los built-in.

**Template Hash**: Cada cambio en los templates invalida el build cache automáticamente.

---

### 7. Microkernel / Plugin Pattern — Linker Plugins

**Propósito**: Extender el pipeline de build con hooks y funciones host personalizadas.

**Ubicación**: `packages/linker/src/plugin-manager.ts`

**Puntos de extensión**:

- `HostFunctionRegistry` — Registro de funciones host C++
- `PipelineHook` — Hooks en fases (`BeforeModuleCompile`, `AfterCodeGen`, `BeforeLink`, etc.)

Los plugins se cargan desde `wapp.json` → `plugins[]`. Ver `docs/USER_PLUGINS.md` y `docs/DEV_PLUGINS.md`.

---

### 8. Command Pattern — CLI

**Propósito**: Encapsular cada operación del CLI como un objeto comando independiente.

**Comandos actuales**:

| Comando       | Clase               | Descripción                          |
| ------------- | ------------------- | ------------------------------------ |
| `init`        | `InitCommand`       | Crear `wapp.json`                    |
| `build`       | `BuildCommand`      | Compilar (multi-toolchain) + linkear |
| `dev`         | `DevCommand`        | Watch + rebuild                      |
| `setup`       | `SetupCommand`      | Descargar Wasmtime                   |
| `cache info`  | `CacheInfoCommand`  | Estado de cachés                     |
| `cache clear` | `CacheClearCommand` | Limpiar cachés                       |

---

## Flujo de Datos Completo

```
1. CLI recibe "wapp build --release"
2. BuildCommand.execute() se invoca
3. Resuelve config desde wapp.json + CLI args
4. Carga plugins (linker PluginManager)
5. Crea ToolchainRouter con 4 estrategias built-in
6. Globs archivos multi-extensión: **/*.wasm.{ts,mjs,as,cpp,cxx,cc,rs} + **/*.wasm
7. Para cada archivo:
   a. router.getExtension() → sufijo más largo
   b. router.resolveForExtension() → ToolchainStrategy
   c. strategy.isAvailable() → verifica toolchain instalado
   d. strategy.compile() → compila a .wasm
   e. Cachea con computeToolchainKey()
8. Pipeline orquesta:
   a. ParseModulesStage → parsea .wasm
   b. ResolveDependenciesStage → orden topológico
   c. GenerateCodeStage → render Nunjucks template → C++
   d. CompileCppStage → cmake-js → binario
9. Verifica LinkerManifestRepository (incluye templateHash)
10. Devuelve ruta del binario
```

## Gestión de Caché

Tres capas, todas implementan `ICacheRepository<T>`:

1. **Compiler Cache** (`.wapp_cache/compiler/`) — clave incluye toolchainId
2. **Build Cache** (`.wapp_build/build-manifest.json`) — incluye templateHash
3. **Download Cache** (`~/.wasm-linker/`) — Wasmtime C-API

## Multiplataforma

- Rutas con `path.join()`, `path.resolve()`
- Ejecución con `execFile`/`execFileSync` (sin shell)
- Extensión `.exe` en Windows
- Signals (SIGINT/SIGTERM) solo en POSIX
- `os.tmpdir()` para directorios temporales
- `os.EOL` para saltos de línea en archivos generados
