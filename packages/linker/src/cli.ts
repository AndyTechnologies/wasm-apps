#!/usr/bin/env node
import { Command } from 'commander';
import { logger } from '@wasm-apps/types';
import { createNativeApp } from './index.js';
import { runSetup, checkSetupStatus } from './setup.js';
import { clearCache, getCacheInfo } from './cache.js';
import fs from 'node:fs';
import path from 'node:path';

const program = new Command();

program.name('linker').description('Convierte proyectos WebAssembly en ejecutables nativos autocontenidos').version('1.0.0');

program
  .command('build')
  .description('Compila uno o varios archivos .wasm en un ejecutable nativo')
  .argument('<files...>', 'Carpeta o archivos .wasm')
  .requiredOption('-o, --output <file>', 'Nombre del ejecutable de salida')
  .option('-t, --target <triple>', 'Tripleta de compilacion (ej. x86_64-linux-gnu, aarch64-macos)')
  .option('-e, --entry <name>', 'Punto de entrada (funcion exportada, por defecto _start)', '_start')
  .option('--wasi', 'Habilitar interfaz WASI', false)
  .option('--module-matching <strategy>', 'Estrategia de resolucion: name-only (defecto) o file-name', 'name-only')
  .option('--wasmtime-path <path>', 'Ruta personalizada a la API C de Wasmtime (include/lib)')
  .action(async (files: string[], options) => {
    const resolvedFiles = files.map((p) => path.resolve(p));
    try {
      await createNativeApp({
        inputPaths: resolvedFiles,
        output: options.output,
        target: options.target,
        entry: options.entry,
        wasi: options.wasi,
        moduleMatching: options.moduleMatching as 'name-only' | 'file-name',
        wasmtimePath: options.wasmtimePath,
      });
      logger.success(`Ejecutable creado: ${options.output}`);
    } catch (err: any) {
      logger.error(`\nError: ${err.message}`);
      if (err.details?.stderr) {
        logger.detail(`stderr:\n${err.details.stderr}`);
      }
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Vigila archivos .wasm y recompila automaticamente el ejecutable nativo')
  .argument('<files...>', 'Carpeta o archivos .wasm')
  .requiredOption('-o, --output <file>', 'Nombre del ejecutable de salida')
  .option('-t, --target <triple>', 'Tripleta de compilacion')
  .option('-e, --entry <name>', 'Punto de entrada', '_start')
  .option('--wasi', 'Habilitar interfaz WASI', false)
  .option('--module-matching <strategy>', 'Estrategia de resolucion', 'name-only')
  .option('--wasmtime-path <path>', 'Ruta personalizada a la API C de Wasmtime')
  .action(async (files: string[], options) => {
    if (process.platform !== 'win32') {
      process.on('SIGINT', () => {
        logger.info('\nDeteniendo...');
        process.exit(0);
      });
      process.on('SIGTERM', () => {
        logger.info('\nDeteniendo...');
        process.exit(0);
      });
    }

    const inputPaths = files.map((p) => path.resolve(p));

    const doBuild = async () => {
      try {
        logger.step('\nCambio detectado, recompilando...');
        await createNativeApp({
          inputPaths,
          output: path.resolve(options.output),
          target: options.target,
          entry: options.entry,
          wasi: options.wasi,
          moduleMatching: options.moduleMatching as 'name-only' | 'file-name',
          wasmtimePath: options.wasmtimePath,
        });
        logger.success(`Ejecutable creado: ${options.output}`);
      } catch (err: any) {
        logger.error(`\nError: ${err.message}`);
      }
    };

    const watchedDirs = new Set<string>();
    for (const p of inputPaths) {
      if (fs.existsSync(p)) {
        if (fs.statSync(p).isDirectory()) {
          watchedDirs.add(p);
        } else {
          watchedDirs.add(path.dirname(p));
        }
      }
    }

    logger.info(`Vigilando ${watchedDirs.size} directorios por cambios en .wasm...`);
    logger.detail('Esperando cambios... (Ctrl+C para salir)\n');

    let debounceTimer: ReturnType<typeof setTimeout>;
    const watchOptions: fs.WatchOptions = process.platform === 'linux' ? { recursive: false } : { recursive: true };
    if (process.platform === 'linux') {
      logger.detail('Nota: en Linux se usa watch no-recursivo. Las subcarpetas nuevas no se detectan.');
    }
    for (const dir of watchedDirs) {
      fs.watch(dir, watchOptions, (_eventType, filename) => {
        const normalizedName = typeof filename === 'string' ? path.normalize(filename) : null;
        if (normalizedName && normalizedName.endsWith('.wasm')) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(doBuild, 500);
        }
      });
    }

    await doBuild();
    await new Promise(() => {});
  });

program
  .command('setup')
  .description('Descarga y verifica las dependencias necesarias (Wasmtime)')
  .option('--ignore-cache', 'Ignora la cache y fuerza la descarga completa', false)
  .action(async (options) => {
    try {
      await runSetup({ ignoreCache: options.ignoreCache });
    } catch (err: any) {
      logger.error(`\nError en setup: ${err.message}`);
      if (err.stack) {
        logger.detail(`\n${err.stack}`);
      }
      process.exit(1);
    }
  });

const cacheCmd = program.command('cache').description('Gestiona la cache de descargas de Wapp');

cacheCmd
  .command('info')
  .description('Muestra informacion de la cache')
  .action(async () => {
    const info = await getCacheInfo();
    if (!info.exists) {
      logger.info('No hay cache de descargas.');
      return;
    }
    logger.info(`Ruta: ${info.path}`);
    logger.info(`Tamano: ${info.humanSize} (${info.size} bytes)`);
    logger.info(`Entradas cacheadas: ${info.entries}`);
  });

cacheCmd
  .command('clear')
  .description('Elimina toda la cache de descargas')
  .action(async () => {
    await clearCache();
  });

program
  .command('status')
  .description('Muestra el estado de las dependencias')
  .action(async () => {
    try {
      const status = await checkSetupStatus();
      logger.step('\nEstado de dependencias:\n');
      logger.info(
        `Wasmtime: ${status.wasmtime.status === 'ok' ? 'OK' : 'FALTA'} ${status.wasmtime.path ? `(${status.wasmtime.path})` : ''}${status.wasmtime.error ? ` - ${status.wasmtime.error}` : ''}`,
      );
      logger.info(`Cache:    ${status.cacheSize}`);
    } catch (err: any) {
      logger.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
