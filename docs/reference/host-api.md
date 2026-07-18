# Referencia de la API host

Funciones del módulo `env` de AssemblyScript implementadas como funciones host nativas en C++.

## Consola

| Función   | Firma                               | Comportamiento                     |
| --------- | ----------------------------------- | ---------------------------------- |
| `log`     | `(ptr: usize, len: usize) → void`   | Escribe texto en stdout            |
| `debug`   | `(ptr: usize, len: usize) → void`   | Escribe texto en stdout            |
| `info`    | `(ptr: usize, len: usize) → void`   | Escribe texto en stdout            |
| `warn`    | `(ptr: usize, len: usize) → void`   | Escribe texto en stderr            |
| `error`   | `(ptr: usize, len: usize) → void`   | Escribe texto en stderr            |
| `time`    | `(label: usize, len: usize) → void` | Inicia un temporizador             |
| `timeLog` | `(label: usize, len: usize) → void` | Registra el tiempo transcurrido    |
| `timeEnd` | `(label: usize, len: usize) → void` | Detiene y registra el temporizador |
| `assert`  | `(condition: bool) → void`          | Aborta si es falso                 |

## Matemáticas

Todas las funciones `Math.x` se redirigen a la biblioteca estándar de C++ (`<cmath>`):

| Función  | Fuente C++        | Función | Fuente C++   |
| -------- | ----------------- | ------- | ------------ |
| `abs`    | `std::abs`        | `acos`  | `std::acos`  |
| `acosh`  | `std::acosh`      | `asin`  | `std::asin`  |
| `asinh`  | `std::asinh`      | `atan`  | `std::atan`  |
| `atan2`  | `std::atan2`      | `atanh` | `std::atanh` |
| `cbrt`   | `std::cbrt`       | `ceil`  | `std::ceil`  |
| `clz32`  | incorporada       | `cos`   | `std::cos`   |
| `cosh`   | `std::cosh`       | `exp`   | `std::exp`   |
| `expm1`  | `std::expm1`      | `floor` | `std::floor` |
| `fround` | `std::round`      | `hypot` | `std::hypot` |
| `imul`   | incorporada       | `log`   | `std::log`   |
| `log10`  | `std::log10`      | `log1p` | `std::log1p` |
| `log2`   | `std::log2`       | `max`   | `std::max`   |
| `min`    | `std::min`        | `pow`   | `std::pow`   |
| `random` | `rand()/RAND_MAX` | `round` | `std::round` |
| `sign`   | `std::signbit`    | `sin`   | `std::sin`   |
| `sinh`   | `std::sinh`       | `sqrt`  | `std::sqrt`  |
| `tan`    | `std::tan`        | `tanh`  | `std::tanh`  |
| `trunc`  | `std::trunc`      |         |              |

Las constantes matemáticas (`PI`, `E`, `LN2`, etc.) se definen como imports globales WASM.

## Otros

| Nombre            | Firma                | Comportamiento                              |
| ----------------- | -------------------- | ------------------------------------------- |
| `Date.now`        | `() → f64`           | `std::chrono::system_clock::now()`          |
| `performance.now` | `() → f64`           | `std::chrono::steady_clock::now()`          |
| `process.exit`    | `(code: i32) → void` | `std::exit(code)`                           |
| `seed`            | `() → f64`           | Devuelve una semilla aleatoria via `rand()` |
