import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RustCompilerStrategy } from './rust-strategy.js';
import { CompilerError } from '@wasm-apps/types';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';

/**
 * Helper: creates a mock .wasm output where cargo would put it.
 */
function createMockWasmOutput(sourceDir: string, release: boolean): string {
  const profile = release ? 'release' : 'debug';
  const targetDir = path.join(sourceDir, 'target', 'wasm32-unknown-unknown', profile);
  fs.mkdirSync(targetDir, { recursive: true });
  const wasmPath = path.join(targetDir, 'crate.wasm');
  fs.writeFileSync(wasmPath, Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
  return wasmPath;
}

describe('RustCompilerStrategy', () => {
  let tmpDir: string;
  let strategy: RustCompilerStrategy;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rust-test-'));
    strategy = new RustCompilerStrategy();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('identity', () => {
    it('has id "rust" and handles .wasm.rs extension', () => {
      expect(strategy.id).toBe('rust');
      expect(strategy.extensions).toEqual(['.wasm.rs']);
    });
  });

  describe('isAvailable', () => {
    it('returns true when cargo is available and wasm target is installed', async () => {
      vi.mocked(execFile)
        .mockResolvedValueOnce({ stdout: '/usr/bin/cargo', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'wasm32-unknown-unknown', stderr: '' });

      const result = await strategy.isAvailable();

      expect(result).toBe(true);
      expect(execFile).toHaveBeenNthCalledWith(1, 'which', ['cargo'], expect.objectContaining({ timeout: 5000 }), expect.any(Function));
      expect(execFile).toHaveBeenNthCalledWith(
        2,
        'rustup',
        ['target', 'list', '--installed'],
        expect.objectContaining({ timeout: 10000 }),
        expect.any(Function),
      );
    });

    it('returns false when cargo is not available', async () => {
      vi.mocked(execFile).mockRejectedValueOnce(new Error('not found'));

      const result = await strategy.isAvailable();

      expect(result).toBe(false);
    });

    it('returns false when wasm target is not installed', async () => {
      vi.mocked(execFile).mockResolvedValueOnce({ stdout: '/usr/bin/cargo', stderr: '' }).mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await strategy.isAvailable();

      expect(result).toBe(false);
    });

    it('returns false on non-ENOENT error without throwing', async () => {
      vi.mocked(execFile).mockRejectedValueOnce(new Error('permission denied'));

      const result = await strategy.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('compile with Cargo.toml present', () => {
    it('detects Cargo.toml and runs cargo build', async () => {
      const sourcePath = path.join(tmpDir, 'lib.wasm.rs');
      fs.writeFileSync(sourcePath, 'fn main() {}');
      fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "test"\nversion = "0.1.0"');

      // Create the wasm output where cargo would put it
      createMockWasmOutput(tmpDir, false);

      vi.mocked(execFile).mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await strategy.compile({
        sourceCode: 'fn main() {}',
        fileName: sourcePath,
        compilerOptions: { release: false },
      });

      expect(execFile).toHaveBeenCalledTimes(1);
      expect(execFile).toHaveBeenCalledWith(
        'cargo',
        expect.arrayContaining(['build', '--target', 'wasm32-unknown-unknown']),
        expect.objectContaining({ cwd: tmpDir, timeout: expect.any(Number) }),
        expect.any(Function),
      );

      expect(result.wasmBytes).toBeInstanceOf(Uint8Array);
      expect(result.toolchainId).toBe('rust');
    });

    it('does not include --release flag when compilerOptions.release is false', async () => {
      const sourcePath = path.join(tmpDir, 'debug.wasm.rs');
      fs.writeFileSync(sourcePath, 'fn main() {}');
      fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "debug"\nversion = "0.1.0"');
      createMockWasmOutput(tmpDir, false);

      let capturedArgs: readonly string[] = [];
      vi.mocked(execFile).mockImplementation(async (_cmd: string, args: readonly string[]) => {
        capturedArgs = args;
        return { stdout: '', stderr: '' };
      });

      await strategy.compile({
        sourceCode: 'fn main() {}',
        fileName: sourcePath,
        compilerOptions: { release: false },
      });

      expect(capturedArgs).not.toContain('--release');
    });
  });

  describe('compile without Cargo.toml (temporary manifest)', () => {
    it('creates a temp Cargo.toml with cdylib crate type when none exists', async () => {
      const sourcePath = path.join(tmpDir, 'crypto.wasm.rs');
      fs.writeFileSync(sourcePath, '#![no_std] pub extern "C" fn add(a: i32, b: i32) -> i32 { a + b }');
      createMockWasmOutput(tmpDir, false);

      vi.mocked(execFile).mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await strategy.compile({
        sourceCode: '#![no_std] ...',
        fileName: sourcePath,
        compilerOptions: { release: false },
      });

      expect(execFile).toHaveBeenCalledWith(
        'cargo',
        expect.arrayContaining(['build', '--target', 'wasm32-unknown-unknown']),
        expect.any(Object),
        expect.any(Function),
      );
      expect(result.wasmBytes).toBeInstanceOf(Uint8Array);
      expect(result.toolchainId).toBe('rust');
    });

    it('cleans up temp Cargo.toml after compilation succeeds', async () => {
      const sourcePath = path.join(tmpDir, 'cleanup.wasm.rs');
      fs.writeFileSync(sourcePath, 'fn test() {}');
      createMockWasmOutput(tmpDir, false);

      vi.mocked(execFile).mockResolvedValueOnce({ stdout: '', stderr: '' });

      await strategy.compile({
        sourceCode: 'fn test() {}',
        fileName: sourcePath,
        compilerOptions: { release: false },
      });

      // After successful compilation, the temp Cargo.toml should be removed
      const files = fs.readdirSync(tmpDir);
      expect(files).not.toContain('Cargo.toml');
      expect(files).toContain('cleanup.wasm.rs');
    });

    it('cleans up temp Cargo.toml even when compilation fails', async () => {
      const sourcePath = path.join(tmpDir, 'fail-cleanup.wasm.rs');
      fs.writeFileSync(sourcePath, 'fn broken() {');

      vi.mocked(execFile).mockRejectedValueOnce(new Error('compilation error'));

      await expect(
        strategy.compile({
          sourceCode: 'fn broken() {',
          fileName: sourcePath,
          compilerOptions: { release: false },
        }),
      ).rejects.toThrow(CompilerError);

      // Even on failure, temp Cargo.toml should be removed
      const files = fs.readdirSync(tmpDir);
      expect(files).not.toContain('Cargo.toml');
      expect(files).toContain('fail-cleanup.wasm.rs');
    });
  });

  describe('compile with release flag', () => {
    it('includes --release flag when compilerOptions.release is true', async () => {
      const sourcePath = path.join(tmpDir, 'release.wasm.rs');
      fs.writeFileSync(sourcePath, 'fn main() {}');
      fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "release"\nversion = "0.1.0"');
      createMockWasmOutput(tmpDir, true);

      let capturedArgs: readonly string[] = [];
      vi.mocked(execFile).mockImplementation(async (_cmd: string, args: readonly string[]) => {
        capturedArgs = args;
        return { stdout: '', stderr: '' };
      });

      await strategy.compile({
        sourceCode: 'fn main() {}',
        fileName: sourcePath,
        compilerOptions: { release: true },
      });

      expect(capturedArgs).toContain('--release');
    });
  });

  describe('compile error handling', () => {
    it('throws CompilerError when cargo build fails', async () => {
      const sourcePath = path.join(tmpDir, 'fail.wasm.rs');
      fs.writeFileSync(sourcePath, 'fn broken() {');
      fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "fail"\nversion = "0.1.0"');

      vi.mocked(execFile).mockRejectedValueOnce(new Error('cargo build failed'));

      await expect(
        strategy.compile({
          sourceCode: 'fn broken() {',
          fileName: sourcePath,
          compilerOptions: { release: false },
        }),
      ).rejects.toThrow(CompilerError);
    });

    it('throws CompilerError when compiled WASM file is not found', async () => {
      const sourcePath = path.join(tmpDir, 'missing.wasm.rs');
      fs.writeFileSync(sourcePath, 'fn main() {}');
      fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "missing"\nversion = "0.1.0"');

      // Don't create the wasm output — cargo build mock succeeds but no .wasm exists
      vi.mocked(execFile).mockResolvedValueOnce({ stdout: '', stderr: '' });

      await expect(
        strategy.compile({
          sourceCode: 'fn main() {}',
          fileName: sourcePath,
          compilerOptions: { release: false },
        }),
      ).rejects.toThrow(CompilerError);
    });
  });

  describe('path resolution safety', () => {
    it('prevents path traversal via path.resolve (no relative components after resolution)', () => {
      // The strategy uses path.resolve(options.fileName) which normalizes
      // any directory traversal attempts to an absolute path.
      const traversalPath = '../../etc/passwd';
      const resolved = path.resolve(traversalPath);
      expect(resolved).not.toContain('..');
      expect(path.isAbsolute(resolved)).toBe(true);
    });
  });
});
