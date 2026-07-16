# @wasm-apps/types

## 1.1.0

### Minor Changes

- Plugin system y optimización de tamaño:

  - HostFunctionRegistry: registro centralizado de funciones host,
    codegen ya no importa implementaciones directamente
  - Pipeline: 7 hooks asincronos (BeforeModuleCompile → AfterBundle)
    para extender el pipeline de build
  - Plugin loader: carga dinamica de plugins desde wapp.json
  - strip-wasm: eliminacion inline de secciones name/producers/
    sourceMappingURL sin depender de Binaryen
  - size-optimizer-plugin activo por defecto (no requiere wasm-opt)
  - shrinkLevel default a 2 en AssemblyScript
  - Nuevos tipos: HostFunctionGenerator, PipelinePhase, PluginContext,
    WasmPlugin, PipelineContext, PluginConfig
  - WappConfig extendido con optimization y plugins
