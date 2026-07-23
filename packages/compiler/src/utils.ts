import crypto from 'node:crypto';
import path from 'node:path';
import type { AsConfig, ResolvedAlias } from '@wasm-apps/types';

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

/**
 * Resuelve la ruta de un import local, aplicando alias configurados.
 * Si no encuentra alias, resuelve relativo al archivo fuente.
 */
export function resolveImportPath(importPath: string, sourceFile: string, aliases: ResolvedAlias[]): string {
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    for (const alias of aliases) {
      const find = typeof alias.find === 'string' ? alias.find : alias.find.source;
      if (importPath.startsWith(find)) {
        const resolvedAlias = alias.replacement + importPath.slice(find.length);
        return resolvedAlias.endsWith('.ts') ? resolvedAlias : `${resolvedAlias}.ts`;
      }
    }
  }
  const sourceDir = path.dirname(sourceFile);
  const resolved = path.resolve(sourceDir, importPath);
  return resolved.endsWith('.ts') ? resolved : `${resolved}.ts`;
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
