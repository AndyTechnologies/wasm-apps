/**
 * Integration tests for filesystem access (mounts).
 *
 * These tests verify the full pipeline: wapp.json with mounts → code generation → cache.
 * They do NOT execute the binary (requires Wasmtime runtime).
 */
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { ResolvedLink, WasmModuleInfo } from '@wasm-apps/types';
import { registerBuiltinHostFunctions } from './builtin-host-functions.js';
import { hostFunctionRegistry } from './host-function-registry.js';
import { generateCCode } from './codegen.js';
import { saveBuildManifest, isBuildUpToDate } from './build-cache.js';

function makeModule(name: string, exportsList: string[], importsList: Array<{ module: string; name: string }> = []): WasmModuleInfo {
  return {
    fileName: `/path/to/${name}.wasm`,
    buffer: Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
    exports: exportsList.map((e) => ({ name: e, kind: 'function' as const })),
    imports: importsList.map((i) => ({ module: i.module, name: i.name, kind: 'function' as const })),
  };
}

function makeResolved(modules: WasmModuleInfo[]): ResolvedLink {
  return {
    order: modules.map((mod, idx) => ({ module: mod, index: idx, instanceName: `instance${idx}` })),
    exportMap: new Map(),
  };
}

// Task 5.3: Integration — wapp.json with mounts → build → preopen lines generated
describe('filesystem-access integration [5.3]', () => {
  it('generates preopen_dir lines for each mount in wapp.json', () => {
    const mod = makeModule('test', ['_start'], [{ module: 'env', name: 'request-path' }]);
    const link = makeResolved([mod]);
    const mounts = [
      { host: '/absolute/path/to/data', guest: '/data' },
      { host: './relative/config', guest: '/etc/app' },
    ];

    const code = generateCCode(link, '_start', true, undefined, undefined, mounts);

    // Verify preopen_dir lines for both mounts
    expect(code).toContain('wasi_config.preopen_dir("/absolute/path/to/data", "/data");');
    expect(code).toContain('wasi_config.preopen_dir("./relative/config", "/etc/app");');
    // Verify fs-runtime.h is included
    expect(code).toContain('#include "fs-runtime.h"');
    // Verify allowed roots are populated
    expect(code).toContain('_fs_allowed_roots.push_back("/absolute/path/to/data");');
    expect(code).toContain('_fs_allowed_roots.push_back("./relative/config");');
  });
});

// Task 5.4: E2E — path traversal denied (codegen level)
describe('filesystem-access path traversal [5.4]', () => {
  beforeEach(() => {
    hostFunctionRegistry.clear();
    registerBuiltinHostFunctions(hostFunctionRegistry);
  });

  afterEach(() => {
    hostFunctionRegistry.clear();
  });

  it('generates request-path host function that uses FsRuntime::requestPath', () => {
    const mod = makeModule('test', ['_start'], [{ module: 'env', name: 'request-path' }]);
    const link = makeResolved([mod]);
    const mounts = [{ host: '/safe/path', guest: '/data' }];

    const code = generateCCode(link, '_start', true, [{ module: 'env', name: 'request-path', params: ['i32'], results: ['i32'] }], undefined, mounts);

    // The generated code should have the request-path function
    expect(code).toContain('FsRuntime::requestPath');
    expect(code).toContain('_fs_allowed_roots');
    expect(code).toContain('request-path');
  });
});

// Task 5.5: E2E — AllowForever (cache verification)
describe('filesystem-access AllowForever [5.5]', () => {
  it('persists mountsHash in build manifest for cache invalidation', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-access-test-'));
    try {
      const wasmFile = path.join(tmpDir, 'test.wasm');
      fs.writeFileSync(wasmFile, Buffer.from([0x00, 0x61, 0x73, 0x6d]));
      const outputFile = path.join(tmpDir, 'test-output' + (process.platform === 'win32' ? '.exe' : ''));
      fs.writeFileSync(outputFile, 'binary');

      const mountsHash = crypto.createHash('sha256').update('/data').update('\0').update('/mnt/data').update('\0').digest('hex');

      saveBuildManifest(
        [wasmFile],
        outputFile,
        {
          entry: '_start',
          target: 'native',
          wasi: true,
          moduleMatching: 'file-name',
          wasmtimePath: '',
          wasmtimeVersion: '46.0.1',
          mountsHash,
        },
        tmpDir,
      );

      // Verify manifest contains mountsHash
      const manifestPath = path.join(tmpDir, '.wapp_build', 'build-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(manifest.options.mountsHash).toBe(mountsHash);

      // Same mountsHash → cache hit
      const cacheHit = await isBuildUpToDate(
        [wasmFile],
        outputFile,
        {
          entry: '_start',
          target: 'native',
          wasi: true,
          moduleMatching: 'file-name',
          wasmtimeVersion: '46.0.1',
          mountsHash,
        },
        tmpDir,
      );
      expect(cacheHit).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// Task 5.6: E2E — mount change → cache miss
describe('filesystem-access cache invalidation [5.6]', () => {
  it('detects mount changes via mountsHash difference', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-access-cache-'));
    try {
      const wasmFile = path.join(tmpDir, 'test.wasm');
      fs.writeFileSync(wasmFile, Buffer.from([0x00, 0x61, 0x73, 0x6d]));
      const outputFile = path.join(tmpDir, 'test-output' + (process.platform === 'win32' ? '.exe' : ''));
      fs.writeFileSync(outputFile, 'binary');

      // Save with original mounts
      const originalHash = crypto.createHash('sha256').update('/original/data').update('\0').update('/data').update('\0').digest('hex');

      saveBuildManifest(
        [wasmFile],
        outputFile,
        {
          entry: '_start',
          target: 'native',
          wasi: true,
          moduleMatching: 'file-name',
          wasmtimePath: '',
          wasmtimeVersion: '46.0.1',
          mountsHash: originalHash,
        },
        tmpDir,
      );

      // Different mounts → cache miss
      const newHash = crypto.createHash('sha256').update('/new/data/path').update('\0').update('/data').update('\0').digest('hex');

      const cacheMiss = await isBuildUpToDate(
        [wasmFile],
        outputFile,
        {
          entry: '_start',
          target: 'native',
          wasi: true,
          moduleMatching: 'file-name',
          wasmtimeVersion: '46.0.1',
          mountsHash: newHash,
        },
        tmpDir,
      );
      expect(cacheMiss).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
