import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { glob } from 'glob';
import { logger, ConfigError, type WappConfig, type ModuleMatchingStrategy, type ToolchainId } from '@wasm-apps/types';
import {
  ToolchainRouter,
  AssemblyScriptToolchainStrategy,
  CppCompilerStrategy,
  RustCompilerStrategy,
  PrecompiledWasmStrategy,
  ToolchainNotInstalledError,
  getCompileCacheInfo,
  clearCompileCache,
} from '@wasm-apps/compiler';
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
  watchDirectory,
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

function getCompilerOptionsForToolchain(
  global: WappConfig['compiler'] | undefined,
  toolchainId: string,
): {
  release?: boolean;
  runtime?: string;
  optimizeLevel?: number;
  shrinkLevel?: number;
  sourceMap?: boolean;
} {
  const base: Record<string, unknown> = {};
  if (global?.release !== undefined) base.release = global.release;
  if (global?.runtime !== undefined) base.runtime = global.runtime;
  if (global?.optimizeLevel !== undefined) base.optimizeLevel = global.optimizeLevel;
  if (global?.shrinkLevel !== undefined) base.shrinkLevel = global.shrinkLevel;
  if (global?.sourceMap !== undefined) base.sourceMap = global.sourceMap;

  const toolchainOverrides = global?.toolchains?.[toolchainId as ToolchainId];
  if (toolchainOverrides) {
    return { ...base, ...toolchainOverrides } as any;
  }
  return base as any;
}

/**
 * Compila todos los archivos fuente encontrados en sourceDir a WebAssembly,
 * usando el ToolchainRouter para enrutar cada archivo a su estrategia de compilación.
 */
