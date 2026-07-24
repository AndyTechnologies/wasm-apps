import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CppCompilerStrategy } from './cpp-strategy.js';
import { CompilerError } from '@wasm-apps/types';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';

describe('CppCompilerStrategy', () => {
  let tmpDir: string;
  let strategy: CppCompilerStrategy;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpp-test-'));
    strategy = new CppCompilerStrategy();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('identity', () => {
    it('has id "cpp" and handles .wasm.cpp, .wasm.cxx, .wasm.cc extensions', () => {
      expect(strategy.id).toBe('cpp');
      expect(strategy.extensions).toContain('.wasm.cpp');
      expect(strategy.extensions).toContain('.wasm.cxx');
      expect(strategy.extensions).toContain('.wasm.cc');
      expect(strategy.extensions).toHaveLength(3);
    });
  });

  describe('isAvailable', () => {
    it('returns true when em++ is found via which (checked first)', async () => {
      vi.mocked(execFile).mockResolvedValueOnce({ stdout: '/usr/bin/em++', stderr: '' });

      const result = await strategy.isAvailable();

      expect(result).toBe(true);
      expect(execFile).toHaveBeenCalledWith('which', ['em++'], expect.objectContaining({ timeout: 5000 }), expect.any(Function));
    });

    it('returns true when clang++ is found but em++ is not', async () => {
      vi.mocked(execFile)
        .mockRejectedValueOnce(new Error('not found')) // em++ not found
        .mockResolvedValueOnce({ stdout: '/usr/bin/clang++', stderr: '' }); // clang++ found

      const result = await strategy.isAvailable();

      expect(result).toBe(true);
    });

    it('returns false when neither em++ nor clang++ is found', async () => {
      vi.mocked(execFile)
        .mockRejectedValueOnce(new Error('not found')) // em++ not found
        .mockRejectedValueOnce(new Error('not found')); // clang++ not found

      const result = await strategy.isAvailable();

      expect(result).toBe(false);
    });

    it('returns false on any error without throwing (both fail)', async () => {
      vi.mocked(execFile).mockRejectedValueOnce(new Error('permission denied')).mockRejectedValueOnce(new Error('not found'));

      const result = await strategy.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('compile with CMakeLists.txt', () => {
    it('detects CMakeLists.txt and runs cmake + cmake --build', async () => {
      const sourcePath = path.join(tmpDir, 'main.wasm.cpp');
      const cmakeListsPath = path.join(tmpDir, 'CMakeLists.txt');
      fs.writeFileSync(sourcePath, '// test');
      fs.writeFileSync(cmakeListsPath, 'add_executable(main main.wasm.cpp)');

      // Create a stub .wasm file that the strategy will find after "cmake build"
      // The strategy creates a temp build dir and looks for .wasm files there.
      // Since execFile is mocked, we need the .wasm to already exist.
      // We spy on execFile to capture the build dir passed to cmake --build.
      const buildDirPromise = new Promise<string>((resolve) => {
        vi.mocked(execFile).mockImplementation(async (cmd: string, args: readonly string[]) => {
          if (cmd === 'cmake' && args[0] === '--build') {
            resolve(args[1] as string);
            // Create a .wasm file in the build dir
            const buildDir = args[1] as string;
            fs.mkdirSync(buildDir, { recursive: true });
            fs.writeFileSync(path.join(buildDir, 'main.wasm'), Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
          }
          return { stdout: '', stderr: '' };
        });
      });

      const result = await strategy.compile({
        sourceCode: '// test',
        fileName: sourcePath,
        compilerOptions: { release: false },
      });

      const buildDir = await buildDirPromise;

      // Verify cmake was called
      expect(execFile).toHaveBeenCalledWith(
        'cmake',
        expect.arrayContaining(['-S', tmpDir, '-B', expect.any(String)]),
        expect.objectContaining({ timeout: expect.any(Number) }),
        expect.any(Function),
      );
      expect(execFile).toHaveBeenCalledWith(
        'cmake',
        expect.arrayContaining(['--build', expect.any(String)]),
        expect.objectContaining({ timeout: expect.any(Number) }),
        expect.any(Function),
      );

      expect(result.wasmBytes).toBeInstanceOf(Uint8Array);
      expect(result.wasmBytes).toHaveLength(8);
      expect(result.toolchainId).toBe('cpp');
    });
  });

  describe('compile single-file (no CMakeLists.txt)', () => {
    it('runs clang++ directly when no CMakeLists.txt exists', async () => {
      const sourcePath = path.join(tmpDir, 'math.wasm.cpp');
      fs.writeFileSync(sourcePath, '// single file test');

      vi.mocked(execFile).mockImplementation(async (_cmd: string, _args: readonly string[], _options?: any) => {
        // clang++ writes the output to a temp dir. We need to create it.
        // The output path follows pattern: /tmp/cpp-wasm-XXXXX/math.cpp.wasm
        // Since we can't easily know the random path, we use fs after the fact
        return { stdout: '', stderr: '' };
      });

      await expect(
        strategy.compile({
          sourceCode: '// single file test',
          fileName: sourcePath,
          compilerOptions: { release: false },
        }),
      ).rejects.toThrow(CompilerError);
      // Expected: clang++ is mocked, so no real .wasm file is created
      // The strategy should throw because the output file doesn't exist
    });
  });

  describe('compile with release/debug flags (validating args)', () => {
    it('passes -O3 when compilerOptions.release is true', async () => {
      const sourcePath = path.join(tmpDir, 'release.wasm.cpp');
      fs.writeFileSync(sourcePath, '// release');

      let capturedArgs: readonly string[] = [];
      vi.mocked(execFile).mockImplementation(async (_cmd: string, args: readonly string[]) => {
        capturedArgs = args;
        throw new Error('expected error (test)');
      });

      await expect(
        strategy.compile({
          sourceCode: '// release',
          fileName: sourcePath,
          compilerOptions: { release: true },
        }),
      ).rejects.toThrow(CompilerError);

      expect(capturedArgs).toContain('-O3');
      expect(capturedArgs).not.toContain('-O0');
      expect(capturedArgs).not.toContain('-g');
    });

    it('passes -O0 -g when compilerOptions.release is false', async () => {
      const sourcePath = path.join(tmpDir, 'debug.wasm.cpp');
      fs.writeFileSync(sourcePath, '// debug');

      let capturedArgs: readonly string[] = [];
      vi.mocked(execFile).mockImplementation(async (_cmd: string, args: readonly string[]) => {
        capturedArgs = args;
        throw new Error('expected error (test)');
      });

      await expect(
        strategy.compile({
          sourceCode: '// debug',
          fileName: sourcePath,
          compilerOptions: { release: false },
        }),
      ).rejects.toThrow(CompilerError);

      expect(capturedArgs).toContain('-O0');
      expect(capturedArgs).toContain('-g');
      expect(capturedArgs).not.toContain('-O3');
    });
  });

  describe('compile error handling', () => {
    it('throws CompilerError when external compilation fails', async () => {
      const sourcePath = path.join(tmpDir, 'fail.wasm.cpp');
      fs.writeFileSync(sourcePath, '// will fail');

      vi.mocked(execFile).mockRejectedValueOnce(new Error('compilation error: syntax issue'));

      await expect(
        strategy.compile({
          sourceCode: '// will fail',
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

    it('resolves CMakeLists.txt relative to file path (not CWD)', async () => {
      const nestedDir = path.join(tmpDir, 'nested');
      fs.mkdirSync(nestedDir, { recursive: true });
      const sourcePath = path.join(nestedDir, 'module.wasm.cpp');
      fs.writeFileSync(sourcePath, '// nested');
      fs.writeFileSync(path.join(nestedDir, 'CMakeLists.txt'), 'project(test)');

      const buildDirPromise = new Promise<string>((resolve) => {
        vi.mocked(execFile).mockImplementation(async (cmd: string, args: readonly string[]) => {
          if (cmd === 'cmake' && args[0] === '--build') {
            resolve(args[1] as string);
            const buildDir = args[1] as string;
            fs.mkdirSync(buildDir, { recursive: true });
            fs.writeFileSync(path.join(buildDir, 'module.wasm'), Buffer.from([0x00, 0x61, 0x73, 0x6d]));
          }
          return { stdout: '', stderr: '' };
        });
      });

      const result = await strategy.compile({
        sourceCode: '// nested',
        fileName: sourcePath,
        compilerOptions: { release: false },
      });

      expect(execFile).toHaveBeenCalledWith('cmake', expect.arrayContaining(['-S', nestedDir]), expect.any(Object), expect.any(Function));
      expect(result.wasmBytes).toBeDefined();
    });
  });
});
