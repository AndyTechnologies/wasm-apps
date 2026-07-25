import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runExecFile } from './strategies/_utils.js';
import { LRUCache, MAX_MEMORY_CACHE_SIZE } from './cache.js';
import { compareHash, hashString, mergeAsConfig, resolveImportPath } from './utils.js';
import { getCached, saveToCache, computeKey } from './disk-cache.js';
import type { CompileOptions, CompileResult } from '@wasm-apps/types';
import { CompilerError } from '@wasm-apps/types';

export { getCompileCacheInfo, clearCompileCache, deleteCacheEntry, computeToolchainKey } from './disk-cache.js';
export { AssemblyScriptCompilerStrategy } from './assemblyscript-compiler-strategy.js';
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

function isPathInsideProject(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const boundary = PROJECT_ROOT + path.sep;
  return resolved === PROJECT_ROOT || resolved.startsWith(boundary);
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

/**
 * Compila un archivo AssemblyScript a WASM usando la API original.
 *
 * @deprecated Since multi-toolchain refactor. Use `ToolchainRouter` with
 * `AssemblyScriptToolchainStrategy` instead. This function remains available
 * for backward compatibility but delegates through the ToolchainRouter internally.
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
  const fileCache = new LRUCache<string, string>(opts.maxMemoryCacheSize ?? MAX_MEMORY_CACHE_SIZE);

  const checkCache = (cached: CompileResult): boolean => compareHash(cached.hash, hash);
  const memoryKey = hash;

  if (MEMORY_CACHE.has(memoryKey)) {
    const cached = MEMORY_CACHE.get(memoryKey)!;
    if (checkCache(cached)) return cached;
    MEMORY_CACHE.delete(memoryKey);
  }

  const cacheKey = computeKey(opts.sourceCode, opts);
  const diskCached = getCached(cacheKey);
  if (diskCached && compareHash(diskCached.hash, hash)) {
    MEMORY_CACHE.set(memoryKey, diskCached);
    return diskCached;
  }

  const target = opts.isDev ? 'debug' : 'release';
  const configOptions = mergeAsConfig({}, target);

  // Build asc args
  const baseArgs: string[] = [];

  if (opts.isDev) {
    baseArgs.push('--debug');
    if (opts.sourceMap !== false) {
      baseArgs.push('--sourceMap');
    }
  } else {
    baseArgs.push('--optimize');
    if (opts.optimizeLevel !== undefined) {
      baseArgs.push('--optimizeLevel', opts.optimizeLevel.toString());
    }
    if (opts.shrinkLevel !== undefined) {
      baseArgs.push('--shrinkLevel', opts.shrinkLevel.toString());
    }
    baseArgs.push('--noAssert');
  }

  baseArgs.push('--runtime', opts.runtime || 'incremental', '--exportRuntime', '--bindings', 'raw');

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
    const resolvedFileName = opts.fileName ? path.resolve(opts.fileName) : '';
    if (resolvedFileName && fs.existsSync(resolvedFileName) && fs.statSync(resolvedFileName).isFile()) {
      // File exists on disk — compile from there for correct import resolution
      srcFile = resolvedFileName;
      // Verify sourceCode matches disk content (should always be true in production flow)
      const diskContent = fs.readFileSync(srcFile, 'utf-8');
      if (diskContent !== opts.sourceCode) {
        // Source was transformed — write alongside project structure in temp dir
        const relativePath = path.relative(PROJECT_ROOT, resolvedFileName);
        srcFile = path.join(tmpDir, relativePath);
        fs.mkdirSync(path.dirname(srcFile), { recursive: true });
        fs.writeFileSync(srcFile, opts.sourceCode, 'utf-8');
        cleanupTmpDir = true;
      } else {
        // Source matches disk — don't clean up the temp dir since we're not using it for src
        cleanupTmpDir = false;
        // But we still need the outFile to go to tmpDir
      }
    } else {
      // Virtual file (unit tests, or non-existent path) — write to temp dir
      srcFile = path.join(tmpDir, 'source.ts');
      fs.writeFileSync(srcFile, opts.sourceCode, 'utf-8');
    }

    baseArgs.unshift('--outFile', outFile);
    baseArgs.unshift(srcFile);

    const ascCmd = resolveAsc();
    const { stderr } = await runExecFile(ascCmd, baseArgs);

    const stderrStr = stderr?.toString() || '';

    if (stderrStr.includes('ERROR') || stderrStr.includes('FAIL')) {
      throw new CompilerError(`Error en compilacion AssemblyScript:\n${stderrStr}`, {
        fileName: opts.fileName,
        stderr: stderrStr,
      });
    }

    const outWasmPath = path.join(tmpDir, 'output.wasm');
    const outJsPath = path.join(tmpDir, 'output.js');
    const outDtsPath = path.join(tmpDir, 'output.d.ts');
    const outSourceMapPath = path.join(tmpDir, 'output.wasm.map');

    let wasmBytes: Uint8Array | null = null;
    let dtsContent: string | null = null;
    let bindingsJs: string | null = null;
    let sourceMap: string | null = null;

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
      sourceMap = fs.readFileSync(outSourceMapPath, 'utf-8');
    }

    if (!wasmBytes || dtsContent === null || bindingsJs === null) {
      throw new CompilerError('No se generaron todos los archivos necesarios', {
        fileName: opts.fileName,
        hasWasm: !!wasmBytes,
        hasDts: dtsContent !== null,
        hasBindings: bindingsJs !== null,
      });
    }

    const result: CompileResult = {
      wasmBytes,
      dtsContent,
      bindingsJs,
      sourceMap: sourceMap || undefined,
      dependencies: [],
      hash,
    };

    MEMORY_CACHE.set(memoryKey, result);
    saveToCache(cacheKey, result);
    return result;
  } catch (err: any) {
    if (err instanceof CompilerError) throw err;
    throw new CompilerError(`Error compilando AssemblyScript:\n${err.stderr || err.message || err}`, {
      fileName: opts.fileName,
      stderr: err.stderr || err.message,
    });
  } finally {
    if (cleanupTmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}
