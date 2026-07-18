# Plugins para usuarios

## ¿Qué es un plugin?

Un plugin extiende el pipeline de compilación y enlace de `wapp`. Puede registrar funciones host personalizadas, optimizar los binarios WASM, agregar pasos de post-procesamiento, y más.

## Configuración en wapp.json

Los plugins se declaran en la sección `plugins` de tu `wapp.json`:

```json
{
  "sourceDir": "src",
  "output": "mi-app",
  "plugins": [
    {
      "id": "stdlib-plugin",
      "enabled": true,
      "config": {
        "console": true,
        "memory_pages": 256
      }
    },
    {
      "id": "my-custom-optimizer",
      "enabled": true,
      "path": "./plugins/my-optimizer.js"
    }
  ]
}
```

### Reglas

- Si `plugins` no existe o está vacío, se inyecta automáticamente el `stdlib-plugin` con configuración por defecto.
- Cada plugin debe tener un `id` único.
- `enabled: false` omite el plugin sin cargarlo.
- `path` es la ruta al archivo del plugin (relativa al `wapp.json` o absoluta).
- `config` es un objeto arbitrario que el plugin recibe durante su inicialización.

## Plugins oficiales

| id                      | Descripción                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `stdlib-plugin`         | Registra las funciones host estándar (console.log, Math.*, Date.now, etc.). Se carga automáticamente.          |
| `size-optimizer-plugin` | Ejecuta `wasm-opt` (Binaryen) en los módulos WASM antes de embeberlos, reduciendo el tamaño del binario final. |

### size-optimizer-plugin

Requiere [Binaryen](https://github.com/WebAssembly/binaryen) instalado en el PATH (`wasm-opt`).

```json
{
  "plugins": [
    {
      "id": "size-optimizer",
      "enabled": true,
      "path": "node_modules/@wasm-apps/linker/dist/size-optimizer-plugin.js",
      "config": {
        "optimizeLevel": "z"
      }
    }
  ],
  "optimization": {
    "level": "z"
  }
}
```

Niveles de optimización:

| level | Flags de wasm-opt                                                 |
| ----- | ----------------------------------------------------------------- |
| `z`   | `-Oz --strip-debug --strip-producers --converge` (tamaño extremo) |
| `s`   | `-Os --strip-debug --strip-producers --converge` (tamaño)         |
| `0`   | `-O0` (sin optimización)                                          |
| `1`   | `-O1` (rápido)                                                    |
| `2`   | `-O2` (balanceado)                                                |

## Cómo sobrescribir una HostFunction

Puedes crear un plugin que sobrescriba funciones host existentes. Por ejemplo, para reemplazar `Math.random` con una versión determinista:

```json
{
  "plugins": [
    {
      "id": "deterministic-random",
      "enabled": true,
      "path": "./plugins/deterministic-random.js"
    }
  ]
}
```

El plugin registraría su propia implementación de `Math.random` en el `HostFunctionRegistry`, que tiene prioridad sobre la built-in.

## Ejemplos

Mira los proyectos de ejemplo en `examples/`:

- [`plugin-basico`](../examples/plugin-basico/README.md) — Plugin simple de validación
- [`plugin-avanzado`](../examples/plugin-avanzado/README.md) — Plugin con función host personalizada
- [`proyecto-completo`](../examples/proyecto-completo/README.md) — Proyecto completo con plugin de métricas

## Ver plugins cargados

Ejecuta `wapp build` con `--verbose` (cuando esté implementado) para ver qué plugins se cargaron. Por ahora, los mensajes de carga aparecen en la salida estándar.
