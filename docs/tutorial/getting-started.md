# Build your first WebAssembly native app

In this tutorial you'll write an AssemblyScript module and compile it into a standalone native executable. No prior WebAssembly experience is needed.

## Prerequisites

- Node.js ≥ 22
- pnpm
- CMake + Ninja (or Make)
- A C++ toolchain (GCC, Clang, MSVC, or Zig)

Install the CLI globally:

```bash
pnpm install --global @wasm-apps/cli
```

## Step 1 — Create a project directory

```bash
mkdir my-first-wasm-app
cd my-first-wasm-app
```

## Step 2 — Initialise the project

```bash
wapp init
```

This creates a `wapp.json` with sensible defaults:

```json
{
  "sourceDir": "src",
  "outDir": "wasm-out",
  "entry": "_start",
  "moduleMatching": "file-name",
  "compiler": {
    "release": false,
    "runtime": "incremental",
    "optimizeLevel": 3,
    "sourceMap": true
  }
}
```

## Step 3 — Write some AssemblyScript

Create `src/hello.wasm.ts`:

```typescript
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

export function _start(): void {
  console.log("Hello from AssemblyScript!");
  for (let i = 1; i <= 10; i++) {
    console.log(`factorial(${i}) = ${factorial(i)}`);
  }
}
```

`_start` is the entry point — it runs when the executable starts.

## Step 4 — Build the native executable

```bash
wapp build
```

What happens:
1. The compiler finds `src/hello.wasm.ts` and compiles it to `wasm-out/hello.wasm`
2. The linker reads the `.wasm`, generates C++ host functions, and compiles everything into a standalone binary

On first build, the linker downloads the Wasmtime C-API (~15 MB) and caches it.

## Step 5 — Run it

```bash
./hello
```

You should see:

```
Hello from AssemblyScript!
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

## Next steps

- Learn how to [configure your project](../how-to/configure-project.md)
- Add WASI support with `wapp build --wasi`
- Cross-compile for a different target: `wapp build --target aarch64-linux-gnu`
