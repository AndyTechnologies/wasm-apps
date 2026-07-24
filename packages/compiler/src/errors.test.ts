import { describe, it, expect } from 'vitest';
import { UnsupportedExtensionError, ToolchainNotInstalledError } from './errors.js';
import { CompilerError } from '@wasm-apps/types';

describe('UnsupportedExtensionError', () => {
  it('extends CompilerError', () => {
    const err = new UnsupportedExtensionError('.xyz', 'file.xyz');
    expect(err).toBeInstanceOf(CompilerError);
    expect(err).toBeInstanceOf(Error);
  });

  it('sets correct error code', () => {
    const err = new UnsupportedExtensionError('.xyz', 'file.xyz');
    expect(err.code).toBe('UNSUPPORTED_EXTENSION');
  });

  it('includes extension and fileName in details', () => {
    const err = new UnsupportedExtensionError('.wasm.py', 'script.wasm.py');
    expect(err.details?.extension).toBe('.wasm.py');
    expect(err.details?.fileName).toBe('script.wasm.py');
  });

  it('has descriptive message', () => {
    const err = new UnsupportedExtensionError('.py', 'test.py');
    expect(err.message).toContain('.py');
    expect(err.message).toContain('test.py');
  });
});

describe('ToolchainNotInstalledError', () => {
  it('extends CompilerError', () => {
    const err = new ToolchainNotInstalledError('rust', 'rustc');
    expect(err).toBeInstanceOf(CompilerError);
    expect(err).toBeInstanceOf(Error);
  });

  it('sets correct error code', () => {
    const err = new ToolchainNotInstalledError('cpp', 'clang++');
    expect(err.code).toBe('TOOLCHAIN_NOT_INSTALLED');
  });

  it('includes toolchainId and binary in details', () => {
    const err = new ToolchainNotInstalledError('cpp', 'clang++');
    expect(err.details?.toolchainId).toBe('cpp');
    expect(err.details?.binary).toBe('clang++');
  });

  it('has descriptive message', () => {
    const err = new ToolchainNotInstalledError('rust', 'rustc');
    expect(err.message).toContain('rust');
    expect(err.message).toContain('rustc');
  });
});
