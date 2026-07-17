import { describe, it, expect } from 'vitest';
import { CacheManager } from './cache.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('CacheManager', () => {
  const testDir = path.join(os.tmpdir(), 'wasm-cache-test-' + Date.now());
  const manager = new CacheManager(testDir);

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('reporta que no existe inicialmente', () => {
    expect(manager.exists()).toBe(false);
  });

  it('resumeary reporta 0 cuando no existe', () => {
    const summary = manager.summarize();
    expect(summary.sizeBytes).toBe(0);
    expect(summary.fileCount).toBe(0);
  });

  it('reporta existencia después de crear directorio', () => {
    fs.mkdirSync(testDir, { recursive: true });
    expect(manager.exists()).toBe(true);
  });

  it('resumeary calcula tamaño correctamente', () => {
    const subDir = path.join(testDir, 'sub');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'test.txt'), 'hello');
    const summary = manager.summarize();
    expect(summary.fileCount).toBe(1);
    expect(summary.sizeBytes).toBe(5);
  });

  it('limpia el directorio', () => {
    manager.clear();
    expect(fs.existsSync(testDir)).toBe(false);
  });
});
