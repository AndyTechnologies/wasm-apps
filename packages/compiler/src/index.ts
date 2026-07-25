import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runExecFile } from './strategies/_utils.js';
import { LRUCache, MAX_MEMORY_CACHE_SIZE } from './cache.js';
import { compareHash, hashString, mergeAsConfig } from './utils.js';
import { getCached, saveToCache, computeKey } from './disk-cache.js';
import type { CompileOptions, CompileResult } from '@wasm-apps/types';
import { CompilerError } from '@wasm-apps/types';

export { getCompileCacheInfo, clearCompileCache, deleteCacheEntry, computeToolchainKey } from './disk-cache.js';
export { AssemblyScriptToolchainStrategy } from './strategies/assemblyscript-strategy.js';
export { CppCompilerStrategy } from './strategies/cpp-strategy.js';
export { RustCompilerStrategy } from './strategies/rust-strategy.js';
export { PrecompiledWasmStrategy } from './strategies/precompiled-strategy.js';
export { ToolchainRouter } from './toolchain-router.js';
export { UnsupportedExtensionError, ToolchainNotInstalledError } from './errors.js';
export type { ToolchainStrategy, ToolchainCompileOptions, ToolchainResult } from './strategies/toolchain-strategy.js';
export { TOOLCHAIN_STRATEGY_VERSION } from './strategies/toolchain-strategy.js';

const MEMORY_CACHE = new LRUCache<string, CompileResult>();
const PROJECT_ROOT = process.cwd();

/** Limpia la caché en memoria (útil en tests). */
export function clearMemoryCache(): void {
  MEMORY_CACHE.clear();
}

/**
 * Resuelve el comando `asc` para compilar AssemblyScript.
 * Busca en:
 *   1. `node_modules/.bin/asc` desde PROJECT_ROOT hacia arriba (local pnpm/npm)
 *   2. `asc` directo (PATH global o fallback)
 * @returns La ruta/commando a ejecutar.
 */
