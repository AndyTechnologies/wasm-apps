# Documentación de wasm-apps

Compila AssemblyScript, C++ y Rust a WebAssembly y lo enlaza en ejecutables nativos autocontenidos (ToolchainRouter + Nunjucks + Wasmtime C-API).

## Secciones

| Sección                                 | Qué encontrarás                                        |
| --------------------------------------- | ------------------------------------------------------ |
| [Tutorial](tutorial/getting-started.md) | Crea tu primera app nativa WebAssembly desde cero      |
| [Guías prácticas](how-to/)              | Soluciones paso a paso para tareas comunes             |
| [Referencia](reference/)                | Flags de CLI, opciones de configuración, firmas de API |
| [Explicación](explanation/)             | Arquitectura, decisiones de diseño, cómo funciona      |

## Ejemplos

| Ejemplo                                                         | Descripción                                              |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| [Plugin básico](../examples/plugin-basico/README.md)            | Plugin simple que valida código fuente antes de compilar |
| [Plugin avanzado](../examples/plugin-avanzado/README.md)        | Plugin con función host personalizada y múltiples hooks  |
| [Proyecto completo](../examples/proyecto-completo/README.md)    | Proyecto multi-módulo con plugin de métricas             |
| [C++ saludo](../examples/cpp-saludo/README.md)                  | C++ (`.wasm.cpp`) usando los bindings inyectados         |
| [Rust hello](../examples/rust-hello/README.md)                  | Rust (`.wasm.rs`) usando los bindings inyectados         |
| [AS + FS](../examples/as-fs/README.md)                          | AssemblyScript leyendo un archivo montado (`mounts`)     |
| [Rust + FS](../examples/rust-fs/README.md)                      | Rust leyendo un archivo montado (`mounts`)               |
| [Mounts demo](../examples/mounts-demo/README.md)                | C++ leyendo un archivo montado (`mounts`)                |
| [Multi-toolchain](../examples/multi-toolchain/README.md)        | AssemblyScript + C++ combinados en un mismo build        |
| [Precompilado](../examples/precompiled/README.md)               | WASM binario pasado-through sin recompilar               |
| [Template personalizada](../examples/custom-template/README.md) | Template Nunjucks personalizada                          |

## Enlaces rápidos

- [Primeros pasos](tutorial/getting-started.md)
- [Referencia de CLI](reference/cli.md)
- [Referencia de wapp.json](reference/config.md)
- [Cómo funciona la caché](explanation/caching.md)
- [Correr los tests de integración](how-to/run-integration-tests.md)
- [Plugins para usuarios](USER_PLUGINS.md)
- [Desarrollo de plugins](DEV_PLUGINS.md)
