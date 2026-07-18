# @wasm-apps/linker

## 1.3.1

### Patch Changes

- 7f81824: Corrige llamada a registerBuiltinHostFunctions, flag ignoreCache, path traversal en ZIP y defaults de documentacion

  - fix(linker): llama registerBuiltinHostFunctions en stdlib-plugin y pasa importFuncTypes a generateCCode
  - fix(linker): corrige flag --ignore-cache en runSetup/setupWasmtime
  - fix(linker): valida path traversal y limites en extractor ZIP
  - fix(compiler): elimina mergeAsConfig como codigo muerto
  - fix(cli): corrige shrinkLevel default en config y documentacion
  - fix(linker): anade verificacion SHA-256 en descargas
  - fix(linker): usa deep clone en pipeline para evitar mutaciones laterales
  - fix(linker): normaliza rutas Windows en build-cache
  - fix(linker): integra isBuildUpToDate en createNativeApp
  - fix(compiler): usa codigo de retorno en vez de stderr.includes("ERROR")
  - fix(linker): separa globalThis de MATH_CONSTANTS
  - fix(linker): limpia function section en tree-shake
  - docs: documenta targets, zigPath, optimization y plugins en config.md
  - docs: actualiza tutorial con paso wapp setup
  - refactor(cli): anade fases BeforeCodeGen/AfterCodeGen al pipeline
  - refactor(cli): refactoriza clearCache con logica explicita
  - chore: traduce todos los JSDocs a espanol

- Updated dependencies [7f81824]
  - @wasm-apps/types@1.3.1

## 1.3.0

### Minor Changes

- feat: test suite formal con vitest, tree-shaking WASM, CLI progress y wapp dev

  - Tests: 15 suites, 129 tests con mocks para asc/wasmtime/cmake
  - CLI progress: barras ora en compilación C++ y pipeline de linking
  - Hot reload: nuevo comando `wapp dev` que recompila y relinkea al cambiar .wasm.ts
  - Tree-shaking: DCE a nivel de funciones WASM vía call-graph desde exports
  - Tree-shake plugin: built-in activo por defecto en PipelinePhase.BeforeCodeGen
  - CI: separación test:unit / test:integration, scripts actualizados

### Patch Changes

- Updated dependencies []:
  - @wasm-apps/types@1.3.0

## 1.2.1

### Patch Changes

- fix: compatibilidad con Windows (plugin import + extraccion)

  - plugin-loader: usar pathToFileURL para import() en Windows (ESM no acepta
    rutas absolutas tipo D:\...)
  - extract: moveWithStrip corrige path.relative para no incluir directorios
    ya consumidos por strip
  - extract: renameWithFallback copia+elimina si rename falla con EPERM en
    Windows

- Updated dependencies []:
  - @wasm-apps/types@1.2.1

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

### Patch Changes

- Updated dependencies []:
  - @wasm-apps/types@1.2.0

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

### Patch Changes

- [#6](https://github.com/AndyTechnologies/wasm-apps/pull/6) [`01d02cc`](https://github.com/AndyTechnologies/wasm-apps/commit/01d02cc5c2a30cfaa6d34af6567fa55860169dec) Thanks [@AndyTechnologies](https://github.com/AndyTechnologies)! - Cross-platform audit (2 rounds):
  - compiler: asc.main() readFile path comparison con path.resolve() para Windows
  - linker: logger en cache.ts y wasmtime-dl.ts (console.log -> logger)
  - linker: path.parse() en vez de replace() para extension stripping
  - linker: path.resolve() en CLI build command (consistente con watch)
  - linker: remover import process innecesario en build-cache.ts
  - linker: binarios Linux standalone con libstdc++/libgcc estatico
  - linker: LIBWASM_STATIC, userenv/ntdll, .exe output path para Windows
  - linker: node: prefix en imports, os.EOL en JSON, variadic CLI args
  - linker: extract.ts sin hard rejection de tar.xz en Windows
  - linker: utils.ts sin path.posix para rutas Windows
- Updated dependencies []:
  - @wasm-apps/types@1.1.0
