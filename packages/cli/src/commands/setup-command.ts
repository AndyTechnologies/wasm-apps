import { type ICommand, type CommandMeta, logger } from '@wasm-apps/types';
import { runSetup } from '../index.js';

export class SetupCommand implements ICommand {
  readonly meta: CommandMeta = {
    name: 'setup',
    description: 'Descarga las dependencias necesarias (Wasmtime C-API)',
  };

  async execute(_args: Record<string, any>): Promise<void> {
    await runSetup();
  }
}
