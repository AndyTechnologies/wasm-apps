import path from 'path';
import fs from 'fs';
import { glob } from 'glob';
import { logger, ConfigError, type WappConfig, type ModuleMatchingStrategy } from '@wasm-apps/types';
import { compileWasm } from '@wasm-apps/compiler';
import { createNativeApp, runSetup as linkerSetup, getCacheInfo, clearCache as linkerClearCache, checkSetupStatus } from '@wasm-apps/linker';

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
      config = { ...config, ...raw, compiler: { ...config.compiler, ...raw.compiler } };
    } catch (err: any) {
      throw new ConfigError(`Error leyendo ${CONFIG_FILE}: ${err.message}`, { configPath });
    }
  }

  if (overrides) {
    const cleaned = cleanUndefined(overrides);
    if (Object.keys(cleaned).length > 0) {
      config = { ...config, ...cleaned, compiler: { ...config.compiler, ...cleaned.compiler } };
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
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  logger.success(`${CONFIG_FILE} creado en ${rootDir}`);
  return config;
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

  logger.success(`Compilacion completada: ${wasmFiles.length} archivos .wasm generados en ${outDir}`);

  const outputName = config.output || path.basename(rootDir);
  const output = path.isAbsolute(outputName)
    ? outputName
    : outputName.includes(path.sep)
      ? path.resolve(rootDir, outputName)
      : path.join(outDir, outputName);
  const entry = options.entry || config.entry || '_start';
  const moduleMatching = options.moduleMatching || config.moduleMatching || 'file-name';

  logger.step('Linkeando ejecutable nativo...');

  await createNativeApp({
    inputPaths: wasmFiles,
    output,
    target: options.target || config.target,
    entry,
    wasi: options.wasi || config.wasi || false,
    moduleMatching,
    wasmtimePath: config.wasmtimePath,
  });

  logger.success(`Ejecutable creado: ${path.resolve(output)}`);
}

export async function runSetup(): Promise<void> {
  await linkerSetup();
}

export async function cacheInfo(): Promise<void> {
  const info = await getCacheInfo();
  if (!info.exists) {
    logger.info('No hay cache de descargas.');
    return;
  }
  logger.info(`Ruta: ${info.path}`);
  logger.info(`Tamano: ${info.humanSize} (${info.size} bytes)`);
  if (info.entries.length > 0) {
    logger.info('Contenido:');
    for (const entry of info.entries) {
      logger.info(`  ${entry}`);
    }
  }

  const status = await checkSetupStatus();
  if (status.wasmtime.status === 'ok') {
    logger.info(`Wasmtime: ${status.wasmtime.path} — OK`);
  }
}

export async function clearCache(): Promise<void> {
  await linkerClearCache();
}
