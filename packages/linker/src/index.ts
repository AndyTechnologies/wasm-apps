import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { saveBuildManifest, isBuildUpToDate } from './build-cache.js';
import { resolveDependencies } from './linker.js';
import { generateCCode } from './codegen.js';
import { compileCpp } from './compiler.js';
import type { NativeAppOptions, WasmModuleInfo, WasmImport, WasmExport, WasmImportFuncType, ModuleMatchingStrategy } from '@wasm-apps/types';
import { LinkerError, logger } from '@wasm-apps/types';

export { isBuildUpToDate, saveBuildManifest };
export { getBuildCacheInfo, clearBuildCache } from './build-cache.js';
export { parseWasmModule, mergeImportExportKinds } from './wasm-io.js';
export { setupWasmtime, runSetup, checkWasmtimeSetup, checkSetupStatus } from './setup.js';
export { getCacheInfo, clearCache } from './cache.js';
export { treeShake } from './tree-shake.js';
export { pipeline, Pipeline } from './pipeline.js';
export { loadPlugins } from './plugin-loader.js';
export { PipelinePhase } from '@wasm-apps/types';
export { treeShakeWasm } from './tree-shake.js';

/**
 * Crea un ejecutable nativo a partir de módulos WASM.
 *
 * Pipeline:
 * 1. Lee y parsea los módulos .wasm
 * 2. Resuelve dependencias (orden topológico)
 * 3. Genera código C++ con la API de Wasmtime C++
 * 4. Compila con cmake-js
 *
 * Soporta builds incrementales comparando hashes en el manifiesto de build.
 */
function resolveWasmtimePath(wasmtimePath?: string): string | undefined {
  if (wasmtimePath) return wasmtimePath;
  const cacheDir = path.join(os.homedir(), '.wasm-linker');
  if (!fs.existsSync(cacheDir)) return undefined;
  const entries = fs.readdirSync(cacheDir).filter((e) => e.startsWith('wasmtime-v') && e.endsWith('-c-api'));
  if (entries.length === 0) return undefined;
  entries.sort().reverse();
  return path.join(cacheDir, entries[0]);
}

export async function createNativeApp(options: NativeAppOptions, quiet = false): Promise<string> {
  const { inputPaths, output, entry, wasi, moduleMatching } = options;

  const outputPath = path.resolve(output);
  const { parseWasmModule } = await import('./wasm-io.js');

  const wasmtimeVersion = '46.0.1';
  const resolvedWasmtimePath = resolveWasmtimePath(options.wasmtimePath);
  if (!resolvedWasmtimePath) {
    throw new LinkerError('Wasmtime C-API no encontrado. Ejecuta "wapp setup" primero.', { cacheDir: path.join(os.homedir(), '.wasm-linker') });
  }

  if (!quiet) {
    const cacheOk = await isBuildUpToDate(inputPaths, outputPath, {
      entry,
      target: options.target,
      wasi,
      moduleMatching,
      wasmtimePath: resolvedWasmtimePath,
      wasmtimeVersion,
    });
    if (cacheOk) {
      logger.success(`Build up-to-date: ${outputPath}`);
      return outputPath;
    }
  }

  const modules: WasmModuleInfo[] = [];
  const allImportFuncTypes: WasmImportFuncType[] = [];
  for (const inputPath of inputPaths) {
    const module = parseWasmModule(inputPath);
    modules.push(module);
    if (module.importFuncTypes) {
      allImportFuncTypes.push(...module.importFuncTypes);
    }
  }

  if (!quiet) {
    for (const mod of modules) {
      const funcExports = mod.exports.filter((e: WasmExport) => e.kind === 'function').map((e: WasmExport) => e.name);
      const funcImports = mod.imports.filter((i: WasmImport) => i.kind === 'function').map((i: WasmImport) => `${i.module}.${i.name}`);
      logger.detail(`  ${mod.fileName}: ${funcExports.length} exports, ${funcImports.length} imports`);
    }
  }

  if (!quiet) logger.step('Resolving dependencies...');

  const resolved = resolveDependencies(modules, moduleMatching);

  if (!quiet) logger.step('Generating C++ source...');

  const cpp = generateCCode(resolved, entry, wasi, allImportFuncTypes.length > 0 ? allImportFuncTypes : undefined);

  if (!quiet) logger.step('Compiling native binary...');

  await compileCpp(cpp, outputPath, { ...options, wasmtimePath: resolvedWasmtimePath });

  saveBuildManifest(inputPaths, outputPath, { entry, target: options.target, wasi, moduleMatching, wasmtimePath: resolvedWasmtimePath, wasmtimeVersion });

  if (!quiet) logger.success(`Built: ${outputPath}`);
  return outputPath;
}
