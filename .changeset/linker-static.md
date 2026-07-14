---
'@wasm-apps/compiler': patch
'@wasm-apps/linker': patch
---

Cross-platform audit (2 rounds):
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
