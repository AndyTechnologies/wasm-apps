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

### Bindings auto-inyectadas

Las APIs `console`, `fs` y `wasi` se exponen a los tres lenguajes **sin que el desarrollador copie bindings en su proyecto**. El compiler las inyecta según el toolchain:

| Lenguaje       | Mecanismo de inyección                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AssemblyScript | Los imports `from 'console'`, `from 'fs'`, `from 'wasi'` se reescriben a la ruta real de `packages/compiler/src/bindings/*.ts` (`rewriteBindingImports`) |
| C++            | El include path del directorio de bindings se añade a las flags de compilación (`-I`)                                                                    |
| Rust           | El crate vendido `wasm_apps_bindings` se inyecta como dependencia `path` en el `Cargo.toml` (`injectBindingsDependency`)                                 |

Los ejemplos `cpp-saludo`, `rust-hello`, `as-fs`, `rust-fs` y `mounts-demo` muestran este mecanismo: sus fuentes importan `console.h`/`fs.h`, `wasm_apps_bindings` o `console`/`fs` sin ningún bindings local.

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

### Preopens WASI (mounts)

Con `"wasi": true`, el campo `mounts` de `wapp.json` declara directorios del host preabiertos dentro del WASM (ver [referencia de wapp.json](../reference/config.md#mounts)). El linker:

1. **Valida en build-time** cada mount con `ConfigError` (host y guest obligatorios, host existente y directorio, guest absoluto).
2. **Resuelve** los hosts relativos contra el cwd del build y embebe la ruta absoluta en el binario (el preopen funciona sin importar el cwd de ejecución).
3. **Genera** `wasi_config.preopen_dir(host, guest, perms)` en `main.c.njk` con permisos completos de lectura y escritura.

Los ejemplos `as-fs`, `rust-fs` y `mounts-demo` montan `data/` en `/mnt/data` y leen `greeting.txt`.

## 3. Orquestador — CLI wapp

El CLI `wapp` coordina el pipeline completo: descubre archivos fuente de todas las extensiones soportadas, los enruta al toolchain correcto, ejecuta la compilación de cada uno, pasa los `.wasm` resultantes al linker y produce el binario final.

## ¿Por qué este enfoque?

- **Multi-lenguaje**: elegí el mejor lenguaje para cada componente sin cambiar el pipeline
- **Binarios autocontenidos**: sin dependencias de runtime WASM en despliegue
- **Multiplataforma**: compila una vez por destino usando toolchains C++ existentes
- **Extensible**: agregar un nuevo lenguaje = implementar `ToolchainStrategy` + registrarlo en el router
- **Templates personalizables**: el código C++ generado se puede adaptar con templates Nunjucks propios
