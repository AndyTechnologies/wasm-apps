# Pipeline Architecture

Patrón de tuberías para orquestar las etapas de transformación de fuente a binario como una secuencia de stages independientes.

## Definición

```typescript
interface Stage<I, O> {
  readonly name: string;
  execute(input: I, context: PipelineContext): Promise<O>;
}
```

## Etapas del BuildPipeline

| Stage                      | Input              | Output             | Propósito            |
| -------------------------- | ------------------ | ------------------ | -------------------- |
| `ParseModulesStage`        | archivos `.wasm`   | `WasmModuleInfo[]` | Parseo de módulos    |
| `ResolveDependenciesStage` | `WasmModuleInfo[]` | `ResolvedLink`     | Orden topológico     |
| `GenerateCodeStage`        | `ResolvedLink`     | `string` (C++)     | Generación de código |
| `CompileCppStage`          | `string` (C++)     | `string` (binario) | Compilación cmake-js |

## Extensión

Para añadir una nueva etapa, implementar `Stage<I,O>` y añadirla al pipeline:

```typescript
class ValidateStage implements Stage<WasmModuleInfo[], WasmModuleInfo[]> {
  readonly name = 'validate';
  async execute(input, context) {
    /* validación */ return input;
  }
}
pipeline.addStage(new ValidateStage());
```

## Ubicación

`packages/linker/src/build-pipeline.ts` — implementado dentro del [[entities/linker|Linker]].

## Relación con otros patrones

El pipeline usa [[concepts/plugin-system|plugins]] como puntos de extensión en cada etapa. Ver [[concepts/architecture-patterns|Patrones Arquitectónicos]] para el contexto general.
