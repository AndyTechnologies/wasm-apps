import commandExists from 'command-exists';
import spawn from 'cross-spawn';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export async function extract(archive: string, cwd: string, strip: number): Promise<void> {
  const commands = ['tar', 'unzip'];
  const command = commands.find(cmd => commandExists.sync(cmd));
  
  if (!command) {
    throw new Error('No se encontró ninguna de las siguientes comandos: tar, unzip');
  }

  if (archive.endsWith('.zip')) {
    await extractWithZip(archive, cwd, strip);
  } else if (command === 'tar') {
    await extractWithTar(archive, cwd, strip);
  } else {
    throw new Error(`No se pudo extraer el archivo ${archive}: \n\t- No se encontró un comando compatible. (${command} no soporta ${path.extname(archive)})\n`);
  }
}

async function extractWithTar(archive: string, cwd: string, strip: number): Promise<void> {
  const proc = spawn('tar', ['-xJf', archive, '--strip-components', strip.toString(), '-C', cwd], { stdio: 'inherit' });

  return new Promise<void>((resolve, reject) => {
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`tar -xJf fallo (codigo ${code})`)));
    proc.on('error', (err) => reject(new Error(`No se pudo ejecutar 'tar': ${err.message}.`)));
  });
}

async function extractZipInner(archive: string, cwd: string): Promise<void> {
  if (os.platform() === 'win32') {
    const ps = spawn('powershell', [
      '-NoProfile', '-Command',
      `& {Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${cwd.replace(/'/g, "''")}' -Force}`,
    ], { stdio: 'inherit' });
    return new Promise<void>((resolve, reject) => {
      ps.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Expand-Archive fallo: ${code}`)));
      ps.on('error', reject);
    });
  }

  const proc = spawn('unzip', ['-o', archive, '-d', cwd], { stdio: 'inherit' });
  return new Promise<void>((resolve, reject) => {
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`unzip fallo: ${code}`)));
    proc.on('error', reject);
  });
}

async function extractWithZip(archive: string, cwd: string, strip: number = 0): Promise<void> {
  if (strip > 0) {
    const tmpDir = path.join(cwd, `.tmp_extract_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      await extractZipInner(archive, tmpDir);
      const entries = fs.readdirSync(tmpDir).filter(e => e !== '.' && e !== '..');

      if (strip === 1 && entries.length === 1 && fs.statSync(path.join(tmpDir, entries[0])).isDirectory()) {
        const topDir = path.join(tmpDir, entries[0]);
        const innerEntries = fs.readdirSync(topDir);
        for (const entry of innerEntries) {
          fs.renameSync(path.join(topDir, entry), path.join(cwd, entry));
        }
      } else {
        for (const entry of entries) {
          fs.renameSync(path.join(tmpDir, entry), path.join(cwd, entry));
        }
      }
    } finally {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  } else {
    await extractZipInner(archive, cwd);
  }
}
