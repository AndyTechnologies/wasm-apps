import crypto from 'node:crypto';
import type { AsConfig } from '@wasm-apps/types';

/** Compara dos hashes SHA-256 para igualdad (comparación en tiempo constante). */
export function compareHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Calcula el resumen SHA-256 en hex de un string. */
export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf-8').digest('hex');
}

/** Extrae los nombres y tipos de las exportaciones de un source AssemblyScript. */
export function parseExports(source: string): Array<{ name: string; kind: string }> {
  const exports: Array<{ name: string; kind: string }> = [];
  const exportRegex = /export\s+(function|class|const|enum)\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = exportRegex.exec(source)) !== null) {
    exports.push({ name: match[2], kind: match[1] });
  }
  return exports;
}

/**
 * Fusiona configuraciones de asconfig.json para un target específico.
 * Aplica el orden: defaults → target override.
 */
export function mergeAsConfig(base: AsConfig, target: string): Record<string, any> {
  const merged: Record<string, any> = {};
  const defaults = base?.options || {};
  const targetOpts = base?.targets?.[target as keyof typeof base.targets] || {};
  Object.assign(merged, defaults, targetOpts);
  return merged;
}