async function compileProjectFiles(
  sourceDir: string,
  outDir: string,
  rootDir: string,
  config: WappConfig,
  _pipelineContext: Record<string, any>,
): Promise<string[]> {
  // 1. Create ToolchainRouter and register all built-in strategies
  const router = new ToolchainRouter();
  router.registerBuiltins([new AssemblyScriptToolchainStrategy(), new CppCompilerStrategy(), new RustCompilerStrategy(), new PrecompiledWasmStrategy()]);

  // 2. Glob all supported compiled extensions
  const compiledGlob = '**/*.wasm.{ts,mjs,as,cpp,cxx,cc,rs}';
  const compiledFiles = await glob(compiledGlob, { cwd: sourceDir, absolute: true, nodir: true });

  // 3. Glob precompiled .wasm files separately (files that end in just .wasm)
  const allWasmFiles = await glob('**/*.wasm', { cwd: sourceDir, absolute: true, nodir: true });
  const precompiledFiles = allWasmFiles.filter((f) => /\.wasm$/i.test(path.basename(f)));

  // 4. Exclude build artifacts from cargo target/ and node_modules/
  const isExcluded = (f: string) => {
    const sep = path.sep;
    // Match /target/ or /node_modules/ at any path depth (cross-platform)
    const targetPattern = `${sep}target${sep}`;
    const nodeModulesPattern = `${sep}node_modules${sep}`;
    // Also handle trailing paths (end of string after sep)
    return f.includes(targetPattern) || f.includes(nodeModulesPattern) || f.endsWith(`${sep}target`) || f.endsWith(`${sep}node_modules`);
  };
  const filteredCompiled = compiledFiles.filter((f) => !isExcluded(f));
  const filteredPrecompiled = precompiledFiles.filter((f) => !isExcluded(f));

  const allFiles = [...filteredCompiled, ...filteredPrecompiled];

  if (allFiles.length === 0) {
    throw new ConfigError(
      `No se encontraron archivos fuente en '${sourceDir}'. Formatos soportados: .wasm, .wasm.ts, .wasm.mjs, .as, .wasm.cpp, .wasm.cxx, .wasm.cc, .wasm.rs`,
      { sourceDir },
    );
  }

  const wasmFiles: string[] = [];
  const errors: Array<{ file: string; message: string }> = [];

  for (const file of allFiles) {
    const relativeName = path.relative(rootDir, file);
    logger.info(`  Compilando ${relativeName}...`);

    // Read source code (strategies that need it will use it; binary .wasm gracefully falls back)
    let sourceCode = '';
    try {
      sourceCode = fs.readFileSync(file, 'utf-8');
    } catch {
      // Precompiled .wasm files are binary; strategies handle read from disk
    }

    // Resolve strategy via extension
    const ext = router.getExtension(file);
    const strategy = router.resolveForExtension(ext);
    if (!strategy) {
      errors.push({ file, message: `No hay toolchain registrado para: ${file}` });
      continue;
    }

    // Check if the toolchain is available before attempting compilation
    const available = await strategy.isAvailable();
    if (!available) {
      errors.push({ file, message: `Toolchain "${strategy.id}" no está disponible. Saltando ${relativeName}.` });
      continue;
    }

    // Get per-toolchain compiler options
    const toolchainId = strategy.id as ToolchainId;
    const compilerOptions = getCompilerOptionsForToolchain(config.compiler, toolchainId);

    let result: Awaited<ReturnType<typeof strategy.compile>>;
    try {
      result = await strategy.compile({
        sourceCode,
        fileName: file,
        compilerOptions,
      });
    } catch (err: any) {
      errors.push({ file, message: err.message ?? String(err) });
      continue;
    }

    // Determine output name based on toolchain
    const basename = path.basename(file);
    const baseWithoutExt = basename.slice(0, -(ext.length || 0));

    let wasmFileName: string;
    switch (strategy.id) {
      case 'assemblyscript':
        wasmFileName = `${baseWithoutExt}.wasm`;
        break;
      case 'cpp':
        wasmFileName = `${baseWithoutExt}.cpp.wasm`;
        break;
      case 'rust':
        wasmFileName = `${baseWithoutExt}.rust.wasm`;
        break;
      case 'precompiled':
        wasmFileName = `${baseWithoutExt}.wasm`;
        break;
      default:
        wasmFileName = `${baseWithoutExt}.wasm`;
    }

    const wasmPath = path.join(outDir, wasmFileName);
    fs.writeFileSync(wasmPath, result.wasmBytes);
    wasmFiles.push(wasmPath);
  }

  // Report partial failures
  if (errors.length > 0) {
    for (const err of errors) {
      logger.warn(`  ${err.file}: ${err.message}`);
    }
    if (wasmFiles.length === 0) {
      throw new ConfigError(`Todos los archivos fuente fallaron al compilar (${errors.length} errores). Revisá que los toolchains estén instalados.`, {
        sourceDir,
        errors,
      });
    }
    logger.warn(`  ${errors.length} archivo(s) fallaron, ${wasmFiles.length} compilados exitosamente.`);
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
  let outputName = (config.output || path.basename(rootDir)).replace(/\.exe$/i, '');
  if (!outputName) outputName = path.basename(rootDir);
  const output =
    (path.isAbsolute(outputName)
      ? outputName
      : outputName.includes('/') || outputName.includes('\\')
        ? path.resolve(rootDir, outputName)
        : path.join(outDir, outputName)) + exeSuffix;
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
  verbose = false,
): Promise<void> {
  logger.step('Linkeando ejecutable nativo...');

  await createNativeApp(
    {
      inputPaths: wasmFiles,
      output,
      target: target || config.target,
      entry,
      wasi: wasi || config.wasi || false,
      moduleMatching,
      wasmtimePath: config.wasmtimePath,
      mounts: config.mounts,
    },
    !verbose,
  );

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
  verbose?: boolean;
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
  logger.step('Compilando fuentes a WebAssembly...');
  const wasmFiles = await compileProjectFiles(sourceDir, outDir, rootDir, config, ctx);
  ctx = await pipeline.runPhase(PipelinePhase.AfterModuleCompile, ctx);

  logger.success(`Compilacion completada: ${wasmFiles.length} archivos .wasm generados en ${outDir}`);

  ctx = await pipeline.runPhase(PipelinePhase.BeforeCodeGen, ctx);

  const { output, entry, moduleMatching } = resolveOutputPath(config, rootDir, outDir, options.entry, options.moduleMatching);

  ctx = await pipeline.runPhase(PipelinePhase.BeforeLink, ctx);
  await linkNativeApp(wasmFiles, output, entry, moduleMatching, config, options.target, options.wasi, options.verbose);
  ctx = await pipeline.runPhase(PipelinePhase.AfterLink, ctx);

  ctx = await pipeline.runPhase(PipelinePhase.AfterCodeGen, ctx);
  await pipeline.runPhase(PipelinePhase.AfterBundle, ctx);
}

async function buildOnce(config: WappConfig, rootDir: string, sourceDir: string, outDir: string, wasi: boolean, verbose = false): Promise<void> {
  await loadPlugins(config.plugins);

  let wasmFiles: string[];
  try {
    wasmFiles = await compileProjectFiles(sourceDir, outDir, rootDir, config, {});
  } catch (err: any) {
    if (err instanceof ConfigError && err.message.includes('No se encontraron archivos fuente')) {
      logger.warn(err.message);
      return;
    }
    throw err;
  }

  const { output, entry, moduleMatching } = resolveOutputPath(config, rootDir, outDir, config.entry, config.moduleMatching);
  await linkNativeApp(wasmFiles, output, entry, moduleMatching, config, config.target, wasi, verbose);
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
  verbose?: boolean;
}): Promise<void> {
  const rootDir = path.resolve(options.rootDir);
  const compilerOverrides: WappConfig['compiler'] = {};
  if (options.release !== undefined) compilerOverrides.release = options.release;
  const config = resolveConfig(rootDir, {
    entry: options.entry,
    target: options.target,
    output: options.output,
    sourceDir: options.sourceDir,
    outDir: options.outDir,
    compiler: Object.keys(compilerOverrides).length > 0 ? compilerOverrides : undefined,
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
  await buildOnce(config, rootDir, sourceDir, outDir, wasi, options.verbose);

  logger.step(`Vigilando ${sourceDir} por cambios en archivos fuente...`);
  logger.detail('Esperando cambios... (Ctrl+C para salir)\n');

  const stopWatching = watchDirectory(sourceDir, {
    extensions: ['.wasm.ts', '.wasm.mjs', '.as', '.wasm.cpp', '.wasm.cxx', '.wasm.cc', '.wasm.rs', '.ts'],
    onChange: async (changedFile) => {
      const relativeName = path.relative(rootDir, changedFile);
      logger.step(`\nCambio detectado en ${relativeName}, recompilando...`);
      try {
        await buildOnce(config, rootDir, sourceDir, outDir, wasi, options.verbose);
      } catch (err: any) {
        logger.error(`Error: ${err.message}`);
      }
      logger.detail('\nEsperando cambios... (Ctrl+C para salir)\n');
    },
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
    if (typeof dlInfo.entries === 'number' && dlInfo.entries > 0) {
      logger.info(`  Entradas cacheadas: ${dlInfo.entries}`);
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
