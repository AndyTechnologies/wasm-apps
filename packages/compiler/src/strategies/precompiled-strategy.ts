import type { ToolchainStrategy, ToolchainCompileOptions, ToolchainResult } from './toolchain-strategy.js';
import { CompilerError } from '@wasm-apps/types';
import fs from 'node:fs';

/**
 * Estrategia para archivos WASM precompilados.
 * Valida los magic bytes \\0asm y pasa los datos sin modificar.
 */
export class PrecompiledWasmStrategy implements ToolchainStrategy {
  readonly id = 'precompiled';
  readonly extensions = ['.wasm'];

  /**
   * Siempre disponible — no necesita herramientas externas.
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Lee un archivo .wasm, valida sus magic bytes y versión, y retorna los bytes sin modificar.
   * @throws {CompilerError} con código WASM_FILE_NOT_FOUND si el archivo no existe.
   * @throws {CompilerError} con código WASM_READ_ERROR si falla la lectura.
   * @throws {CompilerError} con código INVALID_WASM_MAGIC si los magic bytes o versión son inválidos.
   */
  async compile(options: ToolchainCompileOptions): Promise<ToolchainResult> {
    let fileBuffer: Buffer;
    try {
      fileBuffer = fs.readFileSync(options.fileName);
    } catch (err: any) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new CompilerError(`WASM file not found: "${options.fileName}"`, {
          code: 'WASM_FILE_NOT_FOUND',
          fileName: options.fileName,
          cause: err.message,
        });
      }
      throw new CompilerError(`Cannot read WASM file "${options.fileName}": ${err.message ?? err}`, {
        code: 'WASM_READ_ERROR',
        fileName: options.fileName,
        cause: err.message,
      });
    }

    if (fileBuffer.length < 8) {
      throw new CompilerError(`Invalid WASM file "${options.fileName}": too short (${fileBuffer.length} bytes, expected at least 8)`, {
        code: 'INVALID_WASM_MAGIC',
        fileName: options.fileName,
      });
    }

    // Validate magic bytes: 0x00 0x61 0x73 0x6D = "\0asm"
    if (fileBuffer[0] !== 0x00 || fileBuffer[1] !== 0x61 || fileBuffer[2] !== 0x73 || fileBuffer[3] !== 0x6d) {
      throw new CompilerError(`Invalid WASM magic bytes in "${options.fileName}". Expected \\0asm at offset 0.`, {
        code: 'INVALID_WASM_MAGIC',
        fileName: options.fileName,
      });
    }

    // Validate version byte at offset 4 — must be 0x01
    if (fileBuffer[4] !== 0x01) {
      throw new CompilerError(`Invalid WASM version byte in "${options.fileName}": expected 0x01, got 0x${fileBuffer[4].toString(16).padStart(2, '0')}`, {
        code: 'INVALID_WASM_MAGIC',
        fileName: options.fileName,
      });
    }

    return {
      wasmBytes: new Uint8Array(fileBuffer),
      fileName: options.fileName,
      toolchainId: 'precompiled',
    };
  }
}
