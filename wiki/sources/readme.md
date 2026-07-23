# Fuente: README.md

**Ruta**: `README.md`
**Propósito**: Documentación principal del proyecto (pipeline, requisitos, instalación, uso, ejemplos, CLI reference).

## Contenido extraído

- Pipeline: `.wasm.ts` → compiler → `.wasm` → linker → ejecutable nativo
- Requisitos: Node.js ≥ 22, pnpm, CMake + Ninja, toolchain C++
- Instalación: local (desde repo) o global (npm)
- Ejemplo completo con `stdlib_test.wasm.ts`
- Referencia CLI detallada para orchestrator, compiler, linker
- Tabla de compilación cruzada (7 targets)
- API de host functions (console, Math, Date, Performance, Process)
- Licencia MIT

Ver [[overview|Overview]] para la síntesis.
