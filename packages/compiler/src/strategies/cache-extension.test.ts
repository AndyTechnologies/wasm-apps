import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeToolchainKey, computeKey, setCacheDir } from '../disk-cache.js';
import { CompilerCacheRepository } from '../compiler-cache-repository.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('computeToolchainKey', () => {
  const sourceCode = 'export function add(a: i32, b: i32): i32 { return a + b; }';
  const defaultOpts = { release: true, optimizeLevel: 3 };

  it('produces different keys for different toolchainIds with same source', () => {
    const asKey = computeToolchainKey(sourceCode, 'assemblyscript', defaultOpts);
    const cppKey = computeToolchainKey(sourceCode, 'cpp', defaultOpts);
    const rustKey = computeToolchainKey(sourceCode, 'rust', defaultOpts);

    expect(asKey).toBeTruthy();
    expect(cppKey).toBeTruthy();
    expect(rustKey).toBeTruthy();

    // All three must be different from each other
    expect(asKey).not.toBe(cppKey);
    expect(asKey).not.toBe(rustKey);
    expect(cppKey).not.toBe(rustKey);
  });

  it('produces the same key for identical inputs', () => {
    const key1 = computeToolchainKey(sourceCode, 'assemblyscript', defaultOpts);
    const key2 = computeToolchainKey(sourceCode, 'assemblyscript', defaultOpts);

    expect(key1).toBe(key2);
  });

  it('produces different keys when source changes', () => {
    const key1 = computeToolchainKey(sourceCode, 'cpp', defaultOpts);
    const key2 = computeToolchainKey('// different source', 'cpp', defaultOpts);

    expect(key1).not.toBe(key2);
  });

  it('produces different keys when compiler options change', () => {
    const key1 = computeToolchainKey(sourceCode, 'rust', { isDev: true });
    const key2 = computeToolchainKey(sourceCode, 'rust', { isDev: false });

    expect(key1).not.toBe(key2);
  });

  it('returns a valid SHA-256 hex string (64 chars)', () => {
    const key = computeToolchainKey('test', 'assemblyscript', {});
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  it('works with minimal options (empty object)', () => {
    const key = computeToolchainKey('test', 'cpp', {});
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  it('works with undefined opts', () => {
    const key = computeToolchainKey('test', 'rust', undefined as any);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('computeKey (original) unchanged', () => {
  it('still works as before (no toolchainId in key)', () => {
    const source = 'export function test(): void {}';
    const key1 = computeKey(source, { isDev: true });
    const key2 = computeKey(source, { isDev: true });

    expect(key1).toBe(key2);
    expect(key1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different keys than computeToolchainKey for same source', () => {
    const source = 'export function test(): void {}';
    const opts = { isDev: true };

    const originalKey = computeKey(source, opts);
    const toolchainKey = computeToolchainKey(source, 'assemblyscript', opts);

    // The original key does NOT include toolchainId, so it should differ
    // from the toolchain key even for assemblyscript
    expect(originalKey).not.toBe(toolchainKey);
  });
});

describe('CompilerCacheRepository toolchain extension', () => {
  let repository: CompilerCacheRepository;
  let tmpCacheDir: string;

  beforeEach(() => {
    tmpCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'));
    setCacheDir(tmpCacheDir);
    repository = new CompilerCacheRepository();
  });

  afterEach(() => {
    if (fs.existsSync(tmpCacheDir)) {
      fs.rmSync(tmpCacheDir, { recursive: true, force: true });
    }
  });

  it('setToolchainId stores the toolchain id', () => {
    expect(() => repository.setToolchainId('cpp')).not.toThrow();
  });

  it('getFromSourceWithToolchain returns null for non-cached source', () => {
    repository.setToolchainId('cpp');
    const result = repository.getFromSourceWithToolchain('some source', 'cpp');
    expect(result).toBeNull();
  });

  it('saveFromSourceWithToolchain and getFromSourceWithToolchain round-trip', () => {
    const source = 'export function test(): void {}';
    const toolchainId = 'assemblyscript';
    const result = {
      wasmBytes: new Uint8Array([0x00, 0x61, 0x73, 0x6d]),
      dtsContent: 'export function test(): void;\n',
      bindingsJs: 'module.exports = {};\n',
      dependencies: ['test.wasm.ts'],
      hash: 'abc123',
    };

    repository.saveFromSourceWithToolchain(source, toolchainId, result);

    const cached = repository.getFromSourceWithToolchain(source, toolchainId);
    expect(cached).not.toBeNull();
    expect(cached!.hash).toBe('abc123');
    expect(cached!.dependencies).toEqual(['test.wasm.ts']);
    expect(cached!.dtsContent).toBe('export function test(): void;\n');
    expect(cached!.bindingsJs).toBe('module.exports = {};\n');
    expect(new Uint8Array(cached!.wasmBytes)).toEqual(new Uint8Array([0x00, 0x61, 0x73, 0x6d]));
  });

  it('different toolchainIds produce different cache keys', () => {
    const source = 'same source';
    const opts = { release: true };

    const key1 = computeToolchainKey(source, 'assemblyscript', opts);
    const key2 = computeToolchainKey(source, 'cpp', opts);

    expect(key1).not.toBe(key2);
  });
});
