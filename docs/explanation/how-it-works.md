# Cómo funciona la toolchain

El pipeline transforma AssemblyScript (`.wasm.ts`) en un ejecutable nativo en tres etapas:

```
.wasm.ts ──[compilador]──> .wasm ──[linker]──> binario
```

## 1. Compilador — AssemblyScript a WASM

El compilador usa `assemblyscript/asc` programáticamente (no como CLI) para compilar archivos `.wasm.ts` a binarios WebAssembly. Soporta los cuatro modos de runtime de AssemblyScript (incremental, minimal, stub, full), niveles configurables de optimización y reducción, y sourcemaps opcionales.

El compilador puede procesar múltiples archivos en paralelo y almacena resultados en caché usando SHA-256 del código fuente más los flags del compilador.

## 2. Linker — WASM a ejecutable nativo

El linker es la innovación principal. Hace lo siguiente:

1. **Parsea** cada módulo `.wasm` con `WebAssembly.Module` para extraer imports y exports
2. **Resuelve dependencias** entre módulos usando orden topológico
3. **Genera código C++** que:
   - Incrusta cada binario WASM como un array `const unsigned char[]`
   - Implementa cada función importada `env.*` como un handler nativo en C++
   - Instancia los módulos en orden de dependencia usando Wasmtime C-API
   - Llama a la función de entrada (`_start`)
4. **Compila** el código C++ generado con CMake (via `cmake-js`) en un ejecutable autocontenido, enlazando estáticamente Wasmtime

## 3. Orquestador — CLI wapp

El CLI `wapp` coordina el pipeline completo: descubre archivos fuente, ejecuta el compilador para cada uno, pasa los archivos `.wasm` resultantes al linker y produce el binario final. La configuración se lee de `wapp.json` con sobrescrituras desde CLI.

## ¿Por qué este enfoque?

Un runtime WebAssembly nativo (Wasmtime) incrustado en un host C++ te proporciona:
- **Acceso completo al sistema** — archivos, red, control de procesos (sin sandbox)
- **Binario pequeño** — enlazado estáticamente, sin dependencias de runtime WASM en despliegue
- **Multiplataforma** — compila una vez por destino usando toolchains C++ existentes
- **Herramientas familiares** — sin sistemas de build específicos de WASM; solo CMake y un compilador C++
