import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import type { NativeAppOptions } from '@wasm-apps/types';
import { CMakeError, LinkerError } from '@wasm-apps/types';

const require = createRequire(import.meta.url);
const CMAKE_JS_BIN = require.resolve('cmake-js/bin/cmake-js');

/**
 * Compila el código C++ generado a un binario nativo usando cmake-js y CMake.
 *
 * Escribe el C++ en un directorio temporal, genera un CMakeLists.txt,
 * ejecuta cmake-js y copia el binario resultante al path de salida.
 *
 * @param cppSource - Código fuente C++ a compilar
 * @param outputPath - Ruta absoluta donde se ubicará el binario
 * @param options - Opciones (target, wasmtimePath, etc.)
 */
export async function compileCpp(cppSource: string, outputPath: string, options: NativeAppOptions): Promise<void> {
  const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wasm-linker-'));
  const srcDir = path.join(buildDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });

  const cppFile = path.join(srcDir, 'main.cpp');
  fs.writeFileSync(cppFile, cppSource);

  const cmakeContent = generateCMakeLists(options.wasmtimePath);
  fs.writeFileSync(path.join(buildDir, 'CMakeLists.txt'), cmakeContent);

  try {
    execFileSync(CMAKE_JS_BIN, ['compile', '--directory', buildDir, '--out', buildDir], {
      stdio: 'pipe',
      timeout: 120000,
    });
  } catch (err: unknown) {
    const error = err as Error & { stderr?: Buffer; stdout?: Buffer };
    throw new CMakeError(`CMake compilation failed:\n${error.stderr?.toString() || error.message}`, {
      stderr: error.stderr?.toString(),
      stdout: error.stdout?.toString(),
    });
  }

  const builtBinary = findBuiltBinary(buildDir);
  if (!builtBinary) {
    throw new LinkerError('No binary was produced by CMake', { buildDir });
  }

  const outDir = path.dirname(outputPath);
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(builtBinary, outputPath);
  fs.chmodSync(outputPath, 0o755);
  fs.rmSync(buildDir, { recursive: true, force: true });
}

/** Genera un CMakeLists.txt para el proyecto wasm-linker. */
function generateCMakeLists(wasmtimePath?: string): string {
  return `cmake_minimum_required(VERSION 3.10)
project(wasm-linker LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

${wasmtimePath ? `set(WASMTIME_DIR "${wasmtimePath}")` : 'find_package(wasmtime REQUIRED)'}

include_directories(${wasmtimePath ? `\${WASMTIME_DIR}/include` : ''})
link_directories(${wasmtimePath ? `\${WASMTIME_DIR}/lib` : ''})

add_executable(wasm-linker src/main.cpp)

${wasmtimePath ? 'target_link_libraries(wasm-linker wasmtime)' : 'target_link_libraries(wasm-linker wasmtime::wasmtime)'}
`;
}

/** Encuentra el binario compilado en el directorio de salida de cmake-js. */
function findBuiltBinary(buildDir: string): string | null {
  const exe = process.platform === 'win32' ? '.exe' : '';
  const candidates = [
    path.join(buildDir, `wasm-linker${exe}`),
    path.join(buildDir, 'build', `wasm-linker${exe}`),
    path.join(buildDir, 'build', 'Release', `wasm-linker${exe}`),
    path.join(buildDir, 'build', 'Debug', `wasm-linker${exe}`),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}
