import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { glob } from 'glob';
import { logger, ConfigError, type WappConfig, type ModuleMatchingStrategy } from '@wasm-apps/types';
import { compileWasm, getCompileCacheInfo, clearCompileCache } from '@wasm-apps/compiler';
import {
  createNativeApp,
  runSetup as linkerSetup,
  getCacheInfo,
  clearCache as linkerClearCache,
  checkSetupStatus,
  getBuildCacheInfo,
  clearBuildCache,
  loadPlugins,
  pipeline,
  PipelinePhase,
} from '@wasm-apps/linker';

const CONFIG_FILE = 'wapp.json';

const DEFAULT_CONFIG: WappConfig = {
  sourceDir: 'src',
  outDir: 'wasm-out',
  entry: '_start',
  moduleMatching: 'file-name',
  compiler: {
    release: false,
    runtime: 'incremental',
    optimizeLevel: 3,
    shrinkLevel: 2,
    sourceMap: true,
  },
};

function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) cleaned[key] = obj[key];
  }
  return cleaned;
}

export function resolveConfig(rootDir: string, overrides?: Partial<WappConfig>): WappConfig {
  const configPath = path.join(rootDir, CONFIG_FILE);
  let config: WappConfig = { ...DEFAULT_CONFIG };

  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = {
        ...config,
        ...raw,
        compiler: { ...config.compiler, ...raw.compiler },
        plugins: raw.plugins ?? config.plugins,
        optimization: raw.optimization ?? config.optimization,
      };
    } catch (err: any) {
      throw new ConfigError(`Error leyendo ${CONFIG_FILE}: ${err.message}`, { configPath });
    }
  }

  if (overrides) {
    const cleaned = cleanUndefined(overrides);
    if (Object.keys(cleaned).length > 0) {
      config = {
        ...config,
        ...cleaned,
        compiler: { ...config.compiler, ...cleaned.compiler },
        plugins: cleaned.plugins ?? config.plugins,
        optimization: cleaned.optimization ?? config.optimization,
      };
    }
  }

  return config;
}

export function initProject(rootDir: string, overrides?: Partial<WappConfig>): WappConfig {
  const configPath = path.join(rootDir, CONFIG_FILE);
  if (fs.existsSync(configPath)) {
    throw new ConfigError(`Ya existe ${CONFIG_FILE} en ${rootDir}`, { configPath });
  }

  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }

  const config = { ...DEFAULT_CONFIG, ...overrides };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + os.EOL);
  logger.success(`${CONFIG_FILE} creado en ${rootDir}`);
  return config;
}

async function compileWasFiles(
  wasmTsFiles: string[],
  sourceDir: string,
  outDir: string,
  rootDir: string,
  config: WappConfig,
  pipelineContext: Record<string, any>,
): Promise<string[]> {
  const isDev = !config.compiler?.release;
  const wasmFiles: string[] = [];

  for (const file of wasmTsFiles) {
    const sourceCode = fs.readFileSync(file, 'utf-8');
    const relativeName = path.relative(rootDir, file);

    logger.info(`  Compilando ${relativeName}...`);

    const result = await compileWasm({
      fileName: file,
      sourceCode,
      isDev,
      runtime: config.compiler?.runtime || 'incremental',
      sourceMap: isDev ? config.compiler?.sourceMap : false,
      optimizeLevel: config.compiler?.optimizeLevel,
      shrinkLevel: config.compiler?.shrinkLevel,
    });

    let baseName = path.basename(file, '.wasm.ts');
    const wasmPath = path.join(outDir, `${baseName}.wasm`);
    fs.writeFileSync(wasmPath, result.wasmBytes);

    wasmFiles.push(wasmPath);
  }

  return wasmFiles;
}

function resolveOutputPath(
  config: WappConfig,
  rootDir: string,
  outDir: string,
  customEntry?: string,
  customMatching?: ModuleMatchingStrategy,
): { output: string; entry: string; moduleMatching: ModuleMatchingStrategy } {
  const exeSuffix = process.platform === 'win32' ? '.exe' : '';
  const outputName = (config.output || path.basename(rootDir)).replace(/\.exe$/i, '');
  const output =
    (path.isAbsolute(outputName) ? outputName : outputName.includes(path.sep) ? path.resolve(rootDir, outputName) : path.join(outDir, outputName)) + exeSuffix;
  const entry = customEntry || config.entry || '_start';
  const moduleMatching = customMatching || config.moduleMatching || 'file-name';
  return { output, entry, moduleMatching };
}

