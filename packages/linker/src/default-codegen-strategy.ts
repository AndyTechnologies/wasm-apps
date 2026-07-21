import type { ICodegenStrategy, ResolvedLink, WasmImportFuncType } from '@wasm-apps/types';
import { generateCCode } from './codegen.js';

export class DefaultCodegenStrategy implements ICodegenStrategy {
  readonly name = 'default';

  generate(link: ResolvedLink, entryPoint: string, wasi: boolean, importFuncTypes?: WasmImportFuncType[]): string {
    return generateCCode(link, entryPoint, wasi, importFuncTypes);
  }
}
