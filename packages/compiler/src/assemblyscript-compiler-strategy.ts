import type { ICompilerStrategy, CompileOptions, WasmArtifact, WasmModuleInfo } from '@wasm-apps/types';
import { compileWasm } from './index.js';

export class AssemblyScriptCompilerStrategy implements ICompilerStrategy {
  readonly name = 'assemblyscript';

  async compile(source: string, options: CompileOptions): Promise<WasmArtifact> {
    const result = await compileWasm(options);

    const moduleInfo: WasmModuleInfo = {
      fileName: options.fileName,
      buffer: Buffer.from(result.wasmBytes),
      imports: [],
      exports: [],
      importFuncTypes: [],
    };

    return {
      wasmBytes: result.wasmBytes,
      fileName: options.fileName,
      moduleInfo,
      metadata: {
        hash: result.hash,
        dependencies: result.dependencies,
      },
    };
  }
}
