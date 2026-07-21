#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'node:module';
import { logger } from '@wasm-apps/types';
import { getCommand } from './commands/index.js';
import { BuildCommand } from './commands/build-command.js';
import { DevCommand } from './commands/dev-command.js';
import { InitCommand } from './commands/init-command.js';
import { SetupCommand } from './commands/setup-command.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();
program.name('wapp').description('Compila y linkea proyectos AssemblyScript en ejecutables nativos').version(version);

program
  .command('init')
  .description('Crea un archivo wapp.json de configuracion en el directorio actual')
  .argument('[dir]', 'Directorio donde crear la configuracion', '.')
  .action(async (dir: string) => {
    try {
      const cmd = getCommand('init') || new InitCommand();
      await cmd.execute({ dir });
    } catch (err: any) {
      logger.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('build')
  .description('Compila los archivos .wasm.ts y linkea el ejecutable nativo')
  .option('-o, --output <file>', 'Ruta del ejecutable de salida')
  .option('-t, --target <triple>', 'Target de cross-compilacion (ej. x86_64-linux-gnu, aarch64-macos)')
  .option('-e, --entry <name>', 'Funcion de entrada', '_start')
  .option('-m, --module-matching <strategy>', 'Estrategia de resolucion: name-only o file-name')
  .option('--source-dir <dir>', 'Directorio con archivos fuente .wasm.ts')
  .option('--out-dir <dir>', 'Directorio para archivos .wasm intermedios')
  .option('--release', 'Modo release (optimizado, sin sourcemaps)', false)
  .option('--optimize-level <n>', 'Nivel de optimizacion 0-3')
  .option('--shrink-level <n>', 'Nivel de reduccion 0-2')
  .option('--wasi', 'Habilitar interfaz WASI', false)
  .action(async (options) => {
    try {
      const cmd = getCommand('build') || new BuildCommand();
      await cmd.execute(options);
    } catch (err: any) {
      logger.error(`\nError: ${err.message}`);
      if (err.details) {
        logger.detail(JSON.stringify(err.details, null, 2));
      }
      process.exit(1);
    }
  });

program
  .command('dev')
  .description('Vigila archivos .wasm.ts y recompila+linkea automaticamente')
  .option('-o, --output <file>', 'Ruta del ejecutable de salida')
  .option('-t, --target <triple>', 'Target de cross-compilacion (ej. x86_64-linux-gnu, aarch64-macos)')
  .option('-e, --entry <name>', 'Funcion de entrada', '_start')
  .option('--wasi', 'Habilitar interfaz WASI', false)
  .option('--release', 'Modo release (optimizado, sin sourcemaps)', false)
  .option('--source-dir <dir>', 'Directorio con archivos fuente .wasm.ts')
  .option('--out-dir <dir>', 'Directorio para archivos .wasm intermedios')
  .action(async (options) => {
    try {
      const cmd = getCommand('dev') || new DevCommand();
      await cmd.execute(options);
    } catch (err: any) {
      logger.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Descarga las dependencias necesarias (Wasmtime C-API)')
  .action(async () => {
    try {
      const cmd = getCommand('setup') || new SetupCommand();
      await cmd.execute({});
    } catch (err: any) {
      logger.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  });

const cacheCmd = program.command('cache').description('Gestiona la cache de descargas y compilacion');

cacheCmd
  .command('info')
  .description('Muestra informacion de la cache')
  .action(async () => {
    try {
      const cmd = getCommand('cache-info');
      if (!cmd) {
        logger.error('Comando cache-info no disponible');
        process.exit(1);
      }
      await cmd.execute({});
    } catch (err: any) {
      logger.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  });

cacheCmd
  .command('clear')
  .description('Elimina la cache de compilacion y build del proyecto (por defecto), o la de descargas (Wasmtime)')
  .option('--build', 'Elimina solo la cache de compilacion y build del proyecto', false)
  .option('--linker', 'Elimina solo la cache de descargas (Wasmtime)', false)
  .option('--all', 'Elimina toda la cache (build + descargas)', false)
  .action(async (options) => {
    try {
      const cmd = getCommand('cache-clear');
      if (!cmd) {
        logger.error('Comando cache-clear no disponible');
        process.exit(1);
      }
      await cmd.execute(options);
    } catch (err: any) {
      logger.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
