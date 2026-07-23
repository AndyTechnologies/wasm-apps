# Linker (`@wasm-apps/linker`)

Lee módulos WebAssembly (`.wasm`), resuelve dependencias entre ellos, genera código C++ que los instancia con la C-API de Wasmtime, y compila todo en un ejecutable nativo autocontenido.

## API principal

`createNativeApp(options: NativeAppOptions, quiet?: boolean): Promise<string>` — soporta [[concepts/cross-compilation|compilación cruzada]] y [[concepts/host-functions|host functions]].

| Opción           | Tipo                       | Descripción                   |
| ---------------- | -------------------------- | ----------------------------- |
| `inputPaths`     | `string[]`                 | Rutas a archivos `.wasm`      |
| `output`         | `string`                   | Ruta del ejecutable de salida |
| `entry`          | `string`                   | Export a llamar al iniciar    |
| `wasi`           | `boolean`                  | Habilitar WASI                |
| `moduleMatching` | `'name-only'\|'file-name'` | Estrategia de matching        |
| `target`         | `string`                   | Tripleta de cross-compilación |
| `wasmtimePath`   | `string`                   | Ruta a Wasmtime C-API         |

## Proceso interno

1. **Lectura** — parsea `.wasm` con `WebAssembly.Module` para imports/exports
2. **Resolución** — grafo de dependencias + orden topológico (Kahn)
3. **Generación C++** — incrusta WASM como `const unsigned char[]`, define host functions, instancia módulos en orden
4. **Compilación** — cmake-js + toolchain C++ produce ejecutable enlazado estáticamente con Wasmtime

El pipeline completo está orquestado por [[concepts/pipeline|Pipeline Architecture]].

## Caché

- **Build manifest** (`.wapp_build/build-manifest.json`) — hashes de inputs + opciones
- **Download cache** (`~/.wasm-linker/`) — Wasmtime C-API descargada

Ver [[concepts/caching|Caché Incremental]].

## Plugins incluidos

| Plugin                  | Propósito                          |
| ----------------------- | ---------------------------------- |
| `stdlib-plugin`         | Registra funciones host built-in   |
| `size-optimizer-plugin` | Optimiza tamaño del binario WASM   |
| `tree-shake-plugin`     | Elimina funciones no referenciadas |

El sistema de plugins se basa en [[concepts/plugin-system|Microkernel/Plugin Pattern]].

## Dependencias clave

- `cmake-js` — integración CMake con Node.js
- `cross-spawn` — spawn multiplataforma
- `tar` — extracción de archivos
- `ora` — spinners de terminal
- `command-exists` — detección de binarios en PATH
- `@wasm-apps/types` — [[entities/types|Tipos Compartidos]]
