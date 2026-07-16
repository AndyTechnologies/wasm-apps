import { describe, it, expect } from 'vitest';
import {
  ToolchainError,
  CompilerError,
  LinkerError,
  DownloadError,
  CMakeError,
  ConfigError,
} from './index.js';

describe('ToolchainError', () => {
  it('creates with message and code', () => {
    const err = new ToolchainError('test', 'TEST_CODE');
    expect(err.message).toBe('test');
    expect(err.code).toBe('TEST_CODE');
    expect(err.name).toBe('ToolchainError');
  });
});

describe('CompilerError', () => {
  it('creates with COMPILER_ERROR code', () => {
    const err = new CompilerError('fail');
    expect(err.code).toBe('COMPILER_ERROR');
    expect(err.message).toBe('fail');
  });
});

describe('LinkerError', () => {
  it('creates with LINKER_ERROR code', () => {
    const err = new LinkerError('link fail');
    expect(err.code).toBe('LINKER_ERROR');
  });
});

describe('DownloadError', () => {
  it('stores url and statusCode', () => {
    const err = new DownloadError('timeout', 'https://example.com/file', 404);
    expect(err.url).toBe('https://example.com/file');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('DOWNLOAD_ERROR');
  });
});

describe('CMakeError', () => {
  it('creates with CMAKE_ERROR code', () => {
    const err = new CMakeError('cmake fail');
    expect(err.code).toBe('CMAKE_ERROR');
  });
});

describe('ConfigError', () => {
  it('creates with CONFIG_ERROR code', () => {
    const err = new ConfigError('bad config');
    expect(err.code).toBe('CONFIG_ERROR');
  });
});
