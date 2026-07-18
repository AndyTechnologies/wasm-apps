# Documentación de wasm-apps

Compila AssemblyScript (`.wasm.ts`) a WebAssembly y lo enlaza en ejecutables nativos autocontenidos.

## Secciones

| Sección                                 | Qué encontrarás                                        |
| --------------------------------------- | ------------------------------------------------------ |
| [Tutorial](tutorial/getting-started.md) | Crea tu primera app nativa WebAssembly desde cero      |
| [Guías prácticas](how-to/)              | Soluciones paso a paso para tareas comunes             |
| [Referencia](reference/)                | Flags de CLI, opciones de configuración, firmas de API |
| [Explicación](explanation/)             | Arquitectura, decisiones de diseño, cómo funciona      |

## Ejemplos

| Ejemplo                                                      | Descripción                                              |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| [Plugin básico](../examples/plugin-basico/README.md)         | Plugin simple que valida código fuente antes de compilar |
| [Plugin avanzado](../examples/plugin-avanzado/README.md)     | Plugin con función host personalizada y múltiples hooks  |
| [Proyecto completo](../examples/proyecto-completo/README.md) | Proyecto multi-módulo con plugin de métricas             |

## Enlaces rápidos

- [Primeros pasos](tutorial/getting-started.md)
- [Referencia de CLI](reference/cli.md)
- [Referencia de wapp.json](reference/config.md)
- [Cómo funciona la caché](explanation/caching.md)
- [Plugins para usuarios](USER_PLUGINS.md)
- [Desarrollo de plugins](DEV_PLUGINS.md)
