# Arquitectura de wasm-apps

## Visión General

wasm-apps es una toolchain que transforma código AssemblyScript (`.wasm.ts`) en ejecutables nativos autocontenidos (ELF/PE/Mach-O) usando Wasmtime C-API.

```
.wasm.ts ──► Compilador (AssemblyScript) ──► .wasm ──► Linker (C++ + Wasmtime) ──► Binario nativo
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
│  (Strategy)     │ │   (Strategy)    │ │  (Compartido)   │
│                 │ │                 │ │                 │
│ AssemblyScript  │ │ Wasmtime        │ │ Interfaces      │
│ DebugCompiler   │ │ LinuxLinker     │ │ Errores         │
│ ReleaseCompiler │ │ MacLinker       │ │ Logger          │
│ RustCompiler(*) │ │ WindowsLinker   │ │ Caché           │
└─────────────────┘ └────────┬────────┘ └─────────────────┘
                             │
                    ┌────────▼────────┐
                    │  PluginManager  │
                    │  (Microkernel)  │
                    │                 │
                    │ WasmPlugin      │
                    │ HostFunctionReg.│
                    │ Pipeline Hooks  │
                    └─────────────────┘
```

## Patrones Arquitectónicos

### 1. Pipeline Architecture (Tuberías)

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
- `GenerateCodeStage` — Genera código C++ con Wasmtime API
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

**Extensión**: Para añadir una nueva etapa, implementa `Stage<I,O>` y añádela al pipeline:

```typescript
class ValidateStage implements Stage<WasmModuleInfo[], WasmModuleInfo[]> {
  readonly name = 'validate';
  async execute(input, context) {
    // validación
    return input;
  }
}
pipeline.addStage(new ValidateStage());
```

---

### 2. Strategy Pattern (Estrategia)

**Propósito**: Encapsular comportamientos intercambiables (compiladores, linkers, generación de código) detrás de interfaces comunes.

**Ubicación**: `packages/types/src/index.ts` (interfaces), `packages/compiler/src/assemblyscript-compiler-strategy.ts`, `packages/linker/src/wasmtime-linker-strategy.ts`, `packages/linker/src/default-codegen-strategy.ts`

**Interfaces**:

```typescript
interface ICompilerStrategy {
  readonly name: string;
  compile(source: string, options: CompileOptions): Promise<WasmArtifact>;
}

interface ILinkerStrategy {
  readonly name: string;
  link(modules: WasmModuleInfo[], options: NativeAppOptions): Promise<string>;
}

interface ICodegenStrategy {
  readonly name: string;
  generate(link: ResolvedLink, entryPoint: string, wasi: boolean, importFuncTypes?: WasmImportFuncType[]): string;
}
```

**Implementaciones actuales**:

- `AssemblyScriptCompilerStrategy` — Compilador AS nativo
- `WasmtimeLinkerStrategy` — Linker usando Wasmtime C-API
- `DefaultCodegenStrategy` — Generación de C++ estándar

**Extensión**: Para añadir un nuevo compilador (ej. Rust):

```typescript
class RustCompilerStrategy implements ICompilerStrategy {
  readonly name = 'rust';
  async compile(source: string, options: CompileOptions): Promise<WasmArtifact> {
    // compilar Rust a WASM
  }
}
```

---

### 3. Builder Pattern (Constructor)

**Propósito**: Separar la construcción de un ejecutable nativo de su representación, permitiendo configurar paso a paso.

**Ubicación**: `packages/linker/src/native-app-builder.ts`

**Uso**:

```typescript
const binary = await new NativeAppBuilder()
  .addWasmModule('main.wasm')
  .addWasmModule('utils.wasm')
  .setEntry('_start')
  .setTarget('x86_64-linux')
  .setWasi(false)
  .setModuleMatching('file-name')
  .setOutputPath('./dist/app')
  .build();
```

**Validación**: El builder valida que todos los requisitos estén satisfechos antes de construir (módulos existentes, output path definido).

**Caché incremental**: El builder verifica el manifiesto de build antes de reconstruir. La caché del compilador tiene dos niveles:

- **Caché en memoria** (LRU, 100 entradas): keyeada por SHA-256 del contenido fuente. La clave es el hash, no el nombre del archivo, evitando colisiones entre archivos con el mismo nombre en diferentes directorios.
- **Caché en disco** (`.wapp_cache/compiler/{key}/`): keyeada por SHA-256 del contenido fuente + opciones de compilación. Incluye `result.json`, `out.wasm`, `out.d.ts`, `out.js`, `out.wasm.map`.

