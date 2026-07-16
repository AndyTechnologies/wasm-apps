# @wasm-apps/types

## 1.2.1

### Patch Changes

- fix: compatibilidad con Windows (plugin import + extraccion)

  - plugin-loader: usar pathToFileURL para import() en Windows (ESM no acepta
    rutas absolutas tipo D:\...)
  - extract: moveWithStrip corrige path.relative para no incluir directorios
    ya consumidos por strip
  - extract: renameWithFallback copia+elimina si rename falla con EPERM en
    Windows

## 1.2.0

### Minor Changes

- feat: test infrastructure with examples runner + cross-platform fixes

  - test-examples.mjs runner for 4 examples (basico, proyecto-completo, plugin-basico, plugin-avanzado)
  - linker: resolve host functions from any module (not just env)
  - linker: deduplicate exports in define_exports (unordered_set)
  - linker: support gtar on macOS for GNU tar flags
  - linker: HTTP redirect limit (max 10)
  - linker: normalize paths in build-cache (path.resolve)
  - linker: multi-level strip for zip extraction
  - linker: crypto.getRandomValuesN uses \_\_new export for WASM memory alloc
  - compiler: disk-cache split into getCacheDirPath (read-only) and ensureCacheDir
  - compiler: AsRuntime union type for runtime options
  - types: AsRuntime exported type (incremental | minimal | stub | full)

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
