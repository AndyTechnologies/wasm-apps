---
'@wasm-apps/types': patch
'@wasm-apps/compiler': patch
'@wasm-apps/linker': patch
'@wasm-apps/cli': patch
---

Corrige llamada a registerBuiltinHostFunctions, flag ignoreCache, path traversal en ZIP y defaults de documentacion

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
