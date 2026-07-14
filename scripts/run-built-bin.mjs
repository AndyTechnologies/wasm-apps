import { execFileSync } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

const ext = process.platform === 'win32' ? '.exe' : '';
const bin = join('wasm-out', `wasm-out-app${ext}`);

if (!existsSync(bin)) {
  console.error(`Binario no encontrado: ${bin}`);
  process.exit(1);
}

execFileSync(bin, { stdio: 'inherit' });
