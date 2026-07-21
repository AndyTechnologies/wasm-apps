import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import type { NativeAppOptions } from '@wasm-apps/types';
import { CMakeError, LinkerError, ConfigError, logger } from '@wasm-apps/types';

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
  const TARGET_RE = /^[a-zA-Z0-9_-]+$/;
  if (options.target && !TARGET_RE.test(options.target)) {
    throw new ConfigError(`Invalid target "${options.target}" — only alphanumeric, underscores, and hyphens allowed`);
  }

  const buildDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wasm-linker-'));
  try {
    const srcDir = path.join(buildDir, 'src');
    await fs.promises.mkdir(srcDir, { recursive: true });

    const cppFile = path.join(srcDir, 'main.cpp');
    await fs.promises.writeFile(cppFile, cppSource);

    const cmakeContent = generateCMakeLists(options.wasmtimePath);
    await fs.promises.writeFile(path.join(buildDir, 'CMakeLists.txt'), cmakeContent);

    try {
      await new Promise<void>((resolve, reject) => {
        const cmakeArgs = ['compile', '--directory', buildDir, '--out', buildDir];
        if (options.target) {
          cmakeArgs.push('--target', options.target);
        }
        const child = execFile(
          CMAKE_JS_BIN,
          cmakeArgs,
          {
            timeout: 120000,
          },
          (err, stdout, stderr) => {
            if (err) {
              reject(new CMakeError(`CMake compilation failed:\n${stderr || err.message}`, { stderr, stdout }));
            } else {
              resolve();
            }
          },
        );
        child.stdout?.pipe(process.stdout);
        child.stderr?.pipe(process.stderr);
      });
    } catch (err: unknown) {
      throw err instanceof CMakeError ? err : new CMakeError(`CMake compilation failed: ${(err as Error).message}`);
    }

    const builtBinary = findBuiltBinary(buildDir);
    if (!builtBinary) {
      throw new LinkerError('No binary was produced by CMake', { buildDir });
    }

    const outDir = path.dirname(outputPath);
    await fs.promises.mkdir(outDir, { recursive: true });
    await fs.promises.copyFile(builtBinary, outputPath);
    if (process.platform !== 'win32') {
      try {
        await fs.promises.chmod(outputPath, 0o755);
      } catch (chmodErr: unknown) {
        logger.warn(`chmod failed for ${outputPath}: ${(chmodErr as Error).message}`);
      }
    }
  } finally {
    await fs.promises.rm(buildDir, { recursive: true, force: true }).catch(() => {});
  }
}

function escapeCMakeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$\{/g, '\\${');
}

/** Genera un CMakeLists.txt para el proyecto wasm-linker. */
function generateCMakeLists(wasmtimePath?: string): string {
  return `cmake_minimum_required(VERSION 3.10)
project(wasm-linker LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

${wasmtimePath ? `set(WASMTIME_DIR "${escapeCMakeString(wasmtimePath)}")` : 'find_package(wasmtime REQUIRED)'}

include_directories("${wasmtimePath ? '${WASMTIME_DIR}/include' : ''}")
link_directories("${wasmtimePath ? '${WASMTIME_DIR}/lib' : ''}")

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
