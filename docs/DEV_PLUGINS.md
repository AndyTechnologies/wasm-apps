# Desarrollo de Plugins

## Contrato WasmPlugin

Un plugin es un módulo JavaScript/TypeScript que exporta por defecto un objeto `WasmPlugin`:

```ts
interface WasmPlugin {
  id: string;
  register(ctx: PluginContext): void;
}
```

### PluginContext

El contexto proporciona acceso al registro de funciones host y al pipeline de hooks:

```ts
interface PluginContext {
  hostFunctions: {
    register(module: string, name: string, generator: HostFunctionGenerator): void;
    get(module: string, name: string): HostFunctionGenerator | undefined;
    has(module: string, name: string): boolean;
  };
  pipeline: {
    register(phase: PipelinePhase, pluginId: string, hook: PipelineHook): void;
  };
  config?: Record<string, unknown>;
  logger: Logger;
}
```

### HostFunctionGenerator

```ts
type HostFunctionGenerator = (params: string[], results: string[]) => string;
```

El generador recibe los tipos de parámetros y resultados del WASM importado (derivados del binario) y debe retornar el cuerpo de la función en C++. El cuerpo se inserta dentro de un lambda:

```cpp
[](Caller caller, Span<const Val> args, Span<Val> results) -> Result<std::monostate, Trap> {
  // <cuerpo generado>
})
```

Los argumentos se acceden por índice: `args[0].i32()`, `args[1].f64()`, etc.
Los resultados se asignan por índice: `results[0] = Val(int32_t(...))`.

### PipelineHook

```ts
type PipelineHook = (context: PipelineContext) => Promise<void> | void;
```

El `PipelineContext` contiene el estado actual del pipeline:

```ts
interface PipelineContext {
  sourceDir?: string;
  outDir?: string;
  options: {
    entry: string;
    wasi: boolean;
    moduleMatching: ModuleMatchingStrategy;
    target?: string;
    release?: boolean;
    optimizeLevel?: number;
    shrinkLevel?: number;
  };
  pluginConfigs?: PluginConfig[];
  sourceFiles?: Array<{ fileName: string; sourceCode: string }>;
  wasmModules?: WasmModuleInfo[];
  resolvedLink?: ResolvedLink;
  importFuncTypes?: WasmImportFuncType[];
  cppCode?: string;
  outputPath?: string;
}
```

## Fases del Pipeline

```
BeforeModuleCompile → AfterModuleCompile → BeforeCodeGen → AfterCodeGen → BeforeLink → AfterLink → AfterBundle
```

| Fase                  | Contexto disponible      | Uso típico                                         |
| --------------------- | ------------------------ | -------------------------------------------------- |
| `BeforeModuleCompile` | `sourceFiles`            | Pre-procesar código fuente AS antes de compilar    |
| `AfterModuleCompile`  | `sourceFiles`, `outDir`  | Inspeccionar/modificar WASM compilado              |
| `BeforeCodeGen`       | `wasmModules`, `options` | Optimizar WASM antes de generar C++, cambiar flags |
| `AfterCodeGen`        | `cppCode`                | Transformar el código C++ generado                 |
| `BeforeLink`          | `cppCode`, `outputPath`  | Agregar bibliotecas, modificar objetos             |
| `AfterLink`           | `outputPath`             | Post-procesar binario nativo (stripping, firma)    |
| `AfterBundle`         | `outputPath`             | Hook final (empaquetar, ofuscar)                   |

## Ejemplo completo: Plugin en TypeScript

