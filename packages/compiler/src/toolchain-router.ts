import path from 'node:path';
import type { ToolchainStrategy, ToolchainCompileOptions, ToolchainResult } from './strategies/toolchain-strategy.js';
import { UnsupportedExtensionError } from './errors.js';
import { logger } from '@wasm-apps/types';

/**
 * Enrutador de toolchains: registra estrategias de compilación y resuelve
 * qué estrategia usar para cada archivo según su extensión.
 *
 * Sigue el patrón Microkernel: ToolchainRouter es el núcleo y las estrategias
 * son los plugins internos.
 */
export class ToolchainRouter {
  /** Estrategias registradas, indexadas por toolchainId. */
  private strategies = new Map<string, ToolchainStrategy>();
  /** Mapa de extensión → toolchainId, reconstruido en cada register(). */
  private extensionMap = new Map<string, string>();

  /**
   * Registra una estrategia de compilación.
   * Si ya existe una con el mismo id, la sobrescribe.
   */
  register(strategy: ToolchainStrategy): void {
    if (this.strategies.has(strategy.id)) {
      logger.warn(`Overwriting existing strategy "${strategy.id}"`);
    }
    this.strategies.set(strategy.id, strategy);
    this.rebuildExtensionMap();
  }

  /**
   * Reconstruye el mapa extensión → toolchainId.
   * En caso de extensiones duplicadas entre estrategias, la última registrada
   * gana (estrategias posteriores sobrescriben).
   */
  private rebuildExtensionMap(): void {
    this.extensionMap.clear();
    for (const [, strategy] of this.strategies) {
      for (const ext of strategy.extensions) {
        this.extensionMap.set(ext, strategy.id);
      }
    }
  }

  /**
   * Retorna la estrategia que maneja la extensión dada, o undefined si no hay ninguna.
   * La resolución usa el sufijo más largo primero: por ejemplo, `.wasm.ts` se resuelve
   * antes que `.wasm` genérico.
   */
  resolveForExtension(extension: string): ToolchainStrategy | undefined {
    if (!extension) return undefined;

    // Longest-suffix-first: probamos sufijos decrecientes para que
    // .wasm.ts gane contra .wasm
    let candidateExt = extension;
    while (candidateExt.length > 0) {
      const id = this.extensionMap.get(candidateExt);
      if (id) {
        return this.strategies.get(id);
      }
      // Recortar desde la izquierda: .wasm.ts → .ts → (empty)
      const dotIndex = candidateExt.indexOf('.', 1);
      if (dotIndex === -1) break;
      candidateExt = candidateExt.slice(dotIndex);
    }

    return undefined;
  }

  /**
   * Extrae la extensión relevante de un path de archivo.
   * Busca el sufijo más largo conocido, desde el primer `.wasm.`.
   * Ejemplos:
   *   'math.wasm.ts' → '.wasm.ts'
   *   'module.wasm' → '.wasm'
   *   'script.as' → '.as'
   */
  getExtension(filePath: string): string {
    const basename = path.basename(filePath);
    const wasmIndex = basename.lastIndexOf('.wasm');
    if (wasmIndex !== -1) {
      const suffix = basename.slice(wasmIndex);
      if (suffix === '.wasm' || this.extensionMap.has(suffix)) {
        return suffix;
      }
      return suffix;
    }
    const dotIndex = basename.lastIndexOf('.');
    if (dotIndex === -1) return '';
    return basename.slice(dotIndex);
  }

  /**
   * Compila un archivo usando la estrategia correspondiente a su extensión.
   * @throws {CompilerError} con código UNSUPPORTED_EXTENSION si no hay estrategia.
   */
  async compileFile(options: ToolchainCompileOptions): Promise<ToolchainResult> {
    const ext = this.getExtension(options.fileName);
    const strategy = this.resolveForExtension(ext);
    if (!strategy) {
      throw new UnsupportedExtensionError(ext, options.fileName);
    }
    return strategy.compile(options);
  }

  /**
   * Registra las estrategias built-in del proyecto.
   * Cada estrategia recibe la configuración global del compilador combinada
   * con sus overrides específicos del toolchain.
   */
  registerBuiltins(strategies: ToolchainStrategy[]): void {
    for (const strategy of strategies) {
      this.register(strategy);
    }
  }
}
