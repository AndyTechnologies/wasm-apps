import { CompilerError } from '@wasm-apps/types';

/**
 * Error lanzado cuando una extensión de archivo no tiene un toolchain
 * registrado que pueda manejarla.
 */
export class UnsupportedExtensionError extends CompilerError {
  constructor(extension: string, fileName: string) {
    super(`Unsupported extension "${extension}" for file "${fileName}". No registered toolchain handles this extension.`, {
      code: 'UNSUPPORTED_EXTENSION',
      extension,
      fileName,
    });
    // CompilerError hardcodes code='COMPILER_ERROR' via ToolchainError.
    // Override via defineProperty since readonly is a TS constraint, not runtime.
    Object.defineProperty(this, 'code', {
      value: 'UNSUPPORTED_EXTENSION',
      writable: false,
      configurable: true,
    });
  }
}

/**
 * Error lanzado cuando el binario de un toolchain no está instalado
 * o no es accesible en el sistema.
 */
export class ToolchainNotInstalledError extends CompilerError {
  constructor(toolchainId: string, binary: string) {
    super(`Toolchain "${toolchainId}" is not available. Expected binary "${binary}" was not found on the system PATH.`, {
      code: 'TOOLCHAIN_NOT_INSTALLED',
      toolchainId,
      binary,
    });
    // Override code from COMPILER_ERROR to TOOLCHAIN_NOT_INSTALLED
    Object.defineProperty(this, 'code', {
      value: 'TOOLCHAIN_NOT_INSTALLED',
      writable: false,
      configurable: true,
    });
  }
}
