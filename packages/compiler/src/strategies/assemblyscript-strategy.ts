import type { ToolchainStrategy, ToolchainCompileOptions, ToolchainResult } from './toolchain-strategy.js';
import { compileAssemblyScriptCore, resolveAsc } from '../index.js';
import { runExecFile } from './_utils.js';

/**
 * Estrategia de compilación para AssemblyScript (.wasm.ts / .wasm.mjs / .as).
 *
 * Invoce `asc` (AssemblyScript CLI) via spawn, como C++ y Rust.
 * No depende de `compileWasm()` (que es la fachada legacy con caché).
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
   * Compila un fuente AssemblyScript a WASM invocando `asc` directamente.
   */
  async compile(options: ToolchainCompileOptions): Promise<ToolchainResult> {
    const core = await compileAssemblyScriptCore(
      options.sourceCode,
      options.fileName,
      !(options.compilerOptions?.release ?? false),
      (options.compilerOptions?.runtime as any) ?? 'incremental',
      options.compilerOptions?.sourceMap ?? true,
      options.compilerOptions?.optimizeLevel ?? 3,
      options.compilerOptions?.shrinkLevel,
    );

    return {
      wasmBytes: core.wasmBytes,
      fileName: options.fileName,
      toolchainId: 'assemblyscript',
      metadata: {
        hash: core.hash,
        dependencies: [],
        dtsContent: core.dtsContent,
        bindingsJs: core.bindingsJs,
        sourceMap: core.sourceMap,
      },
    };
  }
}
