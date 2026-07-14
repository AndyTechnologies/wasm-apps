import { logger, NativeAppOptions, LinkerError } from '@wasm-apps/types';
import { glob } from 'glob';
import path from 'node:path';
import fs from 'node:fs';
import { readWasmModules, parseImportFuncTypes } from './wasm-io.js';
import { resolveDependencies } from './linker.js';
import { generateCCode, validateEntryExport } from './codegen.js';
import { ensureWasmtimeAvailable, WASMTIME_VERSION } from './wasmtime-dl.js';
import { compileWithCMake } from './compiler.js';
import { isBuildUpToDate, saveBuildManifest } from './build-cache.js';

export { runSetup, checkSetupStatus } from './setup.js';
export { getCacheInfo, clearCache, cacheRootDir } from './cache.js';
export { getBuildCacheInfo, clearBuildCache } from './build-cache.js';
export type { SetupOptions, SetupStatus } from './setup.js';

export async function createNativeApp(options: NativeAppOptions): Promise<void> {
  const exeSuffix = process.platform === 'win32' && !options.output.endsWith('.exe') ? '.exe' : '';
  const output = options.output + exeSuffix;
  let wasmFiles: string[] = [];
  for (const p of options.inputPaths) {
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        const files = await glob('**/*.wasm', { cwd: p, absolute: true, nodir: true });
        wasmFiles.push(...files);
      } else if (stat.isFile() && p.endsWith('.wasm')) {
        wasmFiles.push(path.resolve(p));
      } else {
        throw new LinkerError(`La ruta '${p}' no es un archivo .wasm ni una carpeta.`);
      }
    } else {
      throw new LinkerError(`La ruta '${p}' no existe.`);
    }
  }

  if (wasmFiles.length === 0) {
    throw new LinkerError('No se encontraron archivos .wasm.');
  }

  logger.info(`Modulos encontrados: ${wasmFiles.map(f => path.basename(f)).join(', ')}`);

  const wasmtimeVersion = WASMTIME_VERSION;
  const upToDate = await isBuildUpToDate(wasmFiles, output, {
    entry: options.entry,
    target: options.target,
    wasi: options.wasi,
    moduleMatching: options.moduleMatching,
    wasmtimePath: options.wasmtimePath,
    wasmtimeVersion,
  });

  if (upToDate) {
    logger.success(`Binario actualizado: ${path.resolve(output)} (saltando linker)`);
    return;
  }

  const wasmtimePromise = options.wasmtimePath
    ? Promise.resolve({ includeDir: path.join(options.wasmtimePath, 'include'), libPath: path.join(options.wasmtimePath, 'lib', getLibName()) })
    : ensureWasmtimeAvailable();

  const modules = await readWasmModules(wasmFiles);

  const resolved = resolveDependencies(modules, options.moduleMatching);

  logger.info('Dependencias resueltas. Orden de instanciacion:');
  resolved.order.forEach((mod, idx) => {
    logger.detail(`  ${idx}: ${path.basename(mod.module.fileName)} (exports: ${mod.module.exports.map(e => e.name).join(', ')})`);
  });

  validateEntryExport(resolved, options.entry);

  const allImportTypes = resolved.order.flatMap(mod => parseImportFuncTypes(mod.module.buffer));

  const cCode = generateCCode(resolved, options.entry, options.wasi, undefined, allImportTypes);

  const buildDir = path.join(process.cwd(), '.wapp_build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }
  const cFilePath = path.join(buildDir, 'wasm_bundle.cpp');
  fs.writeFileSync(cFilePath, cCode, 'utf-8');
  logger.detail(`Codigo C++ generado en ${cFilePath}`);

  const wasmtimeLib = await wasmtimePromise;

  await compileWithCMake({
    source: cFilePath,
    includeDir: wasmtimeLib.includeDir,
    libPath: wasmtimeLib.libPath,
    output,
    target: options.target,
    wasi: options.wasi,
  });

  if (process.platform === 'win32') {
    const wasmtimeCacheDir = path.dirname(path.dirname(wasmtimeLib.libPath));
    const dllSource = path.join(wasmtimeCacheDir, 'bin', 'wasmtime.dll');
    if (fs.existsSync(dllSource)) {
      const outputDir = path.dirname(path.resolve(output));
      const dllDest = path.join(outputDir, 'wasmtime.dll');
      fs.copyFileSync(dllSource, dllDest);
      logger.detail(`wasmtime.dll copiado a ${dllDest}`);
    }
  }

  saveBuildManifest(wasmFiles, output, {
    entry: options.entry,
    target: options.target,
    wasi: options.wasi,
    moduleMatching: options.moduleMatching,
    wasmtimePath: options.wasmtimePath,
    wasmtimeVersion,
  });
}

function getLibName(): string {
  return process.platform === 'win32' ? 'wasmtime.lib' : 'libwasmtime.a';
}
