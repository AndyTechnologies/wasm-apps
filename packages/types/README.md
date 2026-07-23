# `@wasm-apps/types` — Tipos Compartidos

Paquete base que define los tipos, interfaces, clases de error y utilidades de logging compartidas por todos los paquetes de **wasm-apps**.

## Instalación

```bash
pnpm add @wasm-apps/types
```

## Contenido

### Tipos e interfaces

| Exportación              | Descripción                                              |
| ------------------------ | -------------------------------------------------------- |
| `WasmExport`             | Exportación de un módulo WASM (nombre + kind)            |
| `WasmImport`             | Importación de un módulo WASM (módulo + nombre + kind)   |
| `WasmImportFuncType`     | Firma de tipos de una función importada                  |
| `WasmModuleInfo`         | Metadatos de un módulo WASM parseado                     |
| `ResolvedModule`         | Módulo en orden de dependencias con índice de instancia  |
| `ResolvedLink`           | Orden de instanciación + mapa de exports resueltos       |
| `HostFuncDef`            | Definición de función host para generación C++           |
| `HostFunctionGenerator`  | Función que produce el cuerpo C++ de una host function   |
| `RegisteredHostFunction` | Función host registrada con metadatos y generador        |
| `NativeAppOptions`       | Opciones para crear un ejecutable nativo                 |
| `CompileOptions`         | Opciones para compilar un archivo `.wasm.ts`             |
| `CompileResult`          | Resultado de una compilación exitosa                     |
| `WappConfig`             | Configuración de alto nivel del proyecto (`wapp.json`)   |
| `CrossCompileTarget`     | Destino de compilación cruzada                           |
| `PluginConfig`           | Configuración para un plugin individual                  |
| `PipelineContext`        | Contexto que se pasa a través de las fases del pipeline  |
| `WasmPlugin`             | Interfaz de un plugin del toolchain                      |
| `PipelinePhase`          | Enum de fases del pipeline (`BeforeModuleCompile`, etc.) |
| `AsRuntime`              | Variante del runtime de AssemblyScript                   |
| `ModuleMatchingStrategy` | Estrategia de matching (`name-only`, `file-name`)        |
| `ToolchainError`         | Clase base abstracta para errores del toolchain          |

### Clases de error

| Clase           | Código           | Propósito                             |
| --------------- | ---------------- | ------------------------------------- |
| `CompilerError` | `COMPILER_ERROR` | Error del compilador AssemblyScript   |
| `LinkerError`   | `LINKER_ERROR`   | Error del linker (generación binario) |
| `DownloadError` | `DOWNLOAD_ERROR` | Error de descarga HTTP                |
| `CMakeError`    | `CMAKE_ERROR`    | Error de compilación CMake            |
| `ConfigError`   | `CONFIG_ERROR`   | Error de configuración del CLI        |
| `ZigError`      | `ZIG_ERROR`      | Error del toolchain Zig (reservado)   |

### Logger

```ts
import { logger } from '@wasm-apps/types';

logger.info('mensaje'); // cyan
logger.success('ok'); // verde
logger.warn('cuidado'); // amarillo
logger.error('fallo'); // rojo
logger.step('Paso 1...'); // azul negrita
logger.detail('detalle'); // gris atenuado
```

### Utilidades

- `colorizeByStatus(success, okMsg, failMsg)` — retorna string coloreado según estado booleano
- `formatBytes(bytes)` — formatea bytes a string legible (ej. `"1.5 KB"`)

## Uso

```ts
import { CompilerError, type CompileResult } from '@wasm-apps/types';

throw new CompilerError('Error de compilación', { fileName: 'test.ts' });
```

## Dependencias

- `picocolors` — colores en terminal para el logger
