# Host API reference

Functions from the AssemblyScript `env` module implemented as native C++ host functions.

## Console

| Function | Signature | Behaviour |
|---|---|---|
| `log` | `(ptr: usize, len: usize) → void` | Writes string to stdout |
| `debug` | `(ptr: usize, len: usize) → void` | Writes string to stdout |
| `info` | `(ptr: usize, len: usize) → void` | Writes string to stdout |
| `warn` | `(ptr: usize, len: usize) → void` | Writes string to stderr |
| `error` | `(ptr: usize, len: usize) → void` | Writes string to stderr |
| `time` | `(label: usize, len: usize) → void` | Starts a timer |
| `timeLog` | `(label: usize, len: usize) → void` | Logs elapsed time |
| `timeEnd` | `(label: usize, len: usize) → void` | Stops and logs timer |
| `assert` | `(condition: bool) → void` | Aborts if false |

## Math

All `Math.x` functions are forwarded to the C++ standard library (`<cmath>`):

| Function | C++ source | Function | C++ source |
|---|---|---|---|
| `abs` | `std::abs` | `acos` | `std::acos` |
| `acosh` | `std::acosh` | `asin` | `std::asin` |
| `asinh` | `std::asinh` | `atan` | `std::atan` |
| `atan2` | `std::atan2` | `atanh` | `std::atanh` |
| `cbrt` | `std::cbrt` | `ceil` | `std::ceil` |
| `clz32` | builtin | `cos` | `std::cos` |
| `cosh` | `std::cosh` | `exp` | `std::exp` |
| `expm1` | `std::expm1` | `floor` | `std::floor` |
| `fround` | `std::round` | `hypot` | `std::hypot` |
| `imul` | builtin | `log` | `std::log` |
| `log10` | `std::log10` | `log1p` | `std::log1p` |
| `log2` | `std::log2` | `max` | `std::max` |
| `min` | `std::min` | `pow` | `std::pow` |
| `random` | `rand()/RAND_MAX` | `round` | `std::round` |
| `sign` | `std::signbit` | `sin` | `std::sin` |
| `sinh` | `std::sinh` | `sqrt` | `std::sqrt` |
| `tan` | `std::tan` | `tanh` | `std::tanh` |
| `trunc` | `std::trunc` | | |

Math constants (`PI`, `E`, `LN2`, etc.) are defined as global WASM imports.

## Other

| Name | Signature | Behaviour |
|---|---|---|
| `Date.now` | `() → f64` | `std::chrono::system_clock::now()` |
| `performance.now` | `() → f64` | `std::chrono::steady_clock::now()` |
| `process.exit` | `(code: i32) → void` | `std::exit(code)` |
| `seed` | `() → f64` | Returns a random seed via `rand()` |
