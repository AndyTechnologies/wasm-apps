#!/usr/bin/env node
import { Command } from 'commander';
import { logger, type ModuleMatchingStrategy } from '@wasm-apps/types';
import { initProject, buildProject, devCommand, runSetup, cacheInfo, clearCache } from './index.js';
import path from 'node:path';

const program = new Command();

program.name('wapp').description('Compila y linkea proyectos AssemblyScript en ejecutables nativos').version('1.0.0');

program
  .command('init')
  .description('Crea un archivo wapp.json de configuracion en el directorio actual')
  .argument('[dir]', 'Directorio donde crear la configuracion', '.')
  .action(async (dir: string) => {
    try {
      const rootDir = path.resolve(dir);
      initProject(rootDir);
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
      if (options.moduleMatching) {
        if (options.moduleMatching !== 'name-only' && options.moduleMatching !== 'file-name') {
          throw new Error(`module-matching debe ser 'name-only' o 'file-name', se recibio '${options.moduleMatching}'`);
        }
      }

      await buildProject({
        rootDir: process.cwd(),
        output: options.output,
        target: options.target,
        entry: options.entry,
        moduleMatching: options.moduleMatching as ModuleMatchingStrategy | undefined,
        wasi: options.wasi,
        release: options.release,
        optimizeLevel: options.optimizeLevel !== undefined ? parseInt(options.optimizeLevel, 10) : undefined,
        shrinkLevel: options.shrinkLevel !== undefined ? parseInt(options.shrinkLevel, 10) : undefined,
        sourceDir: options.sourceDir,
        outDir: options.outDir,
      });
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
      await devCommand({
        rootDir: process.cwd(),
        output: options.output,
        target: options.target,
        entry: options.entry,
        wasi: options.wasi,
        release: options.release,
        sourceDir: options.sourceDir,
        outDir: options.outDir,
      });
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
      await runSetup();
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
      await cacheInfo();
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
      await clearCache({
        build: options.build || undefined,
        linker: options.linker || undefined,
        all: options.all || undefined,
      });
    } catch (err: any) {
      logger.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
