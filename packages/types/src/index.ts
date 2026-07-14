export { logger, colorizeByStatus, formatBytes } from './logger.js';
export type { Logger } from './logger.js';

export interface WasmExport {
  name: string;
  kind: 'function' | 'memory' | 'table' | 'global';
}

export interface WasmImport {
  module: string;
  name: string;
  kind: 'function' | 'memory' | 'table' | 'global';
}

export interface WasmImportFuncType {
  module: string;
  name: string;
  params: string[];
  results: string[];
}

export interface WasmModuleInfo {
  fileName: string;
  buffer: Buffer;
  imports: WasmImport[];
  exports: WasmExport[];
}

export type ModuleMatchingStrategy = 'name-only' | 'file-name';

export interface ResolvedModule {
  module: WasmModuleInfo;
  index: number;
  instanceName: string;
}

export interface ResolvedLink {
  order: ResolvedModule[];
  exportMap: Map<string, { instance: string; name: string }>;
}

export interface HostFuncDef {
  module: string;
  name: string;
  params: string[];
  paramsType: string;
  body: string;
}

export interface NativeAppOptions {
  inputPaths: string[];
  output: string;
  target?: string;
  entry: string;
  wasi: boolean;
  moduleMatching: ModuleMatchingStrategy;
  zigPath?: string;
  wasmtimePath?: string;
}

export interface CompileOptions {
  fileName: string;
  sourceCode: string;
  maxMemoryCacheSize?: number;
  ext?: string;
  isDev?: boolean;
  runtime?: string;
  sourceMap?: boolean;
  optimizeLevel?: number;
  shrinkLevel?: number;
  aliases?: ResolvedAlias[];
}

export interface CompileResult {
  wasmBytes: Uint8Array;
  dtsContent: string;
  bindingsJs: string;
  sourceMap?: string;
  dependencies: string[];
  hash: string;
}

export interface ResolvedAlias {
  find: string | RegExp;
  replacement: string;
}

export interface ParsedExport {
  name: string;
  kind: 'function' | 'const' | 'class' | 'enum';
}

export interface AsConfig {
  extends?: string;
  entries?: string[];
  options?: Record<string, any>;
  targets?: Record<string, Record<string, any>>;
}

export interface WappConfig {
  sourceDir?: string;
  outDir?: string;
  entry?: string;
  wasi?: boolean;
  moduleMatching?: ModuleMatchingStrategy;
  target?: string;
  targets?: CrossCompileTarget[];
  zigPath?: string;
  wasmtimePath?: string;
  compiler?: {
    release?: boolean;
    runtime?: 'incremental' | 'minimal' | 'stub' | 'full';
    optimizeLevel?: number;
    shrinkLevel?: number;
    sourceMap?: boolean;
  };
}

export interface CrossCompileTarget {
  name: string;
  triple: string;
  output?: string;
  entry?: string;
  wasi?: boolean;
}

export interface WatchEvent {
  type: 'change' | 'add' | 'unlink';
  filePath: string;
}

export abstract class ToolchainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class CompilerError extends ToolchainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'COMPILER_ERROR', details);
  }
}

export class LinkerError extends ToolchainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'LINKER_ERROR', details);
  }
}

export class ZigError extends ToolchainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ZIG_ERROR', details);
  }
}

export class DownloadError extends ToolchainError {
  constructor(
    message: string,
    public readonly url: string,
    public readonly statusCode?: number,
    public readonly cause?: Error,
  ) {
    super(message, 'DOWNLOAD_ERROR', { url, statusCode, causeMessage: cause?.message });
  }
}

export class CMakeError extends ToolchainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CMAKE_ERROR', details);
  }
}

export class ConfigError extends ToolchainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', details);
  }
}
