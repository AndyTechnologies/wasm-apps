import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rmSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mockGetWasmtimeAsset = vi.hoisted(() => vi.fn());
const mockGetWasmtimeIncludeDir = vi.hoisted(() => vi.fn());
const mockDownloadFile = vi.hoisted(() => vi.fn());
const mockExtractArchive = vi.hoisted(() => vi.fn());
const mockExtractZip = vi.hoisted(() => vi.fn());
const mockClear = vi.hoisted(() => vi.fn());

vi.mock('./wasmtime-dl.js', () => ({
  getWasmtimeAsset: mockGetWasmtimeAsset,
  getWasmtimeCacheDir: () => '/tmp/mock-wasm-cache',
  getWasmtimeIncludeDir: mockGetWasmtimeIncludeDir,
}));

vi.mock('./downloader.js', () => ({
  downloadFile: mockDownloadFile,
}));

vi.mock('./extract.js', () => ({
  extractArchive: mockExtractArchive,
  extractZip: mockExtractZip,
}));

vi.mock('./cache.js', () => ({
  CacheManager: class {
    clear() {
      mockClear();
    }
  },
  getCacheInfo: vi.fn(),
}));

describe('setupWasmtime', () => {
  let testDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    testDir = mkdtempSync(join(tmpdir(), 'setup-test-'));
    mockGetWasmtimeAsset.mockReturnValue({
      url: 'https://example.com/wasmtime.tar.xz',
      fileName: 'wasmtime-v46.0.1-x86_64-linux.tar.xz',
    });
    mockGetWasmtimeIncludeDir.mockReturnValue(join(testDir, 'wasmtime-v46.0.1-c-api', 'include'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('uses custom wasmtimePath when header exists', async () => {
    const customDir = join(testDir, 'custom-wasmtime');
    mkdirSync(join(customDir, 'include'), { recursive: true });
    writeFileSync(join(customDir, 'include', 'wasmtime.h'), '');

    const { setupWasmtime } = await import('./setup.js');
    await setupWasmtime(customDir);

    // Should not download or extract — custom path has header
    expect(mockDownloadFile).not.toHaveBeenCalled();
    expect(mockExtractArchive).not.toHaveBeenCalled();
  });

  it('downloads and extracts when archive not cached', async () => {
    // getWasmtimeCacheDir points to non-existent dir by default
    const { setupWasmtime } = await import('./setup.js');
    await setupWasmtime();

    expect(mockDownloadFile).toHaveBeenCalledTimes(1);
    expect(mockDownloadFile).toHaveBeenCalledWith('https://example.com/wasmtime.tar.xz', expect.stringContaining('wasmtime-v46.0.1'), expect.any(Function));
    expect(mockExtractArchive).toHaveBeenCalledTimes(1);
    expect(mockExtractZip).not.toHaveBeenCalled();
  });

  it('uses extractZip for .zip files', async () => {
    mockGetWasmtimeAsset.mockReturnValue({
      url: 'https://example.com/wasmtime.zip',
      fileName: 'wasmtime-v46.0.1-x86_64-windows.zip',
    });
    mockGetWasmtimeIncludeDir.mockReturnValue(join(testDir, 'wasmtime-v46.0.1-c-api', 'include'));

    const { setupWasmtime } = await import('./setup.js');
    await setupWasmtime();

    expect(mockExtractZip).toHaveBeenCalledTimes(1);
    expect(mockExtractArchive).not.toHaveBeenCalled();
  });

  it('calls cache.clear() when ignoreCache is true', async () => {
    const { setupWasmtime } = await import('./setup.js');
    await setupWasmtime(undefined, true);

    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(mockDownloadFile).toHaveBeenCalledTimes(1);
  });

  it('checkWasmtimeSetup returns false when header is missing', async () => {
    const { checkWasmtimeSetup } = await import('./setup.js');
    const result = checkWasmtimeSetup(join(testDir, 'nonexistent'));
    expect(result).toBe(false);
  });

  it('checkWasmtimeSetup returns true when header exists', async () => {
    const customDir = join(testDir, 'valid-wasmtime');
    mkdirSync(join(customDir, 'include'), { recursive: true });
    writeFileSync(join(customDir, 'include', 'wasmtime.h'), '');

    const { checkWasmtimeSetup } = await import('./setup.js');
    const result = checkWasmtimeSetup(customDir);
    expect(result).toBe(true);
  });
});
