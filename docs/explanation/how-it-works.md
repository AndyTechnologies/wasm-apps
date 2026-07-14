# How the toolchain works

The pipeline transforms AssemblyScript (`.wasm.ts`) into a native executable in three stages:

```
.wasm.ts ──[compiler]──> .wasm ──[linker]──> binary
```

## 1. Compiler — AssemblyScript to WASM

The compiler uses `assemblyscript/asc` programmatically (not as a CLI) to compile `.wasm.ts` files to WebAssembly binaries. It supports all four AssemblyScript runtime modes (incremental, minimal, stub, full), configurable optimisation and shrink levels, and optional sourcemaps.

The compiler can process multiple files in parallel and caches results keyed by SHA-256 of the source code plus compiler flags.

## 2. Linker — WASM to native executable

The linker is the core innovation. It:

1. **Parses** each `.wasm` module with `WebAssembly.Module` to extract imports and exports
2. **Resolves dependencies** between modules using topological sort
3. **Generates C++ code** that:
   - Embeds each WASM binary as a `const unsigned char[]` array
   - Implements every imported `env.*` function as a native C++ handler
   - Instantiates modules in dependency order using the Wasmtime C-API
   - Calls the entry function (`_start`)
4. **Compiles** the generated C++ code with CMake (via `cmake-js`) into a standalone executable, statically linking Wasmtime

## 3. Orchestrator — wapp CLI

The `wapp` CLI coordinates the full pipeline: it discovers source files, runs the compiler for each, passes the resulting `.wasm` files to the linker, and produces the final binary. Configuration is read from `wapp.json` with CLI overrides.

## Why this approach?

A native WebAssembly runtime (Wasmtime) embedded in a C++ host gives you:
- **Full system access** — files, networking, process control (not sandboxed)
- **Small binary** — statically linked, no dependency on a WASM runtime at deployment
- **Cross-platform** — compile once per target using existing C++ toolchains
- **Familiar tooling** — no WASM-specific build systems; just CMake and a C++ compiler