async function linkNativeApp(
  wasmFiles: string[],
  output: string,
  entry: string,
  moduleMatching: ModuleMatchingStrategy,
  config: WappConfig,
  target?: string,
  wasi?: boolean,
): Promise<void> {
  logger.step('Linkeando ejecutable nativo...');

  await createNativeApp({
    inputPaths: wasmFiles,
    output,
    target: target || config.target,
    entry,
    wasi: wasi || config.wasi || false,
    moduleMatching,
    wasmtimePath: config.wasmtimePath,
  });

  logger.success(`Ejecutable creado: ${path.resolve(output)}`);
}

export async function buildProject(options: {
  rootDir: string;
  output?: string;
  target?: string;
  entry?: string;
  moduleMatching?: ModuleMatchingStrategy;
  wasi?: boolean;
  release?: boolean;
  optimizeLevel?: number;
  shrinkLevel?: number;
  sourceDir?: string;
  outDir?: string;
}): Promise<void> {
  const rootDir = path.resolve(options.rootDir);
  const compilerOverrides: WappConfig['compiler'] = {};
  if (options.release !== undefined) compilerOverrides.release = options.release;
  if (options.optimizeLevel !== undefined) compilerOverrides.optimizeLevel = options.optimizeLevel;
  if (options.shrinkLevel !== undefined) compilerOverrides.shrinkLevel = options.shrinkLevel;
  const config = resolveConfig(rootDir, {
    entry: options.entry,
    moduleMatching: options.moduleMatching,
    target: options.target,
    sourceDir: options.sourceDir,
    outDir: options.outDir,
    output: options.output,
    compiler: Object.keys(compilerOverrides).length > 0 ? compilerOverrides : undefined,
  });

  await loadPlugins(config.plugins);

  const sourceDir = path.resolve(rootDir, config.sourceDir || 'src');
  const outDir = path.resolve(rootDir, config.outDir || 'wasm-out');

  if (!fs.existsSync(sourceDir)) {
    throw new ConfigError(`El directorio fuente '${sourceDir}' no existe. Crea '${CONFIG_FILE}' o especifica --source-dir.`, { sourceDir });
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const wasmTsFiles = await glob('**/*.wasm.ts', { cwd: sourceDir, absolute: true, nodir: true });
  if (wasmTsFiles.length === 0) {
    throw new ConfigError(`No se encontraron archivos .wasm.ts en '${sourceDir}'.`, { sourceDir });
  }

  logger.step(`Compilando ${wasmTsFiles.length} archivos AssemblyScript...`);

  const pipelineContext = {
    sourceDir,
    outDir,
    options: {
      entry: config.entry || '_start',
      wasi: config.wasi || false,
      moduleMatching: config.moduleMatching || 'file-name',
      target: config.target,
      release: config.compiler?.release,
      optimizeLevel: config.compiler?.optimizeLevel,
      shrinkLevel: config.compiler?.shrinkLevel,
    },
    pluginConfigs: config.plugins,
  };

  let ctx = await pipeline.runPhase(PipelinePhase.BeforeModuleCompile, pipelineContext);
  const wasmFiles = await compileWasFiles(wasmTsFiles, sourceDir, outDir, rootDir, config, ctx);
  ctx = await pipeline.runPhase(PipelinePhase.AfterModuleCompile, ctx);

  logger.success(`Compilacion completada: ${wasmFiles.length} archivos .wasm generados en ${outDir}`);

  ctx = await pipeline.runPhase(PipelinePhase.BeforeCodeGen, ctx);

  const { output, entry, moduleMatching } = resolveOutputPath(config, rootDir, outDir, options.entry, options.moduleMatching);
  await linkNativeApp(wasmFiles, output, entry, moduleMatching, config, options.target, options.wasi);

  await pipeline.runPhase(PipelinePhase.AfterCodeGen, ctx);
}

async function buildOnce(config: WappConfig, rootDir: string, sourceDir: string, outDir: string, wasi: boolean): Promise<void> {
  const wasmTsFiles = await glob('**/*.wasm.ts', { cwd: sourceDir, absolute: true, nodir: true });
  if (wasmTsFiles.length === 0) {
    logger.warn('No se encontraron archivos .wasm.ts.');
    return;
  }

  const wasmFiles = await compileWasFiles(wasmTsFiles, sourceDir, outDir, rootDir, config, {});
  const { output, entry, moduleMatching } = resolveOutputPath(config, rootDir, outDir, config.entry, config.moduleMatching);
  await linkNativeApp(wasmFiles, output, entry, moduleMatching, config, config.target, wasi);
}

export async function devCommand(options: {
  rootDir: string;
  output?: string;
  target?: string;
  entry?: string;
  wasi?: boolean;
  release?: boolean;
  sourceDir?: string;
  outDir?: string;
}): Promise<void> {
  const rootDir = path.resolve(options.rootDir);
  const config = resolveConfig(rootDir, {
    entry: options.entry,
    target: options.target,
    output: options.output,
    sourceDir: options.sourceDir,
    outDir: options.outDir,
  });

  const sourceDir = path.resolve(rootDir, config.sourceDir || 'src');
  const outDir = path.resolve(rootDir, config.outDir || 'wasm-out');
  const wasi = options.wasi || config.wasi || false;

  if (!fs.existsSync(sourceDir)) {
    throw new ConfigError(`El directorio fuente '${sourceDir}' no existe.`, { sourceDir });
  }
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  await loadPlugins(config.plugins);

  if (process.platform !== 'win32') {
    process.on('SIGINT', () => {
      logger.info('\nDeteniendo watch...');
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      logger.info('\nDeteniendo watch...');
      process.exit(0);
    });
  }

  logger.step('Build inicial...');
  await buildOnce(config, rootDir, sourceDir, outDir, wasi);

  logger.step(`Vigilando ${sourceDir} por cambios en .wasm.ts...`);
  logger.detail('Esperando cambios... (Ctrl+C para salir)\n');

  if (process.platform === 'linux') {
    logger.detail('Nota: en Linux, fs.watch recursive no vigila subdirectorios. Para watch completo, instala chokidar.');
  }

  let debounceTimer: ReturnType<typeof setTimeout>;

  fs.watch(sourceDir, { recursive: true }, (_eventType, filename) => {
    const normalizedName = filename ? path.normalize(filename) : null;
    if (normalizedName && (normalizedName.endsWith('.wasm.ts') || normalizedName.endsWith('.ts'))) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        logger.step(`\nCambio detectado en ${normalizedName}, recompilando...`);
        try {
          await buildOnce(config, rootDir, sourceDir, outDir, wasi);
        } catch (err: any) {
          logger.error(`Error: ${err.message}`);
        }
        logger.detail('\nEsperando cambios... (Ctrl+C para salir)\n');
      }, 300);
    }
  });

  await new Promise(() => {});
}

