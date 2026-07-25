# Crea tu primera app nativa WebAssembly

En este tutorial escribirás un módulo AssemblyScript y lo compilarás en un ejecutable nativo autocontenido. No necesitas experiencia previa en WebAssembly.

> **¿Preferís C++ o Rust?** wasm-apps también soporta [C++](../how-to/cross-compile.md) (`.wasm.cpp`) y [Rust](../reference/cli.md#wapp-orquestador) (`.wasm.rs`).

## Prerrequisitos

- Node.js ≥ 22
- pnpm
- CMake + Ninja (o Make)
- Un toolchain de C++ (GCC, Clang, MSVC o Zig)

Instala el CLI globalmente:

```bash
pnpm install --global @wasm-apps/cli
```

## Paso 1 — Crea un directorio para el proyecto

```bash
mkdir mi-primera-app-wasm
cd mi-primera-app-wasm
```

## Paso 2 — Inicializa el proyecto

```bash
wapp init
```

Esto crea un `wapp.json` con valores por defecto.

## Paso 3 — Escribe algo de AssemblyScript

Crea `src/hello.wasm.ts`:

```typescript
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

export function _start(): void {
  console.log('¡Hola desde AssemblyScript!');
  for (let i = 1; i <= 10; i++) {
    console.log(`factorial(${i}) = ${factorial(i)}`);
  }
}
```

`_start` es el punto de entrada — se ejecuta cuando arranca el ejecutable.

## Paso 4 — Prepara las dependencias

```bash
wapp setup
```

Esto descarga la Wasmtime C-API (~15 MB) y la almacena en caché para su uso posterior.

## Paso 5 — Compila el ejecutable nativo

```bash
wapp build
```

Qué sucede:

1. El `ToolchainRouter` detecta `src/hello.wasm.ts` y lo enruta a la estrategia AssemblyScript
2. El compilador (asc) produce `wasm-out/hello.wasm`
3. El linker renderiza templates Nunjucks para generar C++, lo compila con cmake-js y produce un binario autocontenido

## Paso 6 — Ejecútalo

```bash
./hello
```

Deberías ver:

```
¡Hola desde AssemblyScript!
factorial(1) = 1
factorial(2) = 2
factorial(3) = 6
factorial(4) = 24
factorial(5) = 120
factorial(6) = 720
factorial(7) = 5040
factorial(8) = 40320
factorial(9) = 362880
factorial(10) = 3628800
```

## Siguientes pasos

- [Configurar tu proyecto](../how-to/configure-project.md) con toolchains específicos
- Probar [C++](../how-to/cross-compile.md) con `wasi: true`
- Compilación cruzada: `wapp build --target aarch64-linux-gnu`
- Ver la [referencia completa del CLI](../reference/cli.md)
