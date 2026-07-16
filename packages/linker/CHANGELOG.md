# @wasm-apps/linker

## 1.0.1

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
  - @wasm-apps/types@1.0.1
