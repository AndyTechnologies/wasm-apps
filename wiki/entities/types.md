# Tipos Compartidos (`@wasm-apps/types`)

Paquete base que define tipos, interfaces, clases de error y utilidades de logging compartidas por todos los paquetes de wasm-apps. Es usado por [[entities/compiler|Compiler]], [[entities/linker|Linker]] y [[entities/cli|CLI]].

## Tipos principales

| Tipo               | Descripción                              |
| ------------------ | ---------------------------------------- |
| `WasmExport`       | Exportación de un módulo WASM            |
| `WasmImport`       | Importación de un módulo WASM            |
| `WasmModuleInfo`   | Metadatos de un módulo parseado          |
| `ResolvedLink`     | Orden de instanciación + mapa de exports |
| `NativeAppOptions` | Opciones para crear ejecutable nativo    |
| `CompileOptions`   | Opciones de compilación AS               |
| `WappConfig`       | Configuración de alto nivel del proyecto |
| `WasmPlugin`       | Interfaz de plugin del toolchain         |
| `ToolchainError`   | Clase base abstracta para errores        |

## Clases de error

| Clase           | Código           | Propósito                           |
| --------------- | ---------------- | ----------------------------------- |
| `CompilerError` | `COMPILER_ERROR` | Error del compilador AS             |
| `LinkerError`   | `LINKER_ERROR`   | Error del linker                    |
| `DownloadError` | `DOWNLOAD_ERROR` | Error de descarga HTTP              |
| `CMakeError`    | `CMAKE_ERROR`    | Error de compilación CMake          |
| `ConfigError`   | `CONFIG_ERROR`   | Error de configuración CLI          |
| `ZigError`      | `ZIG_ERROR`      | Error del toolchain Zig (reservado) |

## Logger

```ts
logger.info('mensaje'); // cyan
logger.success('ok'); // verde
logger.warn('cuidado'); // amarillo
logger.error('fallo'); // rojo
logger.step('Paso 1...'); // azul negrita
logger.detail('detalle'); // gris
```

## Dependencias

- `picocolors` — colores en terminal para el logger
