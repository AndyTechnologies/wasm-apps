import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@wasm-apps/types';

/**
 * Normaliza un path de fs.watch y rechaza aquellos con segmentos '..'
 * que no fueron resueltos por la normalización.
 * Retorna el path normalizado, o null si el path debe ser rechazado.
 */
export function sanitizeWatchPath(filename: string): string | null {
  const normalized = path.normalize(filename);
  if (normalized.includes('..')) return null;
  return normalized;
}

export interface WatchOptions {
  extensions: string[];
  onChange: (filePath: string) => void;
  debounceMs?: number;
}

function watchDirFs(dir: string, extensions: string[], onChange: (filePath: string) => void): fs.FSWatcher {
  return fs.watch(dir, { recursive: process.platform !== 'linux' }, (_eventType, filename) => {
    if (!filename) return;
    const sanitized = sanitizeWatchPath(filename);
    if (!sanitized) return;
    const matches = extensions.some((ext) => sanitized.endsWith(ext));
    if (!matches) return;

    if (process.platform === 'linux') {
      const fullPath = path.join(dir, sanitized);
      if (fs.existsSync(fullPath)) {
        onChange(fullPath);
      }
    } else {
      onChange(sanitized);
    }
  });
}

function walkDir(dir: string, extensions: string[]): { path: string; mtimeMs: number }[] {
  const results: { path: string; mtimeMs: number }[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, extensions));
    } else if (entry.isFile()) {
      const matches = extensions.some((ext) => fullPath.endsWith(ext));
      if (matches) {
        try {
          const stat = fs.statSync(fullPath);
          results.push({ path: fullPath, mtimeMs: stat.mtimeMs });
        } catch (err) {
          logger.detail(`watch: no se pudo stat ${fullPath}: ${(err as Error).message}`);
        }
      }
    }
  }
  return results;
}

function watchDirPoll(dir: string, extensions: string[], onChange: (filePath: string) => void, pollInterval: number): ReturnType<typeof setInterval> {
  const mtimes = new Map<string, number>();

  function scan(): void {
    try {
      const files = walkDir(dir, extensions);
      for (const { path: fullPath, mtimeMs } of files) {
        const prev = mtimes.get(fullPath);
        if (prev !== undefined && mtimeMs > prev) {
          onChange(fullPath);
        }
        mtimes.set(fullPath, mtimeMs);
      }
    } catch (err) {
      logger.detail(`watch: error en scan de polling: ${(err as Error).message}`);
    }
  }

  return setInterval(scan, pollInterval);
}

export function watchDirectory(dir: string, options: WatchOptions): () => void {
  const { extensions, onChange, debounceMs = 300 } = options;
  const cleanups: (() => void)[] = [];

  let debounceTimer: ReturnType<typeof setTimeout>;

  const debouncedOnChange = (filePath: string) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onChange(filePath), debounceMs);
  };

  if (process.platform === 'linux') {
    const pollInterval = Math.max(debounceMs, 1000);
    const timer = watchDirPoll(dir, extensions, debouncedOnChange, pollInterval);
    cleanups.push(() => clearInterval(timer));

    const watcher = fs.watch(dir, { recursive: false }, (_eventType, filename) => {
      if (!filename) return;
      const sanitized = sanitizeWatchPath(filename);
      if (!sanitized) return;
      const matches = extensions.some((ext) => sanitized.endsWith(ext));
      if (matches) {
        const fullPath = path.join(dir, sanitized);
        if (fs.existsSync(fullPath)) {
          debouncedOnChange(fullPath);
        }
      }
    });
    cleanups.push(() => watcher.close());
  } else {
    const watcher = watchDirFs(dir, extensions, debouncedOnChange);
    cleanups.push(() => watcher.close());
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
