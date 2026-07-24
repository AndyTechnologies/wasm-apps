import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrecompiledWasmStrategy } from './precompiled-strategy.js';
import { CompilerError } from '@wasm-apps/types';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('PrecompiledWasmStrategy', () => {
  let tmpDir: string;
  let strategy: PrecompiledWasmStrategy;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'precompile-test-'));
    strategy = new PrecompiledWasmStrategy();
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('has id "precompiled" and handles .wasm extension', () => {
    expect(strategy.id).toBe('precompiled');
    expect(strategy.extensions).toContain('.wasm');
  });

  it('isAvailable returns true (no external tool needed)', async () => {
    expect(await strategy.isAvailable()).toBe(true);
  });

  it('compile returns wasmBytes for a valid WASM file starting with \\0asm', async () => {
    const wasmPath = path.join(tmpDir, 'module.wasm');
    const validWasmBytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    fs.writeFileSync(wasmPath, Buffer.from(validWasmBytes));

    const result = await strategy.compile({
      sourceCode: '', // Not used for precompiled strategy — reads from disk
      fileName: wasmPath,
      compilerOptions: { release: true },
    });

    expect(result.wasmBytes).toBeInstanceOf(Uint8Array);
    expect(result.wasmBytes).toHaveLength(8);
    // First 4 bytes should be preserved as WASM magic
    expect(result.wasmBytes[0]).toBe(0x00);
    expect(result.wasmBytes[1]).toBe(0x61);
    expect(result.wasmBytes[2]).toBe(0x73);
    expect(result.wasmBytes[3]).toBe(0x6d);
    expect(result.fileName).toBe(wasmPath);
    expect(result.toolchainId).toBe('precompiled');
  });

  it('compile returns all wasm file content unchanged (not just magic bytes)', async () => {
    const wasmPath = path.join(tmpDir, 'full-module.wasm');
    // A slightly longer valid WASM-like buffer
    const buf = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f]);
    fs.writeFileSync(wasmPath, Buffer.from(buf));

    const result = await strategy.compile({
      sourceCode: '',
      fileName: wasmPath,
    });

    expect(result.wasmBytes).toHaveLength(15);
    // Verify content passes through unchanged
    for (let i = 0; i < buf.length; i++) {
      expect(result.wasmBytes[i]).toBe(buf[i]);
    }
  });

  it('throws CompilerError with INVALID_WASM_MAGIC for non-WASM content', async () => {
    const fakePath = path.join(tmpDir, 'fake.wasm');
    fs.writeFileSync(fakePath, 'not wasm content', 'utf-8');

    await expect(
      strategy.compile({
        sourceCode: '',
        fileName: fakePath,
      }),
    ).rejects.toThrow(CompilerError);

    // Verify it's the magic byte error specifically
    await expect(
      strategy.compile({
        sourceCode: '',
        fileName: fakePath,
      }),
    ).rejects.toThrow(/magic/i);
  });

  it('throws CompilerError with INVALID_WASM_MAGIC for empty file', async () => {
    const emptyPath = path.join(tmpDir, 'empty.wasm');
    fs.writeFileSync(emptyPath, '');

    await expect(
      strategy.compile({
        sourceCode: '',
        fileName: emptyPath,
      }),
    ).rejects.toThrow(/magic/i);
  });

  it('throws CompilerError when source file does not exist', async () => {
    const missingPath = path.join(tmpDir, 'nonexistent.wasm');

    await expect(
      strategy.compile({
        sourceCode: '',
        fileName: missingPath,
      }),
    ).rejects.toThrow(CompilerError);
  });

  it('throws CompilerError for first bytes that are close but not exact WASM magic', async () => {
    const borderlinePath = path.join(tmpDir, 'borderline.wasm');
    // First byte off by 1: 0x01 instead of 0x00
    const badMagic = new Uint8Array([0x01, 0x61, 0x73, 0x6d]);
    fs.writeFileSync(borderlinePath, Buffer.from(badMagic));

    await expect(
      strategy.compile({
        sourceCode: '',
        fileName: borderlinePath,
      }),
    ).rejects.toThrow(/magic/i);
  });
});
