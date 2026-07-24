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
   * Lee un archivo .wasm, valida sus magic bytes y retorna los bytes sin modificar.
   * @throws {CompilerError} con código INVALID_WASM_MAGIC si los primeros 4 bytes no son \\0asm.
   * @throws {CompilerError} si el archivo no existe o no se puede leer.
   */
  async compile(options: ToolchainCompileOptions): Promise<ToolchainResult> {
    let fileBuffer: Buffer;
    try {
      fileBuffer = fs.readFileSync(options.fileName);
    } catch (err: any) {
      throw new CompilerError(`Cannot read WASM file "${options.fileName}": ${err.message ?? err}`, {
        code: 'INVALID_WASM_MAGIC',
        fileName: options.fileName,
        cause: err.message,
      });
    }

    // Validate magic bytes: 0x00 0x61 0x73 0x6D = "\0asm"
    if (fileBuffer.length < 4 || fileBuffer[0] !== 0x00 || fileBuffer[1] !== 0x61 || fileBuffer[2] !== 0x73 || fileBuffer[3] !== 0x6d) {
      throw new CompilerError(`Invalid WASM magic bytes in "${options.fileName}". Expected \\0asm at offset 0.`, {
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
