export { logger, colorizeByStatus, formatBytes } from './logger.js';
export type { Logger } from './logger.js';
import type { Logger as __Logger } from './logger.js';

type Logger = __Logger;

/** Una entrada de exportación WASM. */
export interface WasmExport {
  name: string;
  kind: 'function' | 'memory' | 'table' | 'global';
}

/** Una entrada de importación WASM. */
export interface WasmImport {
  module: string;
  name: string;
  kind: 'function' | 'memory' | 'table' | 'global';
}

/** Firma de tipos de una función importada. */
export interface WasmImportFuncType {
  module: string;
  name: string;
  params: string[];
  results: string[];
}

/** Metadatos de un módulo WASM parseado. */
export interface WasmModuleInfo {
  fileName: string;
  buffer: Buffer;
  imports: WasmImport[];
  exports: WasmExport[];
  importFuncTypes?: WasmImportFuncType[];
}

/** Estrategia para emparejar imports WASM con exports de otros módulos. */
export type ModuleMatchingStrategy = 'name-only' | 'file-name';

/** Un módulo en orden de dependencias resuelto con su índice de instancia. */
export interface ResolvedModule {
  module: WasmModuleInfo;
  index: number;
  instanceName: string;
}

/** Resultado de la resolución de dependencias: orden de instanciación + mapa de exports. */
export interface ResolvedLink {
  order: ResolvedModule[];
  exportMap: Map<string, { instance: string; name: string }>;
}

/** Definición de una función host a generar en C++. */
export interface HostFuncDef {
  module: string;
  name: string;
  params: string[];
  paramsType: string;
  body: string;
}

/** Función generadora que produce el cuerpo C++ para una función host. */
export type HostFunctionGenerator = (params: string[], results: string[]) => string;

/** Una función host registrada con sus metadatos y generador de código. */
export interface RegisteredHostFunction {
  module: string;
  name: string;
  generator: HostFunctionGenerator;
}

/** Opciones para crear un ejecutable nativo a partir de módulos WASM. */
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

/** Variante del runtime de AssemblyScript. */
export type AsRuntime = 'incremental' | 'minimal' | 'stub' | 'full';

/** Opciones para compilar un archivo .wasm.ts. */
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

/** Resultado de una compilación exitosa. */
export interface CompileResult {
  wasmBytes: Uint8Array;
  dtsContent: string;
  bindingsJs: string;
  sourceMap?: string;
  dependencies: string[];
  hash: string;
}

/** Un mapeo de alias para resolver rutas de importación. */
export interface ResolvedAlias {
  find: string | RegExp;
  replacement: string;
}

/** Una declaración de exportación parseada de código AssemblyScript. */
export interface ParsedExport {
  name: string;
  kind: 'function' | 'const' | 'class' | 'enum';
}

/** Configuración del compilador AssemblyScript (forma de asconfig.json). */
export interface AsConfig {
  extends?: string;
  entries?: string[];
  options?: Record<string, any>;
  targets?: Record<string, Record<string, any>>;
}

/** Configuración de alto nivel del proyecto (wapp.json). */
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

/** Especificación de un destino de compilación cruzada. */
export interface CrossCompileTarget {
  name: string;
  triple: string;
  output?: string;
  entry?: string;
  wasi?: boolean;
}

/** Fases del sistema de plugins del pipeline. */
export enum PipelinePhase {
  BeforeModuleCompile = 'beforeModuleCompile',
  AfterModuleCompile = 'afterModuleCompile',
  BeforeCodeGen = 'beforeCodeGen',
  AfterCodeGen = 'afterCodeGen',
  BeforeLink = 'beforeLink',
  AfterLink = 'afterLink',
  AfterBundle = 'afterBundle',
}

/** Configuración para un plugin individual. */
export interface PluginConfig {
  id: string;
  enabled: boolean;
  path?: string;
  config?: Record<string, unknown>;
}

/** Objeto de contexto que se pasa a través de las fases del pipeline. */
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

/** Función hook del pipeline, síncrona o asíncrona. */
export type PipelineHook = (context: PipelineContext) => Promise<void> | void;

/** Contexto proporcionado a cada plugin al registrarse. */
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

/** Un plugin del toolchain WASM. */
export interface WasmPlugin {
  id: string;
  register(ctx: PluginContext): void;
}

/** Un evento de vigilancia del sistema de archivos. */
export interface WatchEvent {
  type: 'change' | 'add' | 'unlink';
  filePath: string;
}

/** Clase base para todos los errores del toolchain con un código legible por máquina. */
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

/** Error lanzado por el compilador AssemblyScript. */
export class CompilerError extends ToolchainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'COMPILER_ERROR', details);
  }
}

/** Error lanzado por el linker (generación de binario nativo). */
export class LinkerError extends ToolchainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'LINKER_ERROR', details);
  }
}

/** Error lanzado por el toolchain Zig (sin usar, reservado para uso futuro). */
export class ZigError extends ToolchainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ZIG_ERROR', details);
  }
}

/** Error lanzado durante operaciones de descarga HTTP. */
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

/** Error lanzado por CMake (compilación C++). */
export class CMakeError extends ToolchainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CMAKE_ERROR', details);
  }
}

/** Error lanzado al leer la configuración del CLI. */
export class ConfigError extends ToolchainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', details);
  }
}
