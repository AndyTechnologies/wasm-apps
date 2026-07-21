# Host Functions

Funciones del módulo `env` de AssemblyScript implementadas como host functions nativas en C++ usando `HostFunctionRegistry`, que forma parte del [[concepts/plugin-system|Sistema de Plugins]]. Ver [[entities/linker|Linker]] para la integración en el pipeline.

## Consola

`log`, `debug`, `info`, `warn`, `error`, `time`, `timeLog`, `timeEnd`, `assert`

## Matemáticas (38 funciones)

Todas las funciones `Math.x` redirigidas a `<cmath>` de C++: `abs`, `acos`, `acosh`, `asin`, `asinh`, `atan`, `atan2`, `atanh`, `cbrt`, `ceil`, `clz32`, `cos`, `cosh`, `exp`, `expm1`, `floor`, `fround`, `hypot`, `imul`, `log`, `log10`, `log1p`, `log2`, `max`, `min`, `pow`, `random`, `round`, `sign`, `sin`, `sinh`, `sqrt`, `tan`, `tanh`, `trunc`.

## Otros

| Nombre            | Comportamiento                     |
| ----------------- | ---------------------------------- |
| `Date.now`        | `std::chrono::system_clock::now()` |
| `performance.now` | `std::chrono::steady_clock::now()` |
| `process.exit`    | `std::exit(code)`                  |
| `seed`            | Semilla aleatoria via `rand()`     |
| `abort`           | Aborta la ejecución                |
| `trace`           | Traza de depuración                |

Las constantes de `Math` (PI, E, LN2, etc.) y `process.argv` se definen como imports globales WASM.