---

### 4. Repository Pattern (Repositorio) — Caché

**Propósito**: Abstraer el almacenamiento de artefactos cacheados detrás de una interfaz común, desacoplando la lógica de negocio del sistema de archivos.

**Ubicación**: `packages/types/src/index.ts` (interfaz), `packages/compiler/src/compiler-cache-repository.ts`, `packages/linker/src/linker-manifest-repository.ts`, `packages/linker/src/download-cache-repository.ts`

**Interfaz**:

```typescript
interface ICacheRepository<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  info(): Promise<CacheInfo>;
}
```

**Implementaciones**:

| Repositorio                | Almacena                   | Ubicación                         |
| -------------------------- | -------------------------- | --------------------------------- |
| `CompilerCacheRepository`  | Artefactos WASM compilados | `.wapp_cache/compiler/{key}/`     |
| `LinkerManifestRepository` | Manifiesto de build        | `.wapp_build/build-manifest.json` |
| `DownloadCacheRepository`  | Wasmtime C-API descargada  | `~/.wasm-linker/`                 |

**Inyección**: Los repositorios se inyectan en los servicios que los necesitan, facilitando pruebas y cambios de implementación.

---

### 5. Microkernel / Plugin Pattern

**Propósito**: Proporcionar un núcleo mínimo extensible mediante plugins, permitiendo añadir nuevos compiladores, linkers, generadores de código y hooks sin modificar el núcleo.

**Ubicación**: `packages/linker/src/plugin-manager.ts`, `packages/linker/src/plugin-loader.ts`, `packages/linker/src/pipeline.ts`

**Núcleo (Kernel)**:

- `PluginManager` — Registro central de extensiones
- `Pipeline` (plugin hooks) — Sistema de fases con hooks
- `HostFunctionRegistry` — Registro de funciones host C++

**Puntos de extensión**:

- `ICompilerStrategy` — Nuevos compiladores
- `ILinkerStrategy` — Nuevos linkers
- `ICodegenStrategy` — Nuevos generadores de código
- `WasmPlugin` — Plugins con hooks en fases del pipeline
- `PipelineHook` — Hooks en fases específicas (`BeforeModuleCompile`, `AfterModuleCompile`, `BeforeCodeGen`, `AfterCodeGen`, etc.)

**Ejemplo: registrar un nuevo compilador**:

```typescript
import { pluginManager } from '@wasm-apps/linker';

class ZigToWasmCompiler implements ICompilerStrategy {
  readonly name = 'zig';
  async compile(source: string, options: CompileOptions): Promise<WasmArtifact> {
    // ...
  }
}

pluginManager.registerCompiler(new ZigToWasmCompiler());
// Uso:
const compiler = pluginManager.getCompiler('zig');
```

**Seguridad**: Los plugins personalizados cargados desde `wapp.json` → `plugins[].path` están restringidos al directorio del proyecto. Cualquier ruta fuera de `process.cwd()` se rechaza con una advertencia.

**Ejemplo: plugin con hook**:

```typescript
const myPlugin: WasmPlugin = {
  id: 'my-validator',
  register(ctx) {
    ctx.pipeline.register(PipelinePhase.BeforeModuleCompile, 'my-validator', async (context) => {
      // validar archivos fuente
    });
  },
};
pluginManager.registerWasmPlugin(myPlugin);
```

---

### 6. Command Pattern (Comando)

**Propósito**: Encapsular cada operación del CLI como un objeto comando independiente, facilitando la adición de nuevos comandos y las pruebas unitarias.

**Ubicación**: `packages/types/src/index.ts` (interfaz), `packages/cli/src/commands/`

**Interfaz**:

```typescript
interface ICommand {
  readonly meta: CommandMeta;
  execute(args: Record<string, any>): Promise<void>;
}
```

**Comandos actuales**:

| Comando       | Clase               | Descripción        |
| ------------- | ------------------- | ------------------ |
| `init`        | `InitCommand`       | Crear `wapp.json`  |
| `build`       | `BuildCommand`      | Compilar + linkear |
| `dev`         | `DevCommand`        | Watch + rebuild    |
| `setup`       | `SetupCommand`      | Descargar Wasmtime |
| `cache info`  | `CacheInfoCommand`  | Estado de cachés   |
| `cache clear` | `CacheClearCommand` | Limpiar cachés     |

