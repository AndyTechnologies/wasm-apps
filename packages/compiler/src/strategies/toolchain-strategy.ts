import type { ToolchainId } from '@wasm-apps/types';

/**
 * Versión del contrato de ToolchainStrategy.
 * Incrementar cuando haya cambios breaking en la interfaz.
 */
export const TOOLCHAIN_STRATEGY_VERSION = 1;

/**
 * Opciones pasadas a un ToolchainStrategy para una compilación concreta.
 */
export interface ToolchainCompileOptions {
  /** Código fuente del archivo a compilar. */
  sourceCode: string;
  /** Ruta/nombre del archivo fuente (para resolución de imports). */
  fileName: string;
  /** Opciones del compilador que aplican a este archivo (globales + overrides por toolchain). */
  compilerOptions?: {
    release?: boolean;
    runtime?: string;
    optimizeLevel?: number;
    shrinkLevel?: number;
    sourceMap?: boolean;
  };
}

/**
 * Resultado de una compilación exitosa por un ToolchainStrategy.
 */
export interface ToolchainResult {
  /** Bytes WASM compilados. */
  wasmBytes: Uint8Array;
  /** Nombre del archivo de salida. */
  fileName: string;
  /** Identificador del toolchain que produjo este resultado. */
  toolchainId: ToolchainId;
  /** Metadatos adicionales (hash, dependencias, etc.). */
  metadata?: Record<string, unknown>;
}

/**
 * Estrategia de compilación: cómo transformar código fuente en WASM.
 * Cada toolchain registra su propia implementación en el ToolchainRouter.
 */
export interface ToolchainStrategy {
  /** Identificador único del toolchain (e.g. 'assemblyscript', 'cpp', 'rust'). */
  readonly id: string;
  /** Extensiones de archivo que este toolchain puede manejar (e.g. ['.wasm.ts', '.as']). */
  readonly extensions: string[];
  /**
   * Compila el código fuente y retorna los bytes WASM.
   * @throws {CompilerError} si la compilación falla.
   */
  compile(options: ToolchainCompileOptions): Promise<ToolchainResult>;
  /**
   * Verifica si el toolchain está disponible en el sistema actual
   * (e.g., binario instalado, SDK presente).
   */
  isAvailable(): Promise<boolean>;
}
