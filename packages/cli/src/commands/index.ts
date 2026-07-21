import type { ICommand } from '@wasm-apps/types';
import { BuildCommand } from './build-command.js';
import { DevCommand } from './dev-command.js';
import { InitCommand } from './init-command.js';
import { SetupCommand } from './setup-command.js';
import { CacheInfoCommand, CacheClearCommand } from './cache-command.js';

const commandRegistry: Map<string, ICommand> = new Map();

function register(cmd: ICommand): void {
  commandRegistry.set(cmd.meta.name, cmd);
}

register(new BuildCommand());
register(new DevCommand());
register(new InitCommand());
register(new SetupCommand());
register(new CacheInfoCommand());
register(new CacheClearCommand());

export function getCommand(name: string): ICommand | undefined {
  return commandRegistry.get(name);
}

export function getAllCommands(): ICommand[] {
  return Array.from(commandRegistry.values());
}

export { BuildCommand, DevCommand, InitCommand, SetupCommand, CacheInfoCommand, CacheClearCommand };
