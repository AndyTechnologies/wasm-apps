#!/usr/bin/env node
import { Command } from 'commander';
import { logger } from '@wasm-apps/types';
import { glob } from 'glob';
import path from 'path';
import fs from 'fs';
import { compileWasm } from './index.js';

function isWasmTsFile(file: string): boolean {
  return file.endsWith('.wasm.ts') || file.endsWith('.asm.ts') || file.endsWith('.asm');
}

async function resolveInputFiles(inputs: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const p of inputs) {
    const resolved = path.resolve(p);
    if (!fs.existsSync(resolved)) {
      throw new Error(`El archivo '${p}' no existe.`);
    }
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      const found = await glob('**/*.{wasm.ts,asm.ts,ts,asm}', { cwd: resolved, absolute: true, nodir: true });
      files.push(...found);
    } else if (stat.isFile() && (isWasmTsFile(resolved) || resolved.endsWith('.ts'))) {
      files.push(resolved);
    } else {
      throw new Error(`'${p}' no es un archivo .wasm.ts, .ts, .asm ni una carpeta.`);
    }
  }
  if (files.length === 0) {
    throw new Error('No se encontraron archivos AssemblyScript para compilar.');
  }
  return files;
}

interface CompileFileOptions {
  outDir: string;
  isDev: boolean;
  sourceMap: boolean;
  runtime: string;
  optimizeLevel: number;
  shrinkLevel?: number;
}

async function compileSingleFile(file: string, options: CompileFileOptions): Promise<{ file: string; success: boolean; output?: string; error?: string }> {
  const sourceCode = fs.readFileSync(file, 'utf-8');
  const relativeName = path.relative(process.cwd(), file);

  try {
    const result = await compileWasm({
      fileName: file,
      sourceCode,
      isDev: options.isDev,
      sourceMap: options.sourceMap,
      runtime: options.runtime,
      optimizeLevel: options.optimizeLevel,
      shrinkLevel: options.shrinkLevel,
    });

    let baseName: string;
    if (file.endsWith('.wasm.ts')) {
      baseName = path.basename(file, '.wasm.ts');
    } else if (file.endsWith('.asm.ts')) {
      baseName = path.basename(file, '.asm.ts');
    } else {
      baseName = path.basename(file, path.extname(file));
    }

    const wasmOut = path.join(options.outDir, `${baseName}.wasm`);
    const dtsOut = path.join(options.outDir, `${baseName}.d.ts`);
    const jsOut = path.join(options.outDir, `${baseName}.js`);

    fs.writeFileSync(wasmOut, result.wasmBytes);
    fs.writeFileSync(dtsOut, result.dtsContent);
    fs.writeFileSync(jsOut, result.bindingsJs);

    if (result.sourceMap) {
      const mapOut = path.join(options.outDir, `${baseName}.wasm.map`);
      fs.writeFileSync(mapOut, result.sourceMap);
    }

    return { file: relativeName, success: true, output: wasmOut };
  } catch (err: any) {
    return { file: relativeName, success: false, error: err.message };
  }
}

async function buildCommand(files: string[], options: {
  outDir: string;
  release: boolean;
  runtime: string;
  optimizeLevel: string;
  shrinkLevel: string;
  sourcemap: boolean;
  parallel?: boolean;
}): Promise<void> {
  const outDir = path.resolve(options.outDir);
  const isDev = !options.release;
  const sourceMap = options.sourcemap;

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const inputFiles = await resolveInputFiles(files);

  const compileOpts: CompileFileOptions = {
    outDir,
    isDev,
    sourceMap,
    runtime: options.runtime,
    optimizeLevel: parseInt(options.optimizeLevel, 10),
    shrinkLevel: options.shrinkLevel ? parseInt(options.shrinkLevel, 10) : undefined,
  };

  logger.info(`Compilando ${inputFiles.length} archivos...`);

  let results: { file: string; success: boolean; output?: string; error?: string }[];

  if (options.parallel !== false && inputFiles.length > 1) {
    const promises = inputFiles.map(file => compileSingleFile(file, compileOpts));
    const settled = await Promise.allSettled(promises);
    results = settled.map(r => r.status === 'fulfilled' ? r.value : { file: 'unknown', success: false, error: r.reason?.message });
  } else {
    results = [];
    for (const file of inputFiles) {
      const result = await compileSingleFile(file, compileOpts);
      results.push(result);
      if (result.success) {
        logger.success(`OK: ${result.file} -> ${result.output}${result.output ? ` (${fs.statSync(result.output).size} bytes)` : ''}`);
      } else {
        logger.error(`FAIL: ${result.file} — ${result.error}`);
      }
    }
  }

  for (const r of results) {
    if (r.success) {
      logger.success(`OK: ${r.file} -> ${r.output}`);
    } else {
      logger.error(`FAIL: ${r.file} — ${r.error}`);
    }
  }

  const ok = results.filter(r => r.success).length;
  const fail = results.filter(r => !r.success).length;

  logger.info(`\nResumen: ${ok} compilados, ${fail} fallos`);

  process.exit(fail > 0 ? 1 : 0);
}

