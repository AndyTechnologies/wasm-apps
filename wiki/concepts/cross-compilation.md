# Compilación Cruzada

El [[entities/linker|Linker]] soporta compilación cruzada especificando el target con `-t` o `--target`.

## Targets soportados

| Target        | Triple                | Toolchain               |
| ------------- | --------------------- | ----------------------- |
| Nativo        | _(omitir)_            | La del sistema          |
| Linux x86_64  | `x86_64-linux-gnu`    | `gcc-x86-64-linux-gnu`  |
| Linux ARM64   | `aarch64-linux-gnu`   | `gcc-aarch64-linux-gnu` |
| macOS x86_64  | `x86_64-macos`        | osxcross                |
| macOS ARM64   | `aarch64-macos`       | osxcross                |
| Windows MinGW | `x86_64-windows`      | `gcc-mingw-w64-x86-64`  |
| Windows MSVC  | `x86_64-windows-msvc` | Clang + LLD             |

## Ejemplo

```bash
pnpm run linker build wasm-out/app.wasm -o out/app-arm64 -t aarch64-linux-gnu
```

## Configuración multi-target en wapp.json

```json
{
  "targets": [
    { "name": "linux-arm64", "triple": "aarch64-linux-gnu" },
    { "name": "win64", "triple": "x86_64-windows" }
  ]
}
```
