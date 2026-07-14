import os from 'os';
import path from 'path';
import fs from 'fs';

export function cacheRootDir(): string {
  const newDir = path.join(os.homedir(), '.wasm-linker');
  if (!fs.existsSync(newDir)) {
    const oldDir = path.join(os.homedir(), '.wapp');
    if (fs.existsSync(oldDir)) {
      return oldDir;
    }
  }
  return newDir;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getDirSize(dir: string): number {
  let size = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        size += getDirSize(fullPath);
      } else if (entry.isFile()) {
        size += fs.statSync(fullPath).size;
      }
    }
  } catch {
    // skip inaccessible
  }
  return size;
}

export async function getCacheInfo(): Promise<{
  path: string;
  exists: boolean;
  size: number;
  humanSize: string;
  entries: string[];
}> {
  const root = cacheRootDir();
  const exists = fs.existsSync(root);

  if (!exists) {
    return { path: root, exists: false, size: 0, humanSize: '0 B', entries: [] };
  }

  const size = getDirSize(root);
  const entries = fs.readdirSync(root).flatMap(entry => {
    const full = path.join(root, entry);
    if (fs.statSync(full).isDirectory()) {
      return fs.readdirSync(full).map(sub => path.join(entry, sub));
    }
    return [entry];
  });

  return { path: root, exists: true, size, humanSize: formatBytes(size), entries };
}

export async function clearCache(): Promise<void> {
  const root = cacheRootDir();
  if (fs.existsSync(root)) {
    fs.rmSync(root, { recursive: true, force: true });
    console.log(`Cache eliminado: ${root}`);
  } else {
    console.log('No hay cache que eliminar.');
  }
}