async function watchCommand(files: string[], options: {
  outDir: string;
  release: boolean;
  runtime: string;
  optimizeLevel: string;
  shrinkLevel: string;
  sourcemap: boolean;
}): Promise<void> {
  if (process.platform !== 'win32') {
    process.on('SIGINT', () => { logger.info('\nDeteniendo...'); process.exit(0); });
    process.on('SIGTERM', () => { logger.info('\nDeteniendo...'); process.exit(0); });
  }

  const outDir = path.resolve(options.outDir);
  const isDev = !options.release;

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const inputFiles = await resolveInputFiles(files);

  const fileMtimes = new Map<string, number>();
  for (const f of inputFiles) {
    try {
      fileMtimes.set(f, fs.statSync(f).mtimeMs);
    } catch {
      // ignore
    }
  }

  const watchedDirs = new Set<string>();
  for (const f of inputFiles) {
    watchedDirs.add(path.dirname(f));
  }

  logger.info(`Vigilando ${inputFiles.length} archivos en ${watchedDirs.size} directorios...`);
  logger.detail('Esperando cambios... (Ctrl+C para salir)\n');

  const debouncedCompile = debounce(async (changedFile: string) => {
    logger.step(`\nCambio detectado en ${path.relative(process.cwd(), changedFile)}, recompilando...\n`);
    try {
      const result = await compileSingleFile(changedFile, { outDir, isDev, sourceMap: options.sourcemap, runtime: options.runtime, optimizeLevel: parseInt(options.optimizeLevel, 10) });
      if (result.success) {
        logger.success(`OK: ${result.file} -> ${result.output}`);
      } else {
        logger.error(`FAIL: ${result.file} — ${result.error}`);
      }
    } catch (err: any) {
      logger.error(`ERROR: ${err.message}`);
    }
    try {
      fileMtimes.set(changedFile, fs.statSync(changedFile).mtimeMs);
    } catch {
      // ignore
    }
    logger.detail('\nEsperando cambios... (Ctrl+C para salir)\n');
  }, 300);

  if (process.platform === 'linux') {
    logger.detail('Nota: en Linux, fs.watch recursive no vigila subdirectorios. Para watch completo, instala chokidar.');
  }
  for (const dir of watchedDirs) {
    fs.watch(dir, { recursive: true }, (_eventType, filename) => {
      const normalizedName = filename ? path.normalize(filename) : null;
      if (normalizedName && (normalizedName.endsWith('.wasm.ts') || normalizedName.endsWith('.asm.ts') || normalizedName.endsWith('.ts') || normalizedName.endsWith('.asm'))) {
        const fullPath = path.join(dir, normalizedName);
        let targetFile = inputFiles.includes(fullPath) ? fullPath : undefined;
        if (!targetFile) {
          targetFile = inputFiles.find(f => path.basename(f) === filename);
        }
        if (targetFile) {
          debouncedCompile(targetFile);
        }
      }
    });
  }

  await new Promise(() => {});
}

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

const program = new Command();

program
  .name('compiler')
  .description('Compila archivos AssemblyScript (.wasm.ts, .ts, .asm) a WebAssembly')
  .version('1.0.0');

program
  .command('build')
  .description('Compila archivos AssemblyScript a WebAssembly')
  .argument('<files...>', 'Archivos .wasm.ts, .ts, .asm o carpetas a compilar')
  .option('-o, --outDir <dir>', 'Directorio de salida', 'wasm-out')
  .option('--release', 'Modo release (optimizado, sin sourcemaps)', false)
  .option('--runtime <name>', 'Runtime (incremental, minimal, stub, full)', 'incremental')
  .option('--optimizeLevel <n>', 'Nivel de optimizacion 0-3', '3')
  .option('--shrinkLevel <n>', 'Nivel de reduccion 0-2')
  .option('--no-sourcemap', 'Deshabilitar sourcemaps en modo debug')
  .option('--no-parallel', 'Deshabilitar compilacion paralela')
  .action(async (files: string[], options) => {
    try {
      await buildCommand(files, options);
    } catch (err) {
      logger.error(`\nError: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Vigila archivos AssemblyScript y recompila automaticamente')
  .argument('<files...>', 'Archivos .wasm.ts, .ts, .asm o carpetas a compilar')
  .option('-o, --outDir <dir>', 'Directorio de salida', 'wasm-out')
  .option('--release', 'Modo release (optimizado, sin sourcemaps)', false)
  .option('--runtime <name>', 'Runtime (incremental, minimal, stub, full)', 'incremental')
  .option('--optimizeLevel <n>', 'Nivel de optimizacion 0-3', '3')
  .option('--shrinkLevel <n>', 'Nivel de reduccion 0-2')
  .option('--no-sourcemap', 'Deshabilitar sourcemaps en modo debug')
  .action(async (files: string[], options) => {
    try {
      await watchCommand(files, options);
    } catch (err) {
      logger.error(`\nError: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
