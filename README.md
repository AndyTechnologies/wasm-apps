# wasm-apps

Compila código **AssemblyScript** (`.wasm.ts`) a WebAssembly y lo enlaza en **ejecutables nativos autocontenidos** usando la C-API de Wasmtime.

## Pipeline

```
.wasm.ts  ──[compiler]──>  .wasm  ──[linker]──>  ejecutable nativo (ELF/PE/Mach-O)
```

- **compiler** — compila AssemblyScript (`.wasm.ts`) a WebAssembly binario mediante `assemblyscript/asc`
- **linker** — lee los módulos `.wasm`, resuelve dependencias y genera código C++ que instancia los módulos con Wasmtime, luego compila con CMake + un toolchain C++ nativo o cross‑compilado
- **orchestrator** (`wapp`) — CLI unificada que coordina el pipeline completo: descubre archivos fuente, ejecuta el compilador y el linker, y gestiona proyectos con `wapp.json`

## Requisitos

- **Node.js** ≥ 22
- **pnpm**
- **CMake** + **Ninja** (o Make)
- **Toolchain C++** (GCC, Clang, MSVC, o Zig)
- Conexión a Internet en el primer uso (descarga Wasmtime C-API automáticamente)

## Instalación

### Uso local (desde el repositorio)

```bash
pnpm install
pnpm -r build
pnpm run linker setup
```

`pnpm run linker setup` descarga la C-API de Wasmtime (~15 MB) y la cachea en `~/.wasm-linker/wasmtime/`.

### Instalación global como CLI

```bash
pnpm install --global @wasm-apps/cli
wapp init mi-proyecto
cd mi-proyecto
wapp build
```

O desde el repositorio local:

```bash
pnpm install --global ./packages/cli
wapp --help
```

El comando `wapp` queda disponible globalmente en el sistema.

## Uso

### 0. Inicializar un proyecto (opcional)

```bash
wapp init mi-proyecto
cd mi-proyecto
```

Crea un archivo `wapp.json` con la configuración por defecto.

### 1. Escribir código AssemblyScript

Crea un archivo con extensión `.wasm.ts`:

```typescript
// examples/stdlib_test.wasm.ts
export function add(a: number, b: number): number {
  return a + b;
}

export function mathTest(): void {
  console.log(`Math test: sin(0)=${Math.sin(0)} cos(0)=${Math.cos(0)} sqrt(4)=${Math.sqrt(4)}`);
  console.log(`PI=${Math.PI} abs(-5)=${Math.abs(-5)} floor(3.9)=${Math.floor(3.9)}`);
}

export function _start(): void {
  console.log("Hola desde AssemblyScript!");
  console.warn("Esto es un warning");
  console.error("Esto es un error");
  mathTest();
  console.log(`5 + 3 = ${add(5, 3)}`);
  console.log(`Factorial de 5 = ${factorial(5)}`);
}

export function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

```

La función `_start` es el punto de entrada por defecto.

### 2. Compilar y linkear (orquestador)

```bash
wapp build
```

Busca archivos `**/*.wasm.ts` en `src/` (o el `sourceDir` de `wapp.json`), los compila a `.wasm` y linkea un ejecutable nativo en un solo paso.

Con opciones:

```bash
wapp build --release --output dist/mi-app --wasi
```

### 3. O bien, pipeline manual en dos pasos

```bash
pnpm run compiler build examples/math.wasm.ts -o wasm-out
pnpm run linker build wasm-out/math.wasm -o out/math-app
```

### 4. Ejecutar

```bash
./out/math-app
```

## Ejemplo completo

```bash
# Usando el orquestador (recomendado)
wapp build

# O manualmente paso a paso
pnpm run compiler build examples/stdlib_test.wasm.ts -o wasm-out
pnpm run linker build wasm-out/stdlib_test.wasm -o out/stdlib_test
./out/stdlib_test
```

Salida esperada:

```
Hola desde AssemblyScript!
Esto es un warning
Esto es un error
Math test: sin(0)=0.0 cos(0)=1.0 sqrt(4)=2.0
PI=3.141592653589793 abs(-5)=5.0 floor(3.9)=3.0
5 + 3 = 8.0
Factorial de 5 = 120.0
```