async function buildOnce(config: WappConfig, rootDir: string, sourceDir: string, outDir: string, wasi: boolean): Promise<void> {
  const wasmTsFiles = await glob('**/*.wasm.ts', { cwd: sourceDir, absolute: true, nodir: true });
  if (wasmTsFiles.length === 0) {
    logger.warn('No se encontraron archivos .wasm.ts.');
    return;
  }

  const isDev = !config.compiler?.release;
  const wasmFiles: string[] = [];

  for (const file of wasmTsFiles) {
    const sourceCode = fs.readFileSync(file, 'utf-8');
    const result = await compileWasm({
      fileName: file,
      sourceCode,
      isDev,
      runtime: config.compiler?.runtime || 'incremental',
      sourceMap: isDev ? config.compiler?.sourceMap : false,
      optimizeLevel: config.compiler?.optimizeLevel,
      shrinkLevel: config.compiler?.shrinkLevel,
    });

    let baseName = path.basename(file, '.wasm.ts');
    const wasmPath = path.join(outDir, `${baseName}.wasm`);
    fs.writeFileSync(wasmPath, result.wasmBytes);
    wasmFiles.push(wasmPath);
  }

  const exeSuffix = process.platform === 'win32' ? '.exe' : '';
  const outputName = (config.output || path.basename(rootDir)).replace(/\.exe$/i, '');
  const output = (path.isAbsolute(outputName)
    ? outputName
    : outputName.includes(path.sep)
      ? path.resolve(rootDir, outputName)
      : path.join(outDir, outputName)) + exeSuffix;

  await createNativeApp({
    inputPaths: wasmFiles,
    output,
    target: config.target,
    entry: config.entry || '_start',
    wasi,
    moduleMatching: config.moduleMatching || 'file-name',
    wasmtimePath: config.wasmtimePath,
  });
}

