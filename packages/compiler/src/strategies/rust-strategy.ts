import type { ToolchainStrategy, ToolchainCompileOptions, ToolchainResult } from './toolchain-strategy.js';
import { CompilerError } from '@wasm-apps/types';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runExecFile } from './_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Directorio del crate vendido `wasm_apps_bindings` (copiado a dist por el build). */
const BINDINGS_RUST_DIR = path.resolve(__dirname, '..', 'bindings', 'rust');

/**
 * Escapa un path para usarlo como valor TOML: `\` → `\\` y `"` → `\"`
 * (necesario para rutas win32 dentro de `path = "..."`).
 */
export function escapeTomlPathValue(p: string): string {
  return p.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Inyecta `wasm_apps_bindings = { path = "<bindingsDir>" }` en el manifest.
 *
 * String-based (sin parser TOML): inserta la línea al final de la sección
 * `[dependencies]` existente, o crea la sección al final del archivo si falta.
 * Detecta EOL (CRLF-aware), preserva el contenido previo byte a byte y es
 * idempotente (si la dep ya está, no toca nada).
 */
export function injectBindingsDependency(manifest: string, bindingsDir: string, isWin32 = false): string {
  // Idempotence guard: ya inyectado → no-op
  if (/^\s*wasm_apps_bindings\s*=/m.test(manifest)) return manifest;

  const depLine = `wasm_apps_bindings = { path = "${isWin32 ? escapeTomlPathValue(bindingsDir) : bindingsDir}" }`;
  const eol = manifest.includes('\r\n') ? '\r\n' : '\n';

  const section = /^[ \t]*\[dependencies\][ \t]*(?:#.*)?$/m.exec(manifest);
  if (!section) {
    // Sin [dependencies]: crear la sección al final del archivo
    const separator = manifest.length > 0 && !manifest.endsWith(eol) ? eol : '';
    return manifest + separator + `[dependencies]${eol}${depLine}${eol}`;
  }

  // Fin del header incluyendo su EOL: la dep va tras la última línea no vacía
  const headerEol = /(?:\r\n|\n|\r)/.exec(manifest.slice(section.index + section[0].length));
  const headerEnd = headerEol && headerEol.index === 0 ? section.index + section[0].length + headerEol[0].length : section.index + section[0].length;

  const nextHeader = /^[ \t]*\[[^\]]*\]/gm;
  nextHeader.lastIndex = headerEnd;
  const next = nextHeader.exec(manifest);
  const sectionEnd = next ? next.index : manifest.length;

  // Recorrer las líneas de la sección y quedarse con el final de la última no vacía
  let lastContentEnd = headerEnd;
  let lastContentHadEol = headerEnd > section.index + section[0].length;
  const lineRe = /[^\r\n]*(?:\r\n|\n|\r|$)/g;
  lineRe.lastIndex = headerEnd;
  let line: RegExpExecArray | null;
  while ((line = lineRe.exec(manifest)) !== null) {
    if (line.index >= sectionEnd) break;
    const raw = line[0];
    if (raw.trim().length > 0) {
      lastContentEnd = line.index + raw.length;
      lastContentHadEol = /(?:\r\n|\n|\r)$/.test(raw);
    }
    if (line.index + raw.length >= sectionEnd) break;
  }
  const insertAt = Math.min(lastContentEnd, sectionEnd);
  const insert = lastContentHadEol ? `${depLine}${eol}` : `${eol}${depLine}${eol}`;

  return manifest.slice(0, insertAt) + insert + manifest.slice(insertAt);
}

/**
 * Estrategia de compilación para Rust (.wasm.rs).
 *
 * Si existe Cargo.toml en el directorio del fuente, lo usa directamente
 * (inyecta la dep del crate vendido y restaura los bytes tras compilar).
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
    const cargoLockPath = path.join(sourceDir, 'Cargo.lock');
    const hasCargoToml = fs.existsSync(cargoTomlPath);
    const isWin32 = process.platform === 'win32';

    const release = options.compilerOptions?.release ?? false;
    const buildProfile = release ? 'release' : 'debug';

    // Existing manifest: backup bytes (Cargo.toml + Cargo.lock si existen) → inyectar (D3)
    let backupToml: Buffer | null = null;
    let backupLock: Buffer | null = null;
    if (hasCargoToml) {
      backupToml = fs.readFileSync(cargoTomlPath);
      if (fs.existsSync(cargoLockPath)) {
        backupLock = fs.readFileSync(cargoLockPath);
      }
      const injected = injectBindingsDependency(backupToml.toString('utf-8'), BINDINGS_RUST_DIR, isWin32);
      fs.writeFileSync(cargoTomlPath, injected, 'utf-8');
    } else {
      // No Cargo.toml: crear uno temporal con cdylib + dep del crate vendido (REQ-2)
      const tempCargoContent = this.generateTempCargoToml(options.fileName, BINDINGS_RUST_DIR, isWin32);
      fs.writeFileSync(cargoTomlPath, tempCargoContent, 'utf-8');
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
      if (hasCargoToml) {
        // Restaurar byte-clean aunque falle el build (D3)
        if (backupToml) fs.writeFileSync(cargoTomlPath, backupToml);
        if (backupLock) {
          fs.writeFileSync(cargoLockPath, backupLock);
        } else {
          // Cargo pudo crear un Cargo.lock que no existía: eliminarlo
          fs.rmSync(cargoLockPath, { force: true });
        }
      } else if (fs.existsSync(cargoTomlPath)) {
        // Limpiar el Cargo.toml temporal que creamos
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
   * Incluye la dep del crate vendido bajo `[dependencies]` (REQ-2).
   */
  generateTempCargoToml(sourceFile: string, bindingsDir: string, isWin32 = false): string {
    const crateName = path
      .basename(sourceFile)
      .replace(/\.wasm\.rs$/i, '')
      .replace(/[^a-zA-Z0-9_]/g, '_');
    const manifest = `[package]
name = "${crateName || 'wasm_crate'}"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]
path = "${path.basename(sourceFile)}"

[dependencies]
`;
    return injectBindingsDependency(manifest, bindingsDir, isWin32);
  }
}