## Referencia CLI

### orchestrator (`wapp`)

CLI unificada que orquesta el pipeline completo. Usa `wapp.json` para configuración y admite overrides por línea de comandos.

Una vez instalado globalmente (`pnpm install --global @wasm-apps/cli`), se usa directamente como `wapp`. También se puede ejecutar localmente con `pnpm run cli`.

```
wapp init [dir]
wapp build [options]
wapp setup
wapp cache info
wapp cache clear
```

#### `init`

```
wapp init [dir]
```

Crea un archivo `wapp.json` con valores por defecto en el directorio especificado (o el actual).

Contenido de `wapp.json` generado:

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

#### `build`

```
wapp build [options]
```

Compila todos los `.wasm.ts` del `sourceDir` y linkea un único ejecutable nativo.

| Opción | Descripción | Defecto |
|--------|-------------|---------|
| `-o, --output <file>` | Ruta del ejecutable de salida | Inferido del nombre del directorio raíz |
| `-t, --target <triple>` | Target de cross‑compilación | Nativo |
| `-e, --entry <name>` | Función de entrada | `_start` |
| `-m, --module-matching <strategy>` | Estrategia: `name-only` o `file-name` | De `wapp.json` o `file-name` |
| `--source-dir <dir>` | Directorio con archivos `.wasm.ts` | De `wapp.json` o `src` |
| `--out-dir <dir>` | Directorio para `.wasm` intermedios | De `wapp.json` o `wasm-out` |
| `--release` | Modo release (optimizado, sin sourcemaps) | `false` |
| `--optimize-level <n>` | Nivel de optimización 0‑3 | De `wapp.json` o `3` |
| `--shrink-level <n>` | Nivel de reducción 0‑2 | De `wapp.json` |
| `--wasi` | Habilitar interfaz WASI | `false` |

#### `setup`

```
wapp setup
```

Descarga y cachea la C-API de Wasmtime en `~/.wasm-linker/wasmtime/`.

#### `cache`

```
wapp cache info       # Muestra ruta, tamaño y contenido de la caché
wapp cache clear      # Elimina toda la caché (~/.wasm-linker/)
```

### compiler

```
pnpm run compiler build <files...> [options]

Argumentos:
  files          Archivos .wasm.ts, .ts, .asm o carpetas

Opciones:
  -o, --outDir <dir>    Directorio de salida            [defecto: wasm-out]
  --release             Modo release (optimizado)        [defecto: false]
  --runtime <name>      incremental, minimal, stub, full [defecto: incremental]
  --optimizeLevel <n>   Nivel 0-3                       [defecto: 3]
  --shrinkLevel <n>     Nivel 0-2
  --no-sourcemap        Sin sourcemaps en modo debug
  --no-parallel         Compilación secuencial

pnpm run compiler watch <files...> [options]
  # Recompila automáticamente al detectar cambios
```

### linker

```
pnpm run linker build <input> -o <output> [options]

Argumentos:
  input            Archivo(s) .wasm separados por espacio, o carpeta

Opciones:
  -o, --output <file>     Ruta del ejecutable de salida        [requerido]
  -t, --target <triple>   x86_64-linux, aarch64-linux,
                          x86_64-macos, aarch64-macos,
                          x86_64-windows, x86_64-windows-msvc  [defecto: nativo]
  -e, --entry <name>      Función de entrada                   [defecto: _start]
  --wasi                  Habilitar interfaz WASI              [defecto: false]
  --module-matching       name-only o file-name                [defecto: name-only]
  --wasmtime-path <path>  Ruta personalizada a Wasmtime C-API

pnpm run linker watch <input> -o <output> [options]
  # Recompila automáticamente al detectar cambios en .wasm

pnpm run linker setup            # Descarga Wasmtime C-API
pnpm run linker status           # Estado de dependencias
pnpm run linker cache info       # Información de caché
pnpm run linker cache clear      # Limpiar caché
```

## Cross‑compilation

El linker soporta compilación cruzada especificando el target con `-t`:

