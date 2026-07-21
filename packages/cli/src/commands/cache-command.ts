import { type ICommand, type CommandMeta, logger } from '@wasm-apps/types';
import { cacheInfo, clearCache } from '../index.js';

export class CacheInfoCommand implements ICommand {
  readonly meta: CommandMeta = {
    name: 'cache-info',
    description: 'Muestra informacion de la cache',
  };

  async execute(_args: Record<string, any>): Promise<void> {
    await cacheInfo();
  }
}

export class CacheClearCommand implements ICommand {
  readonly meta: CommandMeta = {
    name: 'cache-clear',
    description: 'Elimina la cache de compilacion y build del proyecto (por defecto), o la de descargas (Wasmtime)',
  };

  async execute(args: Record<string, any>): Promise<void> {
    await clearCache({
      build: args.build || undefined,
      linker: args.linker || undefined,
      all: args.all || undefined,
    });
  }
}
