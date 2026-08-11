# Cómo correr los tests de integración

Los tests de integración (`pnpm test:integration`, vía `scripts/test-examples.mjs`) compilan y ejecutan los [ejemplos](../index.md#ejemplos) del repo. Cada ejemplo se compila con `wapp build` y su salida se compara contra `expected-stdout.txt`.

## Prerrequisitos

Además de los requisitos base del proyecto (Node ≥ 22, pnpm, CMake, toolchain C++), los tests usan los toolchains WASM de los ejemplos:

| Toolchain                 | Para qué                                                         | Instalación                                                      |
| ------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| **clang++ + wasm-ld**     | Ejemplos C++ (`.wasm.cpp`) compilan a wasm32                     | `clang++ --target=wasm32` usa `wasm-ld`; en Linux: paquete `lld` |
| **cargo + wasm32 target** | Ejemplos Rust (`.wasm.rs`) compilan con `wasm32-unknown-unknown` | `rustup target add wasm32-unknown-unknown`                       |
| **Wasmtime C-API v46**    | El linker genera el ejecutable nativo                            | Autodescargada por `wapp setup` (no hay que instalarla a mano)   |

En macOS, las toolchains C++ de Apple no incluyen `lld`; instalá LLVM con `brew install llvm` y añadí su `bin/` al `PATH`.

El script detecta toolchains faltantes y **skippea** los ejemplos que los requieran (no falla el run). El ejemplo `precompiled` se regenera automáticamente desde `basico` antes de compilar (su `src/main.wasm` no está versionado).

## Ejecutar

```bash
pnpm -r build   # compila los packages (necesario antes del primer run)
pnpm run test:integration
```

## CI

`.github/workflows/ci.yml` (job `integration-tests`) instala estos toolchains en Linux y macOS: `lld` vía apt en Linux, `brew install llvm` + `PATH` en macOS, y `rustup target add wasm32-unknown-unknown` en ambos. La Wasmtime C-API se cachea entre runs con una clave que incluye `runner.arch`.

## Smoke E2E de RmlUI (local, con display)

Los 3 ejemplos RmlUI (`examples/rmlui-{basic,dom-api,rust}`) se compilan y linkean como parte de `test-examples.mjs`, pero **no se ejecutan** en CI (headless). Para verificar que los binarios corren de verdad (ventana SDL3 + loop de render):

```bash
node scripts/test-examples.mjs   # compila y linkea los ejemplos
node scripts/rmlui-smoke.mjs     # corre cada binario ~4s y valida stderr
```

`rmlui-smoke.mjs` requiere display: en Linux exige `DISPLAY`/`WAYLAND_DISPLAY` (en CI se usa `xvfb-run -a`); en macOS y Windows se ejecuta directo (sesión de escritorio nativa, sin variable de display). Falla si algún binario crashea antes del timeout o si su stderr contiene errores reales (los logs de `Loaded font face ...` de RmlUi se filtran como info).

## Cobertura del plugin RmlUI por SO en CI

| SO      | Build + link   | Runtime smoke                         | Cómo                                       |
| ------- | -------------- | ------------------------------------- | ------------------------------------------ |
| Linux   | ✅             | ✅ Xvfb + llvmpipe (GL3 por software) | `xvfb-run -a node scripts/rmlui-smoke.mjs` |
| macOS   | ✅             | ✅ ventana cocoa real (WindowServer)  | `node scripts/rmlui-smoke.mjs`             |
| Windows | ⚠️ solo manual | ❌ no se testea en CI                 | —                                          |

- **Linux**: `integration-tests` instala `xvfb`; el smoke corre sobre un display X virtual y Mesa llvmpipe provee OpenGL 3.3 core por software. Es el mismo runtime que localmente (API host + loop + render).
- **macOS**: los runners tienen WindowServer; SDL3 abre la ventana cocoa nativa y OpenGL 3.3 core (deprecated pero funcional) corre sobre Metal por traducción de Apple. No hace falta Xvfb (es X11-only).
- **Windows**: el job `integration-tests` no incluye Windows (solo `unit-tests`). Los runners Windows no tienen ICD de OpenGL 3.3 (el driver GDI genérico es GL 1.1), así que el render GL3 de RmlUi no puede validarse ahí. La validación de Windows queda en: compilación del código JS/TS (unit-tests), y build manual local del ejemplo (`node scripts/test-examples.mjs`). Si algún día se añade Windows al job, rmlui debería quedarse en build+link.
