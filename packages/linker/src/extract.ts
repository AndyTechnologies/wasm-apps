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

function moveWithStrip(srcDir: string, dstDir: string, strip: number): void {
  const walkAndMove = (currentDir: string, remaining: number) => {
    const entries = fs.readdirSync(currentDir);
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        if (remaining > 0) {
          walkAndMove(fullPath, remaining - 1);
        } else {
          const target = path.join(dstDir, path.relative(srcDir, fullPath));
          fs.mkdirSync(target, { recursive: true });
          const inner = fs.readdirSync(fullPath);
          for (const innerEntry of inner) {
            fs.renameSync(path.join(fullPath, innerEntry), path.join(target, innerEntry));
          }
        }
      } else if (remaining === 0) {
        const relPath = path.relative(srcDir, currentDir);
        const targetDir = path.join(dstDir, relPath);
        if (relPath) fs.mkdirSync(targetDir, { recursive: true });
        fs.renameSync(fullPath, path.join(targetDir || dstDir, entry));
      }
    }
  };

  walkAndMove(srcDir, strip);

  const removeEmptyDirs = (dir: string): void => {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        removeEmptyDirs(fullPath);
      }
    }
    if (fs.readdirSync(dir).length === 0 && dir !== srcDir) {
      fs.rmdirSync(dir);
    }
  };
  removeEmptyDirs(srcDir);
}

async function extractWithZip(archive: string, cwd: string, strip: number = 0): Promise<void> {
  if (strip > 0) {
    const tmpDir = path.join(cwd, `.tmp_extract_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      await extractZipInner(archive, tmpDir);
      moveWithStrip(tmpDir, cwd, strip);
    } finally {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  } else {
    await extractZipInner(archive, cwd);
  }
}