export function resolveAsc(): string {
  // Buscar en node_modules/.bin/asc subiendo desde PROJECT_ROOT
  let dir = PROJECT_ROOT;
  while (true) {
    const candidate = path.join(dir, 'node_modules', '.bin', 'asc');
    if (fs.existsSync(candidate)) return candidate;
    if (process.platform === 'win32' && fs.existsSync(candidate + '.cmd')) return candidate + '.cmd';
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return 'asc'; // fallback — será resuelto via PATH
}

// ---------------------------------------------------------------------------
// Core: invocación de asc sin caché, compartida entre compileWasm y el strategy
// ---------------------------------------------------------------------------

/** Resultado intermedio de compilar con asc. */
export interface AscCoreResult {
  wasmBytes: Uint8Array;
  dtsContent: string;
  bindingsJs: string;
  sourceMap: string | null;
  hash: string;
}

/**
 * Ejecuta `asc` (AssemblyScript CLI) con los argumentos adecuados y devuelve
 * los archivos generados. No aplica caché — es la capa pura de spawn + I/O.
 *
 * Usada tanto por `compileWasm()` (que añade caché encima) como por
 * `AssemblyScriptToolchainStrategy.compile()` (que produce ToolchainResult).
 */
export async function compileAssemblyScriptCore(
  sourceCode: string,
  fileName: string,
  isDev: boolean,
  runtime: string,
  sourceMap: boolean,
  optimizeLevel: number,
  shrinkLevel?: number,
): Promise<AscCoreResult> {
  const hash = hashString(sourceCode);
  const target = isDev ? 'debug' : 'release';
  const configOptions = mergeAsConfig({}, target);

  // Build asc CLI arguments
  const baseArgs: string[] = [];

  if (isDev) {
    baseArgs.push('--debug');
    if (sourceMap) {
      baseArgs.push('--sourceMap');
    }
  } else {
    baseArgs.push('--optimize');
    baseArgs.push('--optimizeLevel', optimizeLevel.toString());
    if (shrinkLevel !== undefined && shrinkLevel > 0) {
      baseArgs.push('--shrinkLevel', shrinkLevel.toString());
    }
    baseArgs.push('--noAssert');
  }

  baseArgs.push('--runtime', runtime, '--exportRuntime', '--bindings', 'raw');

  for (const [key, value] of Object.entries({ ...configOptions })) {
    if (typeof value === 'boolean') {
      if (value) baseArgs.push(`--${key}`);
    } else {
      baseArgs.push(`--${key}`, value.toString());
    }
  }

  // Determine input and output paths.
  // When fileName points to a real file on disk, compile from the original path
  // so asc can resolve relative imports (e.g. `./math`). When it's a virtual path
  // (unit tests), write source to a temp dir.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asc-compile-'));
  const outFile = path.join(tmpDir, 'output.wasm');
  let srcFile: string;
  let cleanupTmpDir = true;

  try {
    const resolvedFileName = fileName ? path.resolve(fileName) : '';
    if (resolvedFileName && fs.existsSync(resolvedFileName) && fs.statSync(resolvedFileName).isFile()) {
      srcFile = resolvedFileName;
      const diskContent = fs.readFileSync(srcFile, 'utf-8');
      if (diskContent !== sourceCode) {
        // Source fue transformada — escribir en temp dir con estructura de proyecto
        const relativePath = path.relative(PROJECT_ROOT, resolvedFileName);
        srcFile = path.join(tmpDir, relativePath);
        fs.mkdirSync(path.dirname(srcFile), { recursive: true });
        fs.writeFileSync(srcFile, sourceCode, 'utf-8');
        cleanupTmpDir = true;
      } else {
        // Source coincide con disco — no limpiar tmpDir, no lo usamos para src
        cleanupTmpDir = false;
      }
    } else {
      // Archivo virtual (tests, o path inexistente) — escribir a temp dir
      srcFile = path.join(tmpDir, 'source.ts');
      fs.writeFileSync(srcFile, sourceCode, 'utf-8');
    }

    baseArgs.unshift('--outFile', outFile);
    baseArgs.unshift(srcFile);

    const ascCmd = resolveAsc();
    const { stderr } = await runExecFile(ascCmd, baseArgs);

    const stderrStr = stderr?.toString() || '';

    if (stderrStr.includes('ERROR') || stderrStr.includes('FAIL')) {
      throw new CompilerError(`Error en compilacion AssemblyScript:\n${stderrStr}`, {
        fileName,
        stderr: stderrStr,
      });
    }

    // Leer outputs generados por asc
    const outWasmPath = path.join(tmpDir, 'output.wasm');
    const outJsPath = path.join(tmpDir, 'output.js');
    const outDtsPath = path.join(tmpDir, 'output.d.ts');
    const outSourceMapPath = path.join(tmpDir, 'output.wasm.map');

    let wasmBytes: Uint8Array | null = null;
    let dtsContent: string | null = null;
    let bindingsJs: string | null = null;
    let sourceMapContent: string | null = null;

    if (fs.existsSync(outWasmPath)) {
      wasmBytes = new Uint8Array(fs.readFileSync(outWasmPath));
    }
    if (fs.existsSync(outDtsPath)) {
      dtsContent = fs.readFileSync(outDtsPath, 'utf-8');
    }
    if (fs.existsSync(outJsPath)) {
      bindingsJs = fs.readFileSync(outJsPath, 'utf-8');
    }
    if (fs.existsSync(outSourceMapPath)) {
      sourceMapContent = fs.readFileSync(outSourceMapPath, 'utf-8');
    }

    if (!wasmBytes || dtsContent === null || bindingsJs === null) {
      throw new CompilerError('No se generaron todos los archivos necesarios', {
        fileName,
        hasWasm: !!wasmBytes,
        hasDts: dtsContent !== null,
        hasBindings: bindingsJs !== null,
      });
    }

    return {
      wasmBytes,
      dtsContent,
      bindingsJs,
      sourceMap: sourceMapContent,
      hash,
    };
  } catch (err: any) {
    if (err instanceof CompilerError) throw err;
    throw new CompilerError(`Error compilando AssemblyScript:\n${err.stderr || err.message || err}`, {
      fileName,
      stderr: err.stderr || err.message,
    });
  } finally {
    if (cleanupTmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

/**
 * Compila un archivo AssemblyScript a WASM.
 *
 * @deprecated Since multi-toolchain refactor. Usar `ToolchainRouter` con
 * `AssemblyScriptToolchainStrategy` en lugar de llamar esta función directamente.
 * Se mantiene para compatibilidad con el CLI legacy (packages/compiler/src/cli.ts).
 * La implementación real está en `compileAssemblyScriptCore()`.
 */
export async function compileWasm(
  options: CompileOptions = {
    fileName: '',
    sourceCode: '',
    maxMemoryCacheSize: MAX_MEMORY_CACHE_SIZE,
    ext: '.wasm.ts',
    isDev: true,
    runtime: 'incremental',
    sourceMap: true,
    optimizeLevel: 3,
  },
): Promise<CompileResult> {
  const opts = { ...options };
  const hash = hashString(opts.sourceCode);

  // Memory cache
  if (MEMORY_CACHE.has(hash)) {
    const cached = MEMORY_CACHE.get(hash)!;
    if (compareHash(cached.hash, hash)) return cached;
    MEMORY_CACHE.delete(hash);
  }

  // Disk cache
  const cacheKey = computeKey(opts.sourceCode, opts);
  const diskCached = getCached(cacheKey);
  if (diskCached && compareHash(diskCached.hash, hash)) {
    MEMORY_CACHE.set(hash, diskCached);
    return diskCached;
  }

  // Compile via core (sin caché)
  const core = await compileAssemblyScriptCore(
    opts.sourceCode,
    opts.fileName || '',
    opts.isDev ?? true,
    opts.runtime || 'incremental',
    opts.sourceMap !== false,
    opts.optimizeLevel ?? 3,
    opts.shrinkLevel,
  );

  const result: CompileResult = {
    wasmBytes: core.wasmBytes,
    dtsContent: core.dtsContent,
    bindingsJs: core.bindingsJs,
    sourceMap: core.sourceMap || undefined,
    dependencies: [],
    hash: core.hash,
  };

  MEMORY_CACHE.set(hash, result);
  saveToCache(cacheKey, result);
  return result;
}
