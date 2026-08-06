// AS WASM example using high-level Console + FS API (bindings via --path)
import { log } from 'console';
import { readFile } from 'fs';

/**
 * Reads the greeting file and logs its UTF-8 contents when available.
 */
export function _start(): void {
  log('Opening file...');
  let data = readFile('/mnt/data/greeting.txt');
  if (data != null) {
    log(String.UTF8.decode(data!));
  } else {
    log('(no mounted dir)');
  }
}
