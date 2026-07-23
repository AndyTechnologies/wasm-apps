# Fuente: Linker README

**Ruta**: `packages/linker/README.md`
**Propósito**: Documentación del paquete `@wasm-apps/linker`.

## Contenido extraído

- API principal: `createNativeApp()`, `parseWasmModule()`, `resolveDependencies()`, `generateCCode()`, `treeShake()`, `compileCpp()`, `setupWasmtime()`
- Pipeline de plugins con `PipelinePhase`
- Sistema de plugins incluidos (stdlib, size-optimizer, tree-shake)
- Host functions registry
- Gestión de caché
- CLI build, watch, setup, status, cache

Ver [[entities/linker|Linker]] para la síntesis.
