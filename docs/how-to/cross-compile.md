# Cómo hacer compilación cruzada

El linker soporta compilación cruzada para diferentes arquitecturas y sistemas operativos.

## Prerrequisitos

Instala el toolchain cruzado necesario para tu destino:

| Destino         | Tripleta              | Toolchain               |
| --------------- | --------------------- | ----------------------- |
| Linux x86_64    | `x86_64-linux-gnu`    | `gcc-x86-64-linux-gnu`  |
| Linux ARM64     | `aarch64-linux-gnu`   | `gcc-aarch64-linux-gnu` |
| macOS x86_64    | `x86_64-macos`        | osxcross                |
| macOS ARM64     | `aarch64-macos`       | osxcross                |
| Windows (MinGW) | `x86_64-windows`      | `gcc-mingw-w64-x86-64`  |
| Windows (MSVC)  | `x86_64-windows-msvc` | Clang + LLD             |

## Compilación cruzada de x86_64 a ARM64

Usando el orquestador:

```bash
wapp build --target aarch64-linux-gnu
```

Usando el linker directamente:

```bash
pnpm run linker build wasm-out/app.wasm -o out/app-arm64 -t aarch64-linux-gnu
```

## Verificar el destino

```bash
file out/app-arm64
# aarch64: ELF 64-bit LSB executable, ARM aarch64 ...
```
