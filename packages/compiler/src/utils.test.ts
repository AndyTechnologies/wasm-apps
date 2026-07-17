import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { hashString, parseExports, resolveImportPath } from './utils.js';
import type { ResolvedAlias } from '@wasm-apps/types';

describe('hashString', () => {
  it('returns consistent hash for same input', () => {
    const a = hashString('hello');
    const b = hashString('hello');
    expect(a).toBe(b);
  });

  it('returns different hash for different input', () => {
    expect(hashString('hello')).not.toBe(hashString('world'));
  });

  it('returns hex string of correct length', () => {
    expect(hashString('test')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('parseExports', () => {
  it('parses function exports', () => {
    const lines = ['export function add(a: i32, b: i32): i32 {', 'export function sub(a: i32, b: i32): i32 {'];
    const result = parseExports(lines);
    expect(result).toContainEqual({ name: 'add', kind: 'function' });
    expect(result).toContainEqual({ name: 'sub', kind: 'function' });
  });

  it('parses exported classes', () => {
    const lines = ['export class Calculator {'];
    const result = parseExports(lines);
    expect(result).toContainEqual({ name: 'Calculator', kind: 'class' });
  });

  it('parses exported enums', () => {
    const lines = ['export enum Status {'];
    const result = parseExports(lines);
    expect(result).toContainEqual({ name: 'Status', kind: 'enum' });
  });

  it('parses exported const', () => {
    const lines = ['export const PI: f64 = 3.14;'];
    const result = parseExports(lines);
    expect(result).toContainEqual({ name: 'PI', kind: 'const' });
  });

  it('skips non-export lines', () => {
    const lines = ['function helper() {', 'const x = 1;'];
    const result = parseExports(lines);
    expect(result).toHaveLength(0);
  });
});

describe('resolveImportPath', () => {
  const aliases: ResolvedAlias[] = [];

  it('resolves relative path', () => {
    const result = resolveImportPath('./helper', '/project/src/main.ts', aliases);
    expect(result).toContain('helper');
  });

  it('resolves with aliases using join semantics', () => {
    const withAliases: ResolvedAlias[] = [{ find: '@', replacement: 'src' }];
    const result = resolveImportPath('@helper', '/project/main.ts', withAliases);
    expect(path.basename(result)).toBe('helper');
    expect(result).toContain('src');
  });

  it('resolves regex aliases', () => {
    const withAliases: ResolvedAlias[] = [{ find: /^@\//, replacement: './src/' }];
    const result = resolveImportPath('@/helper', '/project/main.ts', withAliases);
    expect(result).toBe('./src/helper');
  });

  it('resolves index file', () => {
    const result = resolveImportPath('.', '/project/src/main.ts', aliases);
    expect(path.basename(result)).toBe('src');
    expect(result).not.toContain('main.ts');
  });
});
