# Cómo funciona la toolchain

El pipeline transforma código fuente en un ejecutable nativo usando un enrutador multi-toolchain:

```
.wasm.ts|.wasm.cpp|.wasm.rs|.wasm ──[compilador]──> .wasm ──[linker]──> binario nativo
```

## 1. Compilador — ToolchainRouter + Estrategias

El compilador usa un **ToolchainRouter** (patrón Microkernel + Strategy) que enruta cada archivo fuente a la estrategia de compilación correcta según su extensión:

| Extensión                            | Toolchain      | Implementación                                      |
| ------------------------------------ | -------------- | --------------------------------------------------- |
| `.wasm.ts`, `.wasm.mjs`, `.as`       | AssemblyScript | `assemblyscript/asc` como librería                  |
| `.wasm.cpp`, `.wasm.cxx`, `.wasm.cc` | C++            | clang++ directo o CMake                             |
| `.wasm.rs`                           | Rust           | cargo + target `wasm32-unknown-unknown`             |
| `.wasm`                              | Precompilado   | Passthrough con validación de magic bytes (`\0asm`) |

Cada estrategia produce un archivo `.wasm` intermedio nombrado como `{base}.{toolchainId}.wasm` (ej: `main.cpp.wasm`, `lib.rust.wasm`).

## 2. Linker — WASM a ejecutable nativo

El linker lee los módulos `.wasm`, resuelve dependencias y genera C++ mediante **templates Nunjucks**:

1. **Parsea** cada módulo `.wasm` para extraer imports y exports
2. **Resuelve dependencias** entre módulos usando orden topológico
3. **Renderiza templates Nunjucks** que generan código C++ con:
   - Arrays `const unsigned char[]` con cada binario WASM incrustado
   - Funciones host nativas para cada import `env.*`
   - Instanciación de módulos en orden de dependencia vía Wasmtime C-API
   - Llamada a la función de entrada (`_start`)
4. **Compila** el C++ generado con cmake-js en un ejecutable autocontenido, enlazando estáticamente Wasmtime

Los templates Nunjucks (en `packages/linker/templates/`) se pueden personalizar globalmente o por proyecto.

## 3. Orquestador — CLI wapp

El CLI `wapp` coordina el pipeline completo: descubre archivos fuente de todas las extensiones soportadas, los enruta al toolchain correcto, ejecuta la compilación de cada uno, pasa los `.wasm` resultantes al linker y produce el binario final.

## ¿Por qué este enfoque?

- **Multi-lenguaje**: elegí el mejor lenguaje para cada componente sin cambiar el pipeline
- **Binarios autocontenidos**: sin dependencias de runtime WASM en despliegue
- **Multiplataforma**: compila una vez por destino usando toolchains C++ existentes
- **Extensible**: agregar un nuevo lenguaje = implementar `ToolchainStrategy` + registrarlo en el router
- **Templates personalizables**: el código C++ generado se puede adaptar con templates Nunjucks propios
