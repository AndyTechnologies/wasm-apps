# Sistema de Plugins (Microkernel/Plugin)

Núcleo mínimo extensible mediante plugins. Permite añadir nuevos compiladores, linkers, generadores de código y hooks sin modificar el núcleo.

## Componentes del Kernel

| Componente             | Ubicación                                       | Propósito                       |
| ---------------------- | ----------------------------------------------- | ------------------------------- |
| `PluginManager`        | `packages/linker/src/plugin-manager.ts`         | Registro central de extensiones |
| `Pipeline`             | `packages/linker/src/pipeline.ts`               | Sistema de fases con hooks      |
| `HostFunctionRegistry` | `packages/linker/src/host-function-registry.ts` | Registro de funciones host C++  |

## Puntos de extensión

- `ICompilerStrategy` — nuevos compiladores
- `ILinkerStrategy` — nuevos linkers
- `ICodegenStrategy` — nuevos generadores de código
- `WasmPlugin` — plugins con hooks en fases del pipeline
- `PipelineHook` — hooks en fases específicas

## Fases del Pipeline

`BeforeModuleCompile`, `AfterModuleCompile`, `BeforeCodeGen`, `AfterCodeGen`, etc.

El sistema de plugins se integra en el [[entities/linker|Linker]] y en el [[concepts/pipeline|Pipeline Architecture]]. Ver [[concepts/architecture-patterns|Patrones Arquitectónicos]] para el contexto de Microkernel/Plugin.

## Ejemplo: registrar un nuevo compilador

```typescript
pluginManager.registerCompiler(new ZigToWasmCompiler());
const compiler = pluginManager.getCompiler('zig');
```

## Ejemplo: plugin con hook

```typescript
const myPlugin: WasmPlugin = {
  id: 'my-validator',
  register(ctx) {
    ctx.pipeline.register(PipelinePhase.BeforeModuleCompile, 'my-validator', async (context) => {
      // validación
    });
  },
};
pluginManager.registerWasmPlugin(myPlugin);
```
