import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import type { CompileResult } from '@wasm-apps/types';
import { computeKey, getCached, saveToCache, getCompileCacheInfo, clearCompileCache } from './disk-cache.js';

describe('disk-cache', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'disk-cache-test-'));
  const opts = {
    fileName: 'test.wasm.ts',
    sourceCode: 'export function test(): void {}',
    runtime: 'incremental' as const,
    isDev: true,
    sourceMap: true,
    optimizeLevel: 3,
  };

  const mockResult: CompileResult = {
    wasmBytes: new Uint8Array([0x00, 0x61, 0x73, 0x6d]),
    dtsContent: 'export function test(): void;',
    bindingsJs: 'module.exports = {}',
    sourceMap: '{"version":3}',
    dependencies: [],
    hash: 'abc123',
  };

  beforeEach(() => {
    clearCompileCache(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('computeKey', () => {
    it('returns consistent key for same input', () => {
      const a = computeKey('hello', opts as any);
      const b = computeKey('hello', opts as any);
      expect(a).toBe(b);
    });

    it('returns different key for different source', () => {
      const a = computeKey('hello', opts as any);
      const b = computeKey('world', opts as any);
      expect(a).not.toBe(b);
    });

    it('returns different key for different options', () => {
      const a = computeKey('test', opts as any);
      const b = computeKey('test', { ...opts, runtime: 'minimal' } as any);
      expect(a).not.toBe(b);
    });
  });

  describe('getCached / saveToCache', () => {
    it('returns null when no cache exists', () => {
      const result = getCached('nonexistent', tmpDir);
      expect(result).toBeNull();
    });

    it('saves and retrieves cache entry', () => {
      const key = computeKey(opts.sourceCode, opts as any);
      saveToCache(key, mockResult, tmpDir);

      const cached = getCached(key, tmpDir);
      expect(cached).not.toBeNull();
      expect(cached!.hash).toBe('abc123');
      expect([...cached!.wasmBytes]).toEqual([0x00, 0x61, 0x73, 0x6d]);
      expect(cached!.dtsContent).toBe('export function test(): void;');
      expect(cached!.bindingsJs).toBe('module.exports = {}');
    });

    it('retrieves sourceMap when present', () => {
      const key = computeKey(opts.sourceCode, opts as any);
      saveToCache(key, mockResult, tmpDir);

      const cached = getCached(key, tmpDir);
      expect(cached!.sourceMap).toBe('{"version":3}');
    });

    it('handles cache without sourceMap', () => {
      const noMap = { ...mockResult, sourceMap: undefined };
      const key = computeKey(opts.sourceCode, opts as any);
      saveToCache(key, noMap, tmpDir);

      const cached = getCached(key, tmpDir);
      expect(cached!.sourceMap).toBeUndefined();
    });
  });

  describe('getCompileCacheInfo', () => {
    it('returns exists=false when no cache dir', () => {
      const info = getCompileCacheInfo(tmpDir);
      expect(info.exists).toBe(false);
    });

    it('returns info after saving cache', () => {
      const key = computeKey(opts.sourceCode, opts as any);
      saveToCache(key, mockResult, tmpDir);

      const info = getCompileCacheInfo(tmpDir);
      expect(info.exists).toBe(true);
      expect(info.entries).toBe(1);
      expect(info.size).toBeGreaterThan(0);
    });
  });

  describe('clearCompileCache', () => {
    it('removes cache directory', () => {
      const key = computeKey(opts.sourceCode, opts as any);
      saveToCache(key, mockResult, tmpDir);
      clearCompileCache(tmpDir);

      const info = getCompileCacheInfo(tmpDir);
      expect(info.exists).toBe(false);
    });
  });
});
