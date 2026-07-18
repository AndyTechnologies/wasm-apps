import { describe, it, expect } from 'vitest';
import { ToolchainError, CompilerError, LinkerError, DownloadError, CMakeError, ConfigError, ZigError, PipelinePhase, formatBytes } from './index.js';

describe('formatBytes', () => {
  it('formatea 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formatea bytes sin decimal', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formatea KB con un decimal', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024)).toBe('1.0 KB');
  });

  it('formatea MB', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(5242880)).toBe('5.0 MB');
  });

  it('formatea GB', () => {
    const gb = 1073741824;
    expect(formatBytes(gb)).toBe('1.0 GB');
    expect(formatBytes(gb * 2)).toBe('2.0 GB');
  });
});

describe('ToolchainError', () => {
  it('crea con mensaje y código', () => {
    const err = new ToolchainError('error de prueba', 'TEST_CODE', { key: 'val' });
    expect(err.message).toBe('error de prueba');
    expect(err.code).toBe('TEST_CODE');
    expect(err.details).toEqual({ key: 'val' });
    expect(err.name).toBe('ToolchainError');
  });

  it('hereda de Error correctamente', () => {
    const err = new ToolchainError('test', 'CODE');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ToolchainError);
  });
});

describe('CompilerError', () => {
  it('crea con código COMPILER_ERROR', () => {
    const err = new CompilerError('fallo compilación');
    expect(err.code).toBe('COMPILER_ERROR');
    expect(err.message).toBe('fallo compilación');
  });

  it('acepta detalles adicionales', () => {
    const err = new CompilerError('error', { fileName: 'test.ts', stderr: 'sintax error' });
    expect(err.details).toEqual({ fileName: 'test.ts', stderr: 'sintax error' });
  });
});

describe('LinkerError', () => {
  it('crea con código LINKER_ERROR', () => {
    const err = new LinkerError('fallo linker');
    expect(err.code).toBe('LINKER_ERROR');
  });
});

describe('DownloadError', () => {
  it('almacena url y statusCode', () => {
    const err = new DownloadError('timeout', 'https://example.com/file', 404);
    expect(err.url).toBe('https://example.com/file');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('DOWNLOAD_ERROR');
  });

  it('almacena causa opcional', () => {
    const cause = new Error('conexión rechazada');
    const err = new DownloadError('fallo', 'https://example.com/file', 0, cause);
    expect(err.cause).toBe(cause);
    expect(err.details?.causeMessage).toBe('conexión rechazada');
  });
});

describe('CMakeError', () => {
  it('crea con código CMAKE_ERROR', () => {
    const err = new CMakeError('cmake falló');
    expect(err.code).toBe('CMAKE_ERROR');
  });
});

describe('ConfigError', () => {
  it('crea con código CONFIG_ERROR', () => {
    const err = new ConfigError('config inválida');
    expect(err.code).toBe('CONFIG_ERROR');
  });
});

describe('ZigError', () => {
  it('crea con código ZIG_ERROR', () => {
    const err = new ZigError('zig falló');
    expect(err.code).toBe('ZIG_ERROR');
  });
});

describe('PipelinePhase', () => {
  it('tiene todos los valores esperados', () => {
    expect(PipelinePhase.BeforeModuleCompile).toBe('beforeModuleCompile');
    expect(PipelinePhase.AfterModuleCompile).toBe('afterModuleCompile');
    expect(PipelinePhase.BeforeCodeGen).toBe('beforeCodeGen');
    expect(PipelinePhase.AfterCodeGen).toBe('afterCodeGen');
    expect(PipelinePhase.BeforeLink).toBe('beforeLink');
    expect(PipelinePhase.AfterLink).toBe('afterLink');
    expect(PipelinePhase.AfterBundle).toBe('afterBundle');
  });
});
