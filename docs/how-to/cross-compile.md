# How to cross-compile

The linker supports cross-compilation for different architectures and operating systems.

## Prerequisites

Install the required cross-toolchain for your target:

| Target | Triple | Toolchain |
|---|---|---|
| Linux x86_64 | `x86_64-linux-gnu` | `gcc-x86-64-linux-gnu` |
| Linux ARM64 | `aarch64-linux-gnu` | `gcc-aarch64-linux-gnu` |
| macOS x86_64 | `x86_64-macos` | osxcross |
| macOS ARM64 | `aarch64-macos` | osxcross |
| Windows (MinGW) | `x86_64-windows` | `gcc-mingw-w64-x86-64` |
| Windows (MSVC) | `x86_64-windows-msvc` | Clang + LLD |

## Cross-compile from x86_64 to ARM64

Using the orchestrator:

```bash
wapp build --target aarch64-linux-gnu
```

Using the linker directly:

```bash
pnpm run linker build wasm-out/app.wasm -o out/app-arm64 -t aarch64-linux-gnu
```

## Verify the target

```bash
file out/app-arm64
# aarch64: ELF 64-bit LSB executable, ARM aarch64 ...
```
