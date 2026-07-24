import type { ToolchainStrategy, ToolchainCompileOptions, ToolchainResult } from './toolchain-strategy.js';
import { CompilerError } from '@wasm-apps/types';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BINARIES = ['em++', 'clang++'] as const;

/**
 * Wrapper para execFile que retorna una Promise con { stdout, stderr }.
 * El await directo sobre execFile de node:child_process no espera a que
 * el proceso termine — este wrapper sí lo hace.
 *
 * Soporta tanto el callback API (producción) como funciones mock que
 * retornan Promise directamente (tests).
 */
function runExecFile(cmd: string, args: string[], options?: any): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const childProcessOrPromise = execFile(cmd, args, options, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
    });
    // En tests, execFile suele ser un mock que retorna una Promise.
    // Detectamos ese caso y resolvemos desde allí también.
    if (childProcessOrPromise instanceof Promise) {
      childProcessOrPromise.then(
        (val: any) => resolve({ stdout: String(val?.stdout ?? ''), stderr: String(val?.stderr ?? '') }),
        (err: any) => reject(err),
      );
    }
  });
}

/**
 * Estrategia de compilación para C++ (.wasm.cpp / .wasm.cxx / .wasm.cc).
 *
 * Si existe CMakeLists.txt en el directorio del fuente, compila vía CMake.
 * Si no, compila single-file con clang++ --target=wasm32.
 */
export class CppCompilerStrategy implements ToolchainStrategy {
  readonly id = 'cpp';
  readonly extensions = ['.wasm.cpp', '.wasm.cxx', '.wasm.cc'];

  private readonly execTimeout = 120_000; // 2 minutes

  /**
   * Verifica si em++ o clang++ están disponibles en el sistema.
   * @returns true si al menos uno de los binarios existe en PATH.
   */
  async isAvailable(): Promise<boolean> {
    for (const binary of BINARIES) {
      try {
        await runExecFile('which', [binary], { timeout: 5_000 });
        return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  /**
   * Compila un fuente C++ a WASM.
   * @throws {CompilerError} si la compilación falla.
   */
  async compile(options: ToolchainCompileOptions): Promise<ToolchainResult> {
    const sourceDir = path.dirname(path.resolve(options.fileName));
    const cmakeListsPath = path.join(sourceDir, 'CMakeLists.txt');
    const hasCMake = fs.existsSync(cmakeListsPath);
    const release = options.compilerOptions?.release ?? false;

    if (hasCMake) {
      return this.compileWithCMake(sourceDir, options.fileName, release);
    }
    return this.compileSingleFile(options.fileName, release);
  }

  /**
   * Compila vía CMake: configure + build.
   * Busca el .wasm resultante en el build directory.
   */
  private async compileWithCMake(sourceDir: string, sourceFile: string, release: boolean): Promise<ToolchainResult> {
    const buildDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cpp-cmake-')), 'build');
    fs.mkdirSync(buildDir, { recursive: true });

    try {
      // Configure
      const cmakeArgs = ['-S', sourceDir, '-B', buildDir];
      if (!release) {
        cmakeArgs.push('-DCMAKE_BUILD_TYPE=Debug');
      } else {
        cmakeArgs.push('-DCMAKE_BUILD_TYPE=Release');
      }

      await runExecFile('cmake', cmakeArgs, { timeout: this.execTimeout });

      // Build
      await runExecFile('cmake', ['--build', buildDir], { timeout: this.execTimeout });

      // Find the compiled .wasm in the build directory
      const wasmOutput = this.findOutputFile(buildDir, '.wasm', sourceFile);
      if (!wasmOutput || !fs.existsSync(wasmOutput)) {
        throw new CompilerError('CMake build completed but no .wasm output found in build directory.', { code: 'COMPILER_ERROR', buildDir });
      }

      const wasmBytes = fs.readFileSync(wasmOutput);

      return {
        wasmBytes: new Uint8Array(wasmBytes),
        fileName: sourceFile,
        toolchainId: 'cpp',
      };
    } catch (err: any) {
      if (err instanceof CompilerError) throw err;
      throw new CompilerError(`C++ CMake compilation failed for "${sourceFile}": ${err.message ?? err}`, {
        code: 'COMPILER_ERROR',
        fileName: sourceFile,
        stderr: err.stderr ?? err.message,
      });
    } finally {
      this.cleanup(path.dirname(buildDir));
    }
  }

  /**
   * Compila un único archivo .wasm.cpp con clang++.
   */
  private async compileSingleFile(sourceFile: string, release: boolean): Promise<ToolchainResult> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpp-wasm-'));
    const baseName = path.basename(sourceFile).replace(/\.wasm\.(cpp|cxx|cc)$/, '.cpp.wasm');
    const wasmOutput = path.join(tmpDir, baseName);

    try {
      const clangArgs: string[] = [];

      if (release) {
        clangArgs.push('-O3');
      } else {
        clangArgs.push('-O0', '-g');
      }

      clangArgs.push('--target=wasm32', '-nostdlib', '-Wl,--no-entry', '-Wl,--export-all', '-o', wasmOutput, sourceFile);

      const { stderr } = await runExecFile('clang++', clangArgs, { timeout: this.execTimeout });

      if (!fs.existsSync(wasmOutput)) {
        throw new CompilerError(`clang++ finished but output WASM file not found: ${wasmOutput}`, {
          code: 'COMPILER_ERROR',
          fileName: sourceFile,
          wasmOutput,
          stderr,
        });
      }

      const wasmBytes = fs.readFileSync(wasmOutput);

      return {
        wasmBytes: new Uint8Array(wasmBytes),
        fileName: sourceFile,
        toolchainId: 'cpp',
      };
    } catch (err: any) {
      if (err instanceof CompilerError) throw err;
      throw new CompilerError(`C++ single-file compilation failed for "${sourceFile}": ${err.message ?? err}`, {
        code: 'COMPILER_ERROR',
        fileName: sourceFile,
        stderr: err.stderr ?? err.message,
      });
    } finally {
      this.cleanup(tmpDir);
    }
  }

  /**
   * Busca un archivo de salida en un directorio por extensión.
   */
  private findOutputFile(dir: string, ext: string, _sourceFile: string): string | null {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    const matching = files.filter((f) => f.endsWith(ext));
    if (matching.length === 0) return null;
    return path.join(dir, matching[0]);
  }

  /**
   * Limpia un directorio temporal.
   */
  private cleanup(tmpDir: string): void {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {
      // Best-effort cleanup
    }
  }
}
