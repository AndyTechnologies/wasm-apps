export { logger, colorizeByStatus, formatBytes } from './logger.js';
export type { Logger } from './logger.js';
import type { Logger as __Logger } from './logger.js';

type Logger = __Logger;

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

export type HostFunctionGenerator = (params: string[], results: string[]) => string;

export interface RegisteredHostFunction {
  module: string;
  name: string;
  generator: HostFunctionGenerator;
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

export type AsRuntime = 'incremental' | 'minimal' | 'stub' | 'full';

export interface CompileOptions {
  fileName: string;
  sourceCode: string;
  maxMemoryCacheSize?: number;
  ext?: string;
  isDev?: boolean;
  runtime?: AsRuntime;
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
  output?: string;
  entry?: string;
  wasi?: boolean;
  moduleMatching?: ModuleMatchingStrategy;
  target?: string;
  targets?: CrossCompileTarget[];
  zigPath?: string;
  wasmtimePath?: string;
  compiler?: {
    release?: boolean;
    runtime?: AsRuntime;
    optimizeLevel?: number;
    shrinkLevel?: number;
    sourceMap?: boolean;
  };
  optimization?: {
    level?: 'z' | 's' | '0' | '1' | '2' | '3';
  };
  plugins?: PluginConfig[];
}

export interface CrossCompileTarget {
  name: string;
  triple: string;
  output?: string;
  entry?: string;
  wasi?: boolean;
}

export enum PipelinePhase {
  BeforeModuleCompile = 'beforeModuleCompile',
  AfterModuleCompile = 'afterModuleCompile',
  BeforeCodeGen = 'beforeCodeGen',
  AfterCodeGen = 'afterCodeGen',
  BeforeLink = 'beforeLink',
  AfterLink = 'afterLink',
  AfterBundle = 'afterBundle',
}

export interface PluginConfig {
  id: string;
  enabled: boolean;
  path?: string;
  config?: Record<string, unknown>;
}

export interface PipelineContext {
  sourceDir?: string;
  outDir?: string;
  options: {
    entry: string;
    wasi: boolean;
    moduleMatching: ModuleMatchingStrategy;
    target?: string;
    release?: boolean;
    optimizeLevel?: number;
    shrinkLevel?: number;
  };
  pluginConfigs?: PluginConfig[];
  sourceFiles?: Array<{ fileName: string; sourceCode: string }>;
  wasmModules?: WasmModuleInfo[];
  resolvedLink?: ResolvedLink;
  importFuncTypes?: WasmImportFuncType[];
  cppCode?: string;
  outputPath?: string;
}

export type PipelineHook = (context: PipelineContext) => Promise<void> | void;

export interface PluginContext {
  hostFunctions: {
    register(module: string, name: string, generator: HostFunctionGenerator): void;
    get(module: string, name: string): HostFunctionGenerator | undefined;
    has(module: string, name: string): boolean;
  };
  pipeline: {
    register(phase: PipelinePhase, pluginId: string, hook: PipelineHook): void;
  };
  config?: Record<string, unknown>;
  logger: Logger;
}

export interface WasmPlugin {
  id: string;
  register(ctx: PluginContext): void;
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
