import type { ToolchainStrategy, ToolchainCompileOptions, ToolchainResult } from './toolchain-strategy.js';
import { compileWasm, resolveAsc } from '../index.js';
import { runExecFile } from './_utils.js';

/**
 * Estrategia de compilación para AssemblyScript (.wasm.ts / .wasm.mjs / .as).
 *
 * Mantiene compatibilidad total con la API compileWasm() original,
 * produciendo el mismo resultado que se obtenía antes del refactor multi-toolchain.
 *
 * AssemblyScript ya no es dependencia npm — se invoca via spawn como C++ y Rust.
 * El usuario debe tener `asc` (assemblyscript CLI) en su PATH.
 */
export class AssemblyScriptToolchainStrategy implements ToolchainStrategy {
  readonly id = 'assemblyscript';
  readonly extensions = ['.wasm.ts', '.wasm.mjs', '.as'];

  /**
   * Verifica si AssemblyScript está disponible en el sistema.
   * Busca `asc` en node_modules/.bin/asc, PATH global, o via npx.
   */
  async isAvailable(): Promise<boolean> {
    const cmd = resolveAsc();
    try {
      await runExecFile(cmd, ['--version'], { timeout: 10000 });
      return true;
    } catch {
      try {
        await runExecFile('npx', ['--yes', 'asc', '--version'], { timeout: 15000 });
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Compila un fuente AssemblyScript a WASM usando la API compileWasm() existente.
   */
  async compile(options: ToolchainCompileOptions): Promise<ToolchainResult> {
    const result = await compileWasm({
      fileName: options.fileName,
      sourceCode: options.sourceCode,
      isDev: !(options.compilerOptions?.release ?? false),
      runtime: (options.compilerOptions?.runtime as any) ?? 'incremental',
      sourceMap: options.compilerOptions?.sourceMap ?? true,
      optimizeLevel: options.compilerOptions?.optimizeLevel ?? 3,
      shrinkLevel: options.compilerOptions?.shrinkLevel ?? 0,
    });

    return {
      wasmBytes: result.wasmBytes,
      fileName: options.fileName,
      toolchainId: 'assemblyscript',
      metadata: {
        hash: result.hash,
        dependencies: result.dependencies,
        dtsContent: result.dtsContent,
        bindingsJs: result.bindingsJs,
        sourceMap: result.sourceMap,
      },
    };
  }
}
