/**
 * Golden file test for generateCCode refactoring.
 *
 * This test captures the output of generateCCode() with fixed fixtures
 * and compares it byte-for-byte after the Nunjucks template refactoring.
 *
 * Run BEFORE refactoring to capture golden output:
 *   UPDATE_GOLDEN=true pnpm vitest run packages/linker/src/golden.test.ts
 *
 * Run AFTER refactoring to verify output is identical:
 *   pnpm vitest run packages/linker/src/golden.test.ts
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import type { ResolvedLink, WasmModuleInfo, WasmImportFuncType } from '@wasm-apps/types';
import { generateCCode } from './codegen.js';

const GOLDEN_DIR = path.resolve(__dirname, '../__golden__');

interface GoldenFixture {
  name: string;
  link: ResolvedLink;
  entry: string;
  wasi: boolean;
  importFuncTypes?: WasmImportFuncType[];
}

function makeModule(
  name: string,
  exportsList: string[],
  importsList: Array<{ module: string; name: string; kind?: string }> = [],
  extraBytes?: number[],
): WasmModuleInfo {
  const baseBytes = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  const bytes = extraBytes ? [...baseBytes, ...extraBytes] : baseBytes;
  return {
    fileName: `/path/to/${name}.wasm`,
    buffer: Buffer.from(bytes),
    exports: exportsList.map((e) => ({ name: e, kind: 'function' as const })),
    imports: importsList.map((i) => ({
      module: i.module,
      name: i.name,
      kind: (i.kind || 'function') as any,
      ...(i.kind === 'global' ? { type: 'i32' as const } : {}),
    })),
    importFuncTypes: importsList
      .filter((i) => i.kind !== 'global')
      .map((i) => ({
        module: i.module,
        name: i.name,
        params: ['i32'],
        results: ['i32'],
      })),
  };
}

function makeResolved(modules: WasmModuleInfo[]): ResolvedLink {
  return {
    order: modules.map((mod, idx) => ({ module: mod, index: idx, instanceName: `instance${idx}` })),
    exportMap: new Map(),
  };
}

function goldenFilePath(name: string): string {
  return path.join(GOLDEN_DIR, `${name}.cpp`);
}

const FIXTURES: GoldenFixture[] = [
  {
    name: 'multi-module-wasi',
    link: makeResolved([
      makeModule('helper', ['getValue'], [{ module: 'env', name: 'abort' }], [0x01, 0x02, 0x03]),
      makeModule(
        'main',
        ['_start'],
        [
          { module: 'env', name: 'console.log' },
          { module: 'helper', name: 'getValue' },
        ],
      ),
    ]),
    entry: '_start',
    wasi: true,
  },
  {
    name: 'single-module-no-wasi',
    link: makeResolved([makeModule('test', ['_start'], [{ module: 'env', name: 'abort', kind: 'function' }], [0x01, 0x02, 0x03])]),
    entry: '_start',
    wasi: false,
  },
  {
    name: 'with-globals',
    link: makeResolved([
      makeModule(
        'calc',
        ['compute'],
        [
          { module: 'env', name: 'Math.PI', kind: 'global' },
          { module: 'env', name: 'console.log', kind: 'function' },
        ],
      ),
    ]),
    entry: 'compute',
    wasi: false,
  },
];

describe('generateCCode golden files', () => {
  // Check if we should update golden files
  const shouldUpdate = process.env.UPDATE_GOLDEN === 'true';

  for (const fixture of FIXTURES) {
    it(`output matches golden for '${fixture.name}'`, () => {
      const actual = generateCCode(fixture.link, fixture.entry, fixture.wasi, fixture.importFuncTypes);

      const gPath = goldenFilePath(fixture.name);

      if (shouldUpdate) {
        // Write golden file
        if (!fs.existsSync(GOLDEN_DIR)) {
          fs.mkdirSync(GOLDEN_DIR, { recursive: true });
        }
        fs.writeFileSync(gPath, actual, 'utf-8');
        // If updating, the test passes by writing the file
        // We still verify it can be read back
        expect(fs.existsSync(gPath)).toBe(true);
        return;
      }

      // Normal mode: compare against golden
      if (!fs.existsSync(gPath)) {
        // No golden file yet — write it (first run)
        if (!fs.existsSync(GOLDEN_DIR)) {
          fs.mkdirSync(GOLDEN_DIR, { recursive: true });
        }
        fs.writeFileSync(gPath, actual, 'utf-8');
        return;
      }

      const expected = fs.readFileSync(gPath, 'utf-8');
      expect(actual).toBe(expected);
    });
  }
});