```ts
// plugins/hello-plugin.ts
import type { WasmPlugin, PluginContext, PipelineContext, PipelinePhase } from '@wasm-apps/types';

const helloPlugin: WasmPlugin = {
  id: 'hello-plugin',

  register(ctx: PluginContext): void {
    // 1. Registrar una función host personalizada
    ctx.hostFunctions.register('env', 'myCustom.hostFunc', (_params, _results) => {
      return `results[0] = Val(int32_t(42)); return std::monostate{};`;
    });

    // 2. Registrar un hook en BeforeCodeGen
    ctx.pipeline.register('beforeCodeGen' as PipelinePhase, this.id, async (pipelineCtx: PipelineContext) => {
      ctx.logger.info(`Optimizando ${pipelineCtx.wasmModules?.length ?? 0} módulos...`);
    });

    // 3. Registrar un hook en AfterLink
    ctx.pipeline.register('afterLink' as PipelinePhase, this.id, async (pipelineCtx: PipelineContext) => {
      ctx.logger.success(`Binario generado en: ${pipelineCtx.outputPath}`);
    });

    ctx.logger.detail(`Plugin ${this.id} registrado`);
  },
};

export default helloPlugin;
```

Compila el plugin a JS y referencielo en `wapp.json`:

```json
{
  "plugins": [
    {
      "id": "hello-plugin",
      "enabled": true,
      "path": "./plugins/hello-plugin.js",
      "config": {
        "miOpcion": 123
      }
    }
  ]
}
```

## Ejemplos prácticos

Mira los ejemplos en `examples/` para ver plugins en acción:

- [`examples/plugin-basico/`](../examples/plugin-basico/README.md) — Plugin que valida código fuente en `BeforeModuleCompile`
- [`examples/plugin-avanzado/`](../examples/plugin-avanzado/README.md) — Plugin con función host personalizada + hooks múltiples
- [`examples/proyecto-completo/`](../examples/proyecto-completo/README.md) — Proyecto real con plugin de métricas

## Buenas prácticas

1. **Manejo de errores**: Los hooks son asíncronos. Usa try/catch para evitar que un plugin falle todo el build.
2. **Idempotencia**: Los hooks pueden ejecutarse múltiples veces en modo watch. Asegúrate de no registrar un hook dos veces.
3. **Versionado**: El núcleo (`@wasm-apps/linker`) sigue semver. Los cambios en `PluginContext` o `PipelinePhase` serán majors.
4. **Configuración**: Usa `ctx.config` para leer la configuración del plugin desde `wapp.json`.
5. **Logging**: Usa `ctx.logger` en vez de `console.log` para mantener consistencia.

## Diagrama de flujo

```
wapp.json
  └─ plugins[]
       ├─ stdlib-plugin (built-in, automático)
       │    └─ register() → HostFunctionRegistry
       │
       └─ mi-plugin (path: "./plugins/mi-plugin.js")
            └─ register() → HostFunctionRegistry + Pipeline hooks

Pipeline de build:

  [BeforeModuleCompile]  → modificar source .wasm.ts
       ↓
  Compilación AS (asc.main)
       ↓
  [AfterModuleCompile]   → inspeccionar .wasm generado
       ↓
  [BeforeCodeGen]        → wasm-opt, cambiar flags
       ↓
  Generación C++ (codegen)
       ↓
  [AfterCodeGen]         → transformar .cpp
       ↓
  [BeforeLink]           → agregar bibliotecas
       ↓
  Compilación C++ (cmake-js)
       ↓
  [AfterLink]            → strip, firma
       ↓
  [AfterBundle]          → empaquetar
```

## Referencia de C++ para generadores

Los generadores de funciones host producen código C++ que se inserta en lambdas de Wasmtime. Los helpers disponibles son:

| Helper                         | Propósito                                              |
| ------------------------------ | ------------------------------------------------------ |
| `_readAsString(caller, ptr)`   | Lee string UCS-2 desde memoria WASM                    |
| `_readAsStringNT(caller, ptr)` | Lee string null-terminated                             |
| `_wasm_rng`                    | `std::mt19937` global para random                      |
| `_wasm_timers`                 | `std::unordered_map` para console.time/console.timeEnd |
| `_wasm_clz32(x)`               | Count leading zeros (MSVC/gcc)                         |

Headers incluidos: `wasmtime.hh`, `iostream`, `cstdlib`, `cstring`, `chrono`, `unordered_map`, `random`, `string`, `cmath`, `limits`.
