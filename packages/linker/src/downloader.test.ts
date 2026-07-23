import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:stream';
import { existsSync, writeFileSync, rmSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DownloadError } from '@wasm-apps/types';

const mkHttpsGet = vi.hoisted(() => vi.fn());
const mkHttpGet = vi.hoisted(() => vi.fn());
const mkRmSync = vi.hoisted(() => vi.fn());
const mkStatSync = vi.hoisted(() => vi.fn());

vi.mock('node:https', () => ({ get: mkHttpsGet }));
vi.mock('node:http', () => ({ get: mkHttpGet }));

function makeMockReq(): any {
  const ee = new EventEmitter();
  (ee as any).destroy = vi.fn();
  (ee as any).end = vi.fn();
  (ee as any).abort = vi.fn();
  (ee as any).write = vi.fn();
  return ee;
}

describe('downloadFile HTTP timeout option', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes timeout: 30000 in HTTP request options', async () => {
    const mockReq = makeMockReq();
    mkHttpsGet.mockReturnValue(mockReq);

    const { downloadFile } = await import('./downloader.js');

    const promise = downloadFile('https://example.com/test.tar.xz', '/tmp/download-test.tar.xz');
    await new Promise((r) => setTimeout(r, 10));

    expect(mkHttpsGet).toHaveBeenCalledTimes(1);
    const firstArg = mkHttpsGet.mock.calls[0][0];
    expect(firstArg).toBeDefined();
    if (firstArg && typeof firstArg === 'object') {
      expect(firstArg).toHaveProperty('timeout', 30000);
    }

    promise.catch(() => {});
  });
});

describe('downloadFile redirect limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects after too many redirects', async () => {
    const mockReq = makeMockReq();
    let redirectCount = 0;

    mkHttpsGet.mockImplementation((_options: any, _cb?: any) => {
      const cb = typeof _options === 'object' && typeof _cb === 'function' ? _cb : undefined;
      if (cb) {
        redirectCount++;
        const resp = new EventEmitter() as any;
        resp.statusCode = 302;
        resp.headers = { location: 'https://example.com/redirect-' + redirectCount };
        resp.destroy = vi.fn();
        resp.resume = vi.fn();
        setTimeout(() => cb(resp), 1);
      }
      return mockReq;
    });

    const { downloadFile } = await import('./downloader.js');

    // Should reject with DownloadError after exceeding redirect limit
    await expect(downloadFile('https://example.com/start', '/tmp/redirect-loop.tar.xz')).rejects.toThrow();
  });
});

describe('downloadFile resume integrity', () => {
  let testDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    testDir = mkdtempSync(join(tmpdir(), 'dl-resume-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('deletes partial file and restarts when server content is truncated', async () => {
    const partialFile = join(testDir, 'partial.tar.xz');
    // Create a 500-byte partial file
    writeFileSync(partialFile, Buffer.alloc(500));

    // Mock https.get for HEAD request (startByte > 0 triggers HEAD)
    let headDone = false;
    const mockReq = makeMockReq();
    mkHttpsGet.mockImplementation((optionsOrUrl: any, maybeCb?: any) => {
      const cb = typeof optionsOrUrl === 'object' && typeof maybeCb === 'function' ? maybeCb : undefined;

      if (cb) {
        // First call is HEAD request (startByte > 0)
        if (!headDone) {
          headDone = true;
          const resp = new EventEmitter() as any;
          resp.statusCode = 200;
          resp.headers = { 'content-length': '400', 'accept-ranges': 'bytes' };
          resp.destroy = vi.fn();
          resp.resume = vi.fn();
          resp.pipe = vi.fn();
          setTimeout(() => cb(resp), 1);
        }
      }
      return mockReq;
    });

    const { downloadFile } = await import('./downloader.js');

    // HEAD should return serverSize=400 (< startByte=500), so file should be deleted
    // and a new download started from byte 0
    const promise = downloadFile('https://example.com/file.tar.xz', partialFile);
    await new Promise((r) => setTimeout(r, 50));

    // The partial file should be deleted (by the resume integrity check)
    expect(existsSync(partialFile)).toBe(false);

    // https.get should be called at least twice: HEAD + new GET from byte 0
    expect(mkHttpsGet.mock.calls.length).toBeGreaterThanOrEqual(2);

    promise.catch(() => {});
  });
});

describe('downloadFile timeout triggers on slow server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects with DownloadError when request times out', async () => {
    const mockReq = makeMockReq();
    mkHttpsGet.mockReturnValue(mockReq);

    const { downloadFile } = await import('./downloader.js');

    const promise = downloadFile('https://example.com/slow.tar.xz', '/tmp/slow-test.tar.xz');
    await new Promise((r) => setImmediate(r));

    // Simulate a timeout/network error on the request
    const timeoutError = new Error('socket hang up');
    (timeoutError as any).code = 'ETIMEDOUT';
    mockReq.emit('error', timeoutError);

    await expect(promise).rejects.toThrow(DownloadError);
  });
});

describe('downloadFile hash mismatch detection', () => {
  let testDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    testDir = mkdtempSync(join(tmpdir(), 'dl-hash-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('rejects with DownloadError when hash does not match', { timeout: 10000 }, async () => {
    const mockReq = makeMockReq();
    const testData = Buffer.from('hello world');
    const destPath = join(testDir, 'hash-test.tar.xz');

    // Create a mock response that implements pipe() by writing test data to
    // the destination writable stream, simulating real streaming
    const mockResponse = new EventEmitter() as any;
    mockResponse.statusCode = 200;
    mockResponse.headers = {};
    mockResponse.destroy = vi.fn();
    mockResponse.resume = vi.fn();
    mockResponse.pipe = function (writable: any) {
      setTimeout(() => {
        writable.write(testData);
        writable.end();
      }, 1);
      return writable;
    };

    mkHttpsGet.mockImplementation((_options: any, cb?: any) => {
      if (typeof cb === 'function') {
        setTimeout(() => cb(mockResponse), 1);
      }
      return mockReq;
    });

    const { downloadFile } = await import('./downloader.js');

    // Use a wrong hash — the real hash of 'hello world' will not match 64 zeros
    const wrongHash = '0'.repeat(64);
    await expect(downloadFile('https://example.com/file.tar.xz', destPath, undefined, wrongHash)).rejects.toThrow(DownloadError);
  });
});

describe('downloadFile redirect domain validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects cross-domain redirects', async () => {
    const mockReq = makeMockReq();
    let firstCall = true;

    mkHttpsGet.mockImplementation((_options: any, _cb?: any) => {
      const cb = typeof _options === 'object' && typeof _cb === 'function' ? _cb : undefined;
      if (cb) {
        if (firstCall) {
          firstCall = false;
          const resp = new EventEmitter() as any;
          resp.statusCode = 302;
          resp.headers = { location: 'https://evil.com/malicious.tar.xz' };
          resp.destroy = vi.fn();
          resp.resume = vi.fn();
          setTimeout(() => cb(resp), 1);
        }
      }
      return mockReq;
    });

    const { downloadFile } = await import('./downloader.js');

    // Should reject because evil.com is not same domain as example.com
    await expect(downloadFile('https://example.com/file.tar.xz', '/tmp/cross-domain.tar.xz')).rejects.toThrow();
  });
});
