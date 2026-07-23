declare module 'lzma-native' {
  import { Transform } from 'node:stream';

  interface LzmaOptions {
    memlimit?: number;
  }

  export function createDecompressor(options?: LzmaOptions): Transform;
}
