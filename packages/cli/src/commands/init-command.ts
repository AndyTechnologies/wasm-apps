import path from 'node:path';
import { type ICommand, type CommandMeta, logger } from '@wasm-apps/types';
import { initProject } from '../index.js';

export class InitCommand implements ICommand {
  readonly meta: CommandMeta = {
    name: 'init',
    description: 'Crea un archivo wapp.json de configuracion en el directorio actual',
  };

  async execute(args: Record<string, any>): Promise<void> {
    const rootDir = path.resolve(args.dir || '.');
    initProject(rootDir);
  }
}
