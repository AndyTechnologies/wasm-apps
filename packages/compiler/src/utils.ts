import crypto from 'node:crypto';
import path from 'node:path';
import type { ResolvedAlias, ParsedExport, AsConfig } from '@wasm-apps/types';

export function compareHash(a: string, b: string): boolean {
  return a === b;
}

export function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function resolveImportPath(
  importPath: string,
  importer: string,
  aliases: ResolvedAlias[],
): string {
  for (const alias of aliases) {
    if (typeof alias.find === 'string' && importPath.startsWith(alias.find)) {
      const rest = importPath.slice(alias.find.length);
      return path.posix.resolve(alias.replacement, rest);
    }
    if (alias.find instanceof RegExp && alias.find.test(importPath)) {
      return importPath.replace(alias.find, alias.replacement);
    }
  }

  if (importPath.startsWith('.')) {
    return path.posix.resolve(path.posix.dirname(importer.replace(/\\/g, '/')), importPath);
  }

  return importPath;
}

export function mergeAsConfig(asConfig: AsConfig | null, target: 'debug' | 'release'): Record<string, any> {
  if (!asConfig) return {};
  const baseOptions = asConfig.options || {};
  const targetOptions = asConfig.targets?.[target] || {};
  return { ...baseOptions, ...targetOptions };
}

export function parseExports(dtsContent: string): ParsedExport[] {
  const exports: ParsedExport[] = [];
  const regex = /export\s+(?:declare\s+)?(?:function|const|let|var|class|enum|abstract\s+class)\s+(\w+)/g;
  let match;
  while ((match = regex.exec(dtsContent)) !== null) {
    const name = match[1];
    const kind = match[0].includes('function') ? 'function' :
                 match[0].includes('class') ? 'class' :
                 match[0].includes('enum') ? 'enum' : 'const';
    exports.push({ name, kind });
  }
  return exports;
}
