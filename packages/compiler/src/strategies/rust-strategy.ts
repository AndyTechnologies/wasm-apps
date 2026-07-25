import type { ToolchainStrategy, ToolchainCompileOptions, ToolchainResult } from './toolchain-strategy.js';
import { CompilerError } from '@wasm-apps/types';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runExecFile } from './_utils.js';

/**
 * Estrategia de compilación para Rust (.wasm.rs).
 *
 * Si existe Cargo.toml en el directorio del fuente, lo usa directamente.
 * Si no, crea un Cargo.toml temporal con `crate-type = ["cdylib"]`.
 *
 * Ejecuta `cargo build --target wasm32-unknown-unknown` y busca el .wasm
 * resultante en target/wasm32-unknown-unknown/{release|debug}/.
 */
export class RustCompilerStrategy implements ToolchainStrategy {
  readonly id = 'rust';
  readonly extensions = ['.wasm.rs'];

  private readonly execTimeout = 180_000; // 3 minutes

  /**
   * Verifica que cargo esté instalado y que el target wasm32-unknown-unknown
   * esté disponible.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await runExecFile('which', ['cargo'], { timeout: 5_000 });
    } catch {
      return false;
    }

    // Check if wasm target is installed
    try {
      const { stdout } = await runExecFile('rustup', ['target', 'list', '--installed'], { timeout: 10_000 });
      const output = String(stdout);
      return output.includes('wasm32-unknown-unknown');
    } catch {
      return false;
    }
  }

  /**
   * Compila un fuente Rust a WASM.
   * @throws {CompilerError} si la compilación falla.
   */
  async compile(options: ToolchainCompileOptions): Promise<ToolchainResult> {
    const sourceDir = path.dirname(path.resolve(options.fileName));
    const cargoTomlPath = path.join(sourceDir, 'Cargo.toml');
    const hasCargoToml = fs.existsSync(cargoTomlPath);

    const release = options.compilerOptions?.release ?? false;
    const buildProfile = release ? 'release' : 'debug';

    // If no Cargo.toml, create a temporary one with cdylib crate type
    let createdTempCargo = false;
    if (!hasCargoToml) {
      const tempCargoContent = this.generateTempCargoToml(options.fileName);
      fs.writeFileSync(cargoTomlPath, tempCargoContent, 'utf-8');
      createdTempCargo = true;
    }

    try {
      // Build with cargo
      const cargoArgs = ['build', '--target', 'wasm32-unknown-unknown'];
      if (release) {
        cargoArgs.push('--release');
      }

      const { stderr: buildStderr } = await runExecFile('cargo', cargoArgs, {
        cwd: sourceDir,
        timeout: this.execTimeout,
      });

      // Locate the compiled .wasm
      const targetDir = path.join(sourceDir, 'target', 'wasm32-unknown-unknown', buildProfile);
      const wasmOutput = this.findWasmOutput(targetDir, options.fileName);

      if (!wasmOutput || !fs.existsSync(wasmOutput)) {
        throw new CompilerError(`Cargo build completed but no .wasm output found in ${targetDir}`, {
          code: 'COMPILER_ERROR',
          fileName: options.fileName,
          targetDir,
          stderr: buildStderr,
        });
      }

      // Read the compiled WASM bytes
      const wasmBytes = fs.readFileSync(wasmOutput);

      return {
        wasmBytes: new Uint8Array(wasmBytes),
        fileName: options.fileName,
        toolchainId: 'rust',
      };
    } catch (err: any) {
      if (err instanceof CompilerError) throw err;
      throw new CompilerError(`Rust compilation failed for "${options.fileName}": ${err.message ?? err}`, {
        code: 'COMPILER_ERROR',
        fileName: options.fileName,
        stderr: err.stderr ?? err.message,
      });
    } finally {
      // Clean up temp Cargo.toml if we created one
      if (createdTempCargo && fs.existsSync(cargoTomlPath)) {
        try {
          fs.rmSync(cargoTomlPath, { force: true });
        } catch {
          // Best-effort cleanup
        }
      }
    }
  }

  /**
   * Busca el archivo .wasm compilado en el directorio target.
   * Busca cualquier archivo .wasm (cargo produce uno por crate).
   */
  private findWasmOutput(targetDir: string, sourceFile: string): string | null {
    if (!fs.existsSync(targetDir)) return null;

    const files = fs.readdirSync(targetDir);
    // Look for .wasm files, excluding .d.wasm (intermediate) files
    const wasmFiles = files.filter((f) => f.endsWith('.wasm') && !f.endsWith('.d.wasm'));

    if (wasmFiles.length === 0) return null;

    // Return the first .wasm file found
    return path.join(targetDir, wasmFiles[0]);
  }

  /**
   * Genera un Cargo.toml temporal para compilar un archivo .wasm.rs suelto.
   * El nombre del crate deriva del nombre del archivo fuente.
   */
  private generateTempCargoToml(sourceFile: string): string {
    const crateName = path
      .basename(sourceFile)
      .replace(/\.wasm\.rs$/i, '')
      .replace(/[^a-zA-Z0-9_]/g, '_');
    return `[package]
name = "${crateName || 'wasm_crate'}"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
`;
  }
}
