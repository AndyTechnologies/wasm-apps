import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { isBuildUpToDate, saveBuildManifest, getBuildCacheInfo, clearBuildCache } from './build-cache.js';

describe('build-cache', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-cache-test-'));
  const wasmFile = path.join(tmpDir, 'test.wasm');
  const outputFile = path.join(tmpDir, 'test-output-app');

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(wasmFile, Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
    fs.writeFileSync(outputFile, 'binary-content');
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('saveBuildManifest', () => {
    it('saves manifest to .wapp_build directory', () => {
      saveBuildManifest([wasmFile], outputFile, {
        entry: '_start',
        target: 'native',
        wasi: false,
        moduleMatching: 'file-name',
        wasmtimePath: '',
        wasmtimeVersion: '27.0.0',
      }, tmpDir);

      const manifestPath = path.join(tmpDir, '.wapp_build', 'build-manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(manifest.version).toBe(1);
      expect(manifest.options.entry).toBe('_start');
      expect(manifest.wasmFiles).toHaveLength(1);
      expect(manifest.wasmFiles[0].contentHash).toBeTruthy();
    });
  });

  describe('isBuildUpToDate', () => {
    it('returns false when output does not exist', async () => {
      const result = await isBuildUpToDate([wasmFile], '/nonexistent/output', {
        entry: '_start',
        wasi: false,
        moduleMatching: 'file-name',
        wasmtimeVersion: '27.0.0',
      }, tmpDir);
      expect(result).toBe(false);
    });

    it('returns false when no manifest exists', async () => {
      const result = await isBuildUpToDate([wasmFile], outputFile, {
        entry: '_start',
        wasi: false,
        moduleMatching: 'file-name',
        wasmtimeVersion: '27.0.0',
      }, tmpDir);
      expect(result).toBe(false);
    });

    it('returns true when cache is valid', async () => {
      saveBuildManifest([wasmFile], outputFile, {
        entry: '_start',
        target: 'native',
        wasi: false,
        moduleMatching: 'file-name',
        wasmtimePath: '',
        wasmtimeVersion: '27.0.0',
      }, tmpDir);

      const result = await isBuildUpToDate([wasmFile], outputFile, {
        entry: '_start',
        target: 'native',
        wasi: false,
        moduleMatching: 'file-name',
        wasmtimePath: '',
        wasmtimeVersion: '27.0.0',
      }, tmpDir);
      expect(result).toBe(true);
    });

    it('returns false when options differ', async () => {
      saveBuildManifest([wasmFile], outputFile, {
        entry: '_start',
        target: 'native',
        wasi: false,
        moduleMatching: 'file-name',
        wasmtimePath: '',
        wasmtimeVersion: '27.0.0',
      }, tmpDir);

      const result = await isBuildUpToDate([wasmFile], outputFile, {
        entry: 'main',
        wasi: false,
        moduleMatching: 'file-name',
        wasmtimeVersion: '27.0.0',
      }, tmpDir);
      expect(result).toBe(false);
    });

    it('returns false when wasm file changes', async () => {
      saveBuildManifest([wasmFile], outputFile, {
        entry: '_start',
        target: 'native',
        wasi: false,
        moduleMatching: 'file-name',
        wasmtimePath: '',
        wasmtimeVersion: '27.0.0',
      }, tmpDir);

      fs.writeFileSync(wasmFile, Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x01]));

      const result = await isBuildUpToDate([wasmFile], outputFile, {
        entry: '_start',
        target: 'native',
        wasi: false,
        moduleMatching: 'file-name',
        wasmtimePath: '',
        wasmtimeVersion: '27.0.0',
      }, tmpDir);
      expect(result).toBe(false);
    });
  });

  describe('getBuildCacheInfo', () => {
    it('returns exists=false when no build dir', () => {
      const info = getBuildCacheInfo(tmpDir);
      expect(info.exists).toBe(false);
    });

    it('returns exists=true after saving manifest', () => {
      saveBuildManifest([wasmFile], outputFile, {
        entry: '_start',
        target: 'native',
        wasi: false,
        moduleMatching: 'file-name',
        wasmtimePath: '',
        wasmtimeVersion: '27.0.0',
      }, tmpDir);

      const info = getBuildCacheInfo(tmpDir);
      expect(info.exists).toBe(true);
      expect(info.entries).toBeGreaterThan(0);
    });
  });

  describe('clearBuildCache', () => {
    it('removes build directory', () => {
      saveBuildManifest([wasmFile], outputFile, {
        entry: '_start',
        target: 'native',
        wasi: false,
        moduleMatching: 'file-name',
        wasmtimePath: '',
        wasmtimeVersion: '27.0.0',
      }, tmpDir);

      clearBuildCache(tmpDir);
      expect(fs.existsSync(path.join(tmpDir, '.wapp_build'))).toBe(false);
    });
  });
});
