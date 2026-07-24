import type { ToolchainStrategy, ToolchainCompileOptions, ToolchainResult } from './toolchain-strategy.js';
import { compileWasm } from '../index.js';

/**
 * Estrategia de compilación para AssemblyScript (.wasm.ts / .wasm.mjs / .as).
 *
 * Mantiene compatibilidad total con la API compileWasm() original,
 * produciendo el mismo resultado que se obtenía antes del refactor multi-toolchain.
 */
export class AssemblyScriptToolchainStrategy implements ToolchainStrategy {
  readonly id = 'assemblyscript';
  readonly extensions = ['.wasm.ts', '.wasm.mjs', '.as'];

  /**
   * Verifica si AssemblyScript está disponible.
   * Siempre disponible cuando el paquete está instalado (dependencia npm).
   */
  async isAvailable(): Promise<boolean> {
    try {
      await import('assemblyscript/asc');
      return true;
    } catch {
      return false;
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