export async function devCommand(options: {
  rootDir: string;
  output?: string;
  target?: string;
  entry?: string;
  wasi?: boolean;
  release?: boolean;
  sourceDir?: string;
  outDir?: string;
}): Promise<void> {
  const rootDir = path.resolve(options.rootDir);
  const config = resolveConfig(rootDir, {
    entry: options.entry,
    target: options.target,
    output: options.output,
    sourceDir: options.sourceDir,
    outDir: options.outDir,
  });

  const sourceDir = path.resolve(rootDir, config.sourceDir || 'src');
  const outDir = path.resolve(rootDir, config.outDir || 'wasm-out');
  const wasi = options.wasi || config.wasi || false;

  if (!fs.existsSync(sourceDir)) {
    throw new ConfigError(`El directorio fuente '${sourceDir}' no existe.`, { sourceDir });
  }
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  await loadPlugins(config.plugins);

  if (process.platform !== 'win32') {
    process.on('SIGINT', () => { logger.info('\nDeteniendo watch...'); process.exit(0); });
    process.on('SIGTERM', () => { logger.info('\nDeteniendo watch...'); process.exit(0); });
  }

  logger.step('Build inicial...');
  await buildOnce(config, rootDir, sourceDir, outDir, wasi);

  logger.step(`Vigilando ${sourceDir} por cambios en .wasm.ts...`);
  logger.detail('Esperando cambios... (Ctrl+C para salir)\n');

  if (process.platform === 'linux') {
    logger.detail('Nota: en Linux, fs.watch recursive no vigila subdirectorios. Para watch completo, instala chokidar.');
  }

  let debounceTimer: ReturnType<typeof setTimeout>;
  const buildKey = (fn: string) => options.entry || config.entry || fn.replace('.wasm.ts', '');

  fs.watch(sourceDir, { recursive: true }, (_eventType, filename) => {
    const normalizedName = filename ? path.normalize(filename) : null;
    if (normalizedName && (normalizedName.endsWith('.wasm.ts') || normalizedName.endsWith('.ts'))) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        logger.step(`\nCambio detectado en ${normalizedName}, recompilando...`);
        try {
          await buildOnce(config, rootDir, sourceDir, outDir, wasi);
        } catch (err: any) {
          logger.error(`Error: ${err.message}`);
        }
        logger.detail('\nEsperando cambios... (Ctrl+C para salir)\n');
      }, 300);
    }
  });

  await new Promise(() => {});
}

export async function runSetup(): Promise<void> {
  await linkerSetup();
}

export async function cacheInfo(): Promise<void> {
  logger.step('Cache de descargas (Wasmtime):');
  const dlInfo = await getCacheInfo();
  if (dlInfo.exists) {
    logger.info(`  Ruta: ${dlInfo.path}`);
    logger.info(`  Tamano: ${dlInfo.humanSize} (${dlInfo.size} bytes)`);
    if (dlInfo.entries.length > 0) {
      logger.info('  Contenido:');
      for (const entry of dlInfo.entries) {
        logger.info(`    ${entry}`);
      }
    }
    const status = await checkSetupStatus();
    if (status.wasmtime.status === 'ok') {
      logger.info(`  Wasmtime: ${status.wasmtime.path} — OK`);
    }
  } else {
    logger.info('  No hay cache de descargas.');
  }

  logger.step('Cache de compilacion (AssemblyScript):');
  const compInfo = getCompileCacheInfo();
  if (compInfo.exists) {
    logger.info(`  Ruta: ${compInfo.path}`);
    logger.info(`  Tamano: ${compInfo.humanSize} (${compInfo.size} bytes)`);
    logger.info(`  Entradas cacheadas: ${compInfo.entries}`);
  } else {
    logger.info('  No hay cache de compilacion.');
  }

  logger.step('Cache de build (linker):');
  const buildInfo = getBuildCacheInfo();
  if (buildInfo.exists) {
    logger.info(`  Ruta: ${buildInfo.path}`);
    logger.info(`  Tamano: ${buildInfo.humanSize} (${buildInfo.size} bytes)`);
  } else {
    logger.info('  No hay cache de build.');
  }
}

export async function clearCache(options?: { build?: boolean; linker?: boolean; all?: boolean }): Promise<void> {
  const noFlags = !options?.build && !options?.linker && !options?.all;
  const clearBuild = !!(options?.all || options?.build || noFlags);
  const clearLinker = !!(options?.all || options?.linker);

  if (clearBuild) {
    logger.info('Limpiando cache de compilacion...');
    clearCompileCache();

    logger.info('Limpiando cache de build...');
    clearBuildCache();

    logger.success('Cache de proyecto eliminada.');
  }

  if (clearLinker) {
    logger.info('Limpiando cache de descargas (Wasmtime)...');
    await linkerClearCache();
    logger.success('Cache de descargas eliminada.');
  }

  if (!clearBuild && !clearLinker) {
    logger.info('No se especifico que cache eliminar.');
  }
}
