import { type ICommand, type CommandMeta, type ModuleMatchingStrategy, logger } from '@wasm-apps/types';
import { buildProject } from '../index.js';

export class BuildCommand implements ICommand {
  readonly meta: CommandMeta = {
    name: 'build',
    description: 'Compila los archivos .wasm.ts y linkea el ejecutable nativo',
  };

  async execute(args: Record<string, any>): Promise<void> {
    if (args.moduleMatching) {
      if (args.moduleMatching !== 'name-only' && args.moduleMatching !== 'file-name') {
        throw new Error(`module-matching debe ser 'name-only' o 'file-name', se recibio '${args.moduleMatching}'`);
      }
    }

    const optimizeLevel = args.optimizeLevel !== undefined ? parseInt(args.optimizeLevel, 10) : undefined;
    if (optimizeLevel !== undefined && (isNaN(optimizeLevel) || optimizeLevel < 0 || optimizeLevel > 3)) {
      throw new Error('--optimize-level debe ser un numero entre 0 y 3');
    }
    const shrinkLevel = args.shrinkLevel !== undefined ? parseInt(args.shrinkLevel, 10) : undefined;
    if (shrinkLevel !== undefined && (isNaN(shrinkLevel) || shrinkLevel < 0 || shrinkLevel > 2)) {
      throw new Error('--shrink-level debe ser un numero entre 0 y 2');
    }

    await buildProject({
      rootDir: process.cwd(),
      output: args.output,
      target: args.target,
      entry: args.entry || '_start',
      moduleMatching: args.moduleMatching as ModuleMatchingStrategy | undefined,
      wasi: args.wasi || false,
      release: args.release || false,
      optimizeLevel,
      shrinkLevel,
      sourceDir: args.sourceDir,
      outDir: args.outDir,
    });
  }
}