| Target | Triple | Toolchain requerida |
|--------|--------|-------------------|
| Nativo | *(omitir)* | La del sistema |
| Linux x86_64 | `x86_64-linux-gnu` | `gcc-x86-64-linux-gnu` |
| Linux ARM64 | `aarch64-linux-gnu` | `gcc-aarch64-linux-gnu` |
| macOS x86_64 | `x86_64-macos` | osxcross |
| macOS ARM64 | `aarch64-macos` | osxcross |
| Windows (MinGW) | `x86_64-windows` | `gcc-mingw-w64-x86-64` |
| Windows (MSVC) | `x86_64-windows-msvc` | Clang + LLD |

Ejemplo de cross‑compilación a ARM64 desde x86_64:

```bash
pnpm run linker build wasm-out/app.wasm -o out/app-arm64 -t aarch64-linux-gnu
```

## API de host (stdlib)

La mayoría de las funciones del módulo `env` de la stdlib de AssemblyScript están implementadas como **host functions** nativas en C++:

| Categoría | Funciones |
|-----------|-----------|
| **console** | `log`, `debug`, `info`, `warn`, `error`, `time`, `timeLog`, `timeEnd`, `assert` |
| **Math** | `abs`, `acos`, `acosh`, `asin`, `asinh`, `atan`, `atan2`, `atanh`, `cbrt`, `ceil`, `clz32`, `cos`, `cosh`, `exp`, `expm1`, `floor`, `fround`, `hypot`, `imul`, `log`, `log10`, `log1p`, `log2`, `max`, `min`, `pow`, `random`, `round`, `sign`, `sin`, `sinh`, `sqrt`, `tan`, `tanh`, `trunc` |
| **Date** | `now` |
| **Performance** | `now` |
| **Process** | `exit` |
| **seed** | generación de seed aleatoria |

Constantes de `Math` (PI, E, LN2, etc.) y `process.argv` se definen como imports globales.

## Arquitectura del proyecto

```
wasm-apps/
├── packages/
│   ├── types/          # Tipos compartidos (TypeScript)
│   ├── cli/            # Orquestador CLI (wapp)
│   │   └── src/
│   │       ├── index.ts    # API init/build/setup/cache
│   │       └── cli.ts      # CLI init/build/setup/cache
│   ├── compiler/       # Compilador AS → WASM
│   │   └── src/
│   │       ├── index.ts    # API compileWasm()
│   │       ├── cli.ts      # CLI build/watch
│   │       ├── cache.ts    # LRU cache en memoria
│   │       └── utils.ts    # Hashing, resolución de imports
│   └── linker/         # Linker WASM → ejecutable nativo
│       └── src/
│           ├── index.ts    # API createNativeApp()
│           ├── cli.ts      # CLI build/watch/setup/status/cache
│           ├── codegen.ts  # Generación código C++ + host functions
│           ├── linker.ts   # Resolución de dependencias (topological sort)
│           ├── wasm-io.ts  # Parseo de módulos WASM + tipos de import
│           ├── compiler.ts  # Compilación C++ con cmake-js
│           ├── wasmtime-dl.ts  # Descarga/cache de Wasmtime C-API
│           ├── downloader.ts   # Download con reanudación
│           ├── extract.ts      # Extracción de archivos (tar/unzip)
│           ├── setup.ts        # Setup de dependencias
│           └── cache.ts        # Gestión de caché en disco
├── examples/
│   ├── math.wasm.ts          # Ejemplo básico
│   └── stdlib_test.wasm.ts   # Test completo de stdlib
└── pnpm-workspace.yaml
```

## Cómo funciona el linker

1. **Lectura** — Los módulos `.wasm` se parsean con `WebAssembly.Module` para obtener imports/exports
2. **Resolución de dependencias** — Se construye un grafo de dependencias y se ordenan los módulos topológicamente
3. **Generación de C++** — Se genera un archivo `.cpp` que:
   - Incrusta los WASM como arrays de bytes
   - Define cada función importada (`env.*`) como host function nativa
   - Instancia los módulos en orden de dependencia
   - Llama a la función de entrada (`_start`)
4. **Compilación** — cmake-js + toolchain C++ producen el ejecutable nativo enlazado estáticamente con Wasmtime

## Licencia

MIT
