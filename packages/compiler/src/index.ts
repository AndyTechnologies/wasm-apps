import asc from 'assemblyscript/asc';
import fs from 'node:fs';
import { LRUCache, MAX_MEMORY_CACHE_SIZE } from './cache.js';
import { compareHash, hashString, mergeAsConfig, resolveImportPath } from './utils.js';
import type { CompileOptions, CompileResult } from '@wasm-apps/types';
import { CompilerError } from '@wasm-apps/types';

const MEMORY_CACHE = new LRUCache<string, CompileResult>();

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

  if (MEMORY_CACHE.has(opts.fileName)) {
    const cached = MEMORY_CACHE.get(opts.fileName)!;
    if (checkCache(cached)) return cached;
    MEMORY_CACHE.delete(opts.fileName);
  }

  const readFileFromDisk = (filePath: string): string | null => {
    if (filePath === opts.fileName) return opts.sourceCode;
    if (fileCache.has(filePath)) return fileCache.get(filePath)!;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      fileCache.set(filePath, content);
      return content;
    } catch {
      return null;
    }
  };

  let wasmBytes: Uint8Array | null = null;
  let dtsContent: string | null = null;
  let bindingsJs: string | null = null;
  let sourceMap: string | null = null;

  const target = opts.isDev ? 'debug' : 'release';
  const configOptions = mergeAsConfig({}, target);

  const baseArgs = [
    opts.fileName,
    '--runtime', opts.runtime || 'incremental',
    '--exportRuntime',
    '--bindings', 'raw',
    '--outFile', 'out.wasm',
  ];

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

  for (const [key, value] of Object.entries({ ...configOptions })) {
    if (typeof value === 'boolean') {
      if (value) baseArgs.push(`--${key}`);
    } else {
      baseArgs.push(`--${key}`, value.toString());
    }
  }

  const { error, stderr, stdout } = await asc.main(
    baseArgs,
    {
      readFile: (name: string) => {
        if (name === opts.fileName) return opts.sourceCode;
        if (name === 'asconfig.json') return null;
        const resolved = resolveImportPath(name, opts.fileName, opts.aliases || []);
        return readFileFromDisk(resolved);
      },
      writeFile: (name: string, contents: string | Uint8Array) => {
        if (name === 'out.wasm') {
          wasmBytes = contents as Uint8Array;
        } else if (name === 'out.js') {
          bindingsJs = contents as string;
        } else if (name === 'out.d.ts') {
          dtsContent = contents as string;
        } else if (name === 'out.wasm.map') {
          sourceMap = contents as string;
        }
      },
      listFiles: () => [],
    },
  );

  const stderrStr = stderr?.toString() || '';
  const stdoutStr = stdout?.toString() || '';

  if (error) {
    throw new CompilerError(`Error compilando AssemblyScript:\n${stderrStr}\n${stdoutStr}`, {
      fileName: opts.fileName,
      stderr: stderrStr,
      stdout: stdoutStr,
    });
  }

  if (stderrStr.includes('ERROR') || stderrStr.includes('FAIL')) {
    throw new CompilerError(`Error en compilacion AssemblyScript:\n${stderrStr}`, {
      fileName: opts.fileName,
      stderr: stderrStr,
    });
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

  MEMORY_CACHE.set(opts.fileName, result);
  return result;
}
