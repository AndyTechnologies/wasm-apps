import path from 'node:path';
import type { ILinkerStrategy, NativeAppOptions, WasmModuleInfo, WasmImportFuncType } from '@wasm-apps/types';
import { resolveDependencies } from './linker.js';
import { generateCCode } from './codegen.js';
import { compileCpp } from './compiler.js';

export class WasmtimeLinkerStrategy implements ILinkerStrategy {
  readonly name = 'wasmtime';

  async link(modules: WasmModuleInfo[], options: NativeAppOptions): Promise<string> {
    const outputPath = path.resolve(options.output);

    const allImportFuncTypes: WasmImportFuncType[] = [];
    for (const mod of modules) {
      if (mod.importFuncTypes) {
        allImportFuncTypes.push(...mod.importFuncTypes);
      }
    }

    const resolved = resolveDependencies(modules, options.moduleMatching);
    const cpp = generateCCode(resolved, options.entry, options.wasi, allImportFuncTypes.length > 0 ? allImportFuncTypes : undefined);
    await compileCpp(cpp, outputPath, options);

    return outputPath;
  }
}
