import { type ICommand, type CommandMeta, logger } from '@wasm-apps/types';
import { devCommand } from '../index.js';

export class DevCommand implements ICommand {
  readonly meta: CommandMeta = {
    name: 'dev',
    description: 'Vigila archivos .wasm.ts y recompila+linkea automaticamente',
  };

  async execute(args: Record<string, any>): Promise<void> {
    await devCommand({
      rootDir: process.cwd(),
      output: args.output,
      target: args.target,
      entry: args.entry || '_start',
      wasi: args.wasi || false,
      release: args.release || false,
      sourceDir: args.sourceDir,
      outDir: args.outDir,
    });
  }
}