**Invocador**: `cli.ts` actúa como invocador que parsea argumentos con Commander, obtiene el comando del registro y lo ejecuta. La versión del CLI se lee de `package.json` dinámicamente para evitar desincronización.

**Manejo de errores**: Si un comando no está registrado en `getCommand()`, el CLI muestra un error y sale con código 1, en lugar de fallar silenciosamente.

**Extensión**: Para añadir un nuevo comando:

1. Crear la clase en `packages/cli/src/commands/mi-comando.ts`
2. Implementar `ICommand`
3. Registrarlo en `packages/cli/src/commands/index.ts`
4. Añadirlo al CLI en `packages/cli/src/cli.ts`

---

## Flujo de Datos Completo

```
1. CLI recibe "wapp build --release"
2. BuildCommand.execute() se invoca
3. Resuelve config desde wapp.json + CLI args
4. Carga plugins (WasmPlugin registrados)
5. Encuentra archivos .wasm.ts en sourceDir
6. Compila cada uno con ICompilerStrategy:
   a. Calcula hash → verifica CompilerCacheRepository
   b. Si no en caché: asc.main() genera .wasm
   c. Guarda en CompilerCacheRepository
7. Pipeline orquesta:
   a. ParseModulesStage → parsea .wasm
   b. ResolveDependenciesStage → orden topológico
   c. GenerateCodeStage → genera C++
   d. CompileCppStage → cmake-js → binario
8. Verifica LinkerManifestRepository → build up-to-date?
   a. Si no: ejecuta NativeAppBuilder.build()
   b. Guarda manifiesto
9. Devuelve ruta del binario
```

## Gestión de Caché

El sistema tiene tres capas de caché:

1. **Compiler Cache** (proyecto-local, `.wapp_cache/compiler/`)
   - Clave: SHA-256 de source + flags
   - Implementación: `CompilerCacheRepository`

2. **Build Cache** (proyecto-local, `.wapp_build/build-manifest.json`)
   - Manifiesto con hashes de inputs y opciones
   - Implementación: `LinkerManifestRepository`

3. **Download Cache** (global, `~/.wasm-linker/`)
   - Wasmtime C-API descargada
   - Implementación: `DownloadCacheRepository`

Todas implementan `ICacheRepository<T>` y se gestionan desde `wapp cache info/clear`.

### Manejo de errores en caché

- `fileHash()` en `build-cache.ts` maneja correctamente el caso donde `openSync` falla (declara `fd` como `number | undefined` y solo cierra si existe).
- `readLEB128()` en `wasm-leb128.ts` lanza `RangeError` para valores >36 bits en lugar de truncar silenciosamente.
- `has()` en `LinkerManifestRepository` captura `SyntaxError` de `JSON.parse` y trata la caché como inválida en lugar de propagar la excepción.

## Multiplataforma

- Rutas con `path.join()`, `path.resolve()`
- Ejecución con `cross-spawn` (spawn) o `execFileSync` (sin shell)
- Extensión `.exe` en Windows
- Signals (SIGINT/SIGTERM) solo en POSIX
- `os.tmpdir()` para directorios temporales
- `os.homedir()` para caché de descargas
- `os.EOL` para saltos de línea en archivos generados

### Resolución de imports en el compilador

El compilador AssemblyScript restringe la resolución de imports al directorio del proyecto (`PROJECT_ROOT`). Cualquier intento de leer archivos fuera del proyecto (path traversal) retorna `null`. Esto previene que código `.wasm.ts` malicioso acceda a `/etc/passwd` u otros archivos sensibles del sistema.

Además, la resolución de alias en `resolveImportPath` usa `String.prototype.startsWith` en lugar de `new RegExp`, eliminando el vector ReDoS que existía al construir dinámicamente una expresión regular desde input del usuario (`wapp.json` → `compiler.aliases`).

### Compilación con cmake-js

El flag `--target` se pasa correctamente a cmake-js para cross-compilación. El `CMakeLists.txt` generado escapa propermente:

- Barras invertidas y comillas dobles en `wasmtimePath`
- Variables CMake `${...}` para evitar inyección
- Directorios `include` y `lib` envueltos en comillas dobles para soportar rutas con espacios
