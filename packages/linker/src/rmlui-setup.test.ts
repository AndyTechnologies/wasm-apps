import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mockDownloadFile = vi.hoisted(() => vi.fn());
const mockExecFile = vi.hoisted(() => vi.fn());
const mockDetail = vi.hoisted(() => vi.fn());
const mockStep = vi.hoisted(() => vi.fn());
const mockWarn = vi.hoisted(() => vi.fn());

let fakeHome = '';

// Los getters de caché apuntan al HOME falso; el resto de rmlui-dl (pins,
// versiones) se mantiene real.
vi.mock('./rmlui-dl.js', async () => {
  const actual = await vi.importActual<Record<string, any>>('./rmlui-dl.js');
  return {
    ...actual,
    getRmluiCacheDir: () => join(fakeHome, '.wasm-linker', 'rmlui'),
    getSdlCacheDir: (c: string) => join(c, 'sdl'),
    getRmluiDepCacheDir: (c: string) => join(c, 'rmlui'),
    getFontsCacheDir: (c: string) => join(c, 'fonts'),
  };
});

vi.mock('./downloader.js', () => ({
  downloadFile: mockDownloadFile,
}));

vi.mock('./extract.js', () => ({
  extractTarGz: vi.fn().mockResolvedValue(undefined),
  extractZip: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<Record<string, any>>('node:child_process');
  return {
    ...actual,
    execFile: mockExecFile,
    execFileSync: vi.fn().mockReturnValue(Buffer.alloc(0)),
  };
});

vi.mock('@wasm-apps/types', async () => {
  const actual = await vi.importActual<Record<string, any>>('@wasm-apps/types');
  return {
    ...actual,
    logger: { detail: mockDetail, step: mockStep, warn: mockWarn },
  };
});

const FONTS = ['LatoLatin-Regular.ttf', 'LatoLatin-Bold.ttf', 'LatoLatin-Italic.ttf', 'NotoEmoji-Regular.ttf'];

describe('rmlui-setup: markers y caché (T-021/T-026)', () => {
  let homeDir: string;

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'rmlui-setup-home-'));
    fakeHome = homeDir;
    vi.clearAllMocks();
    mockDownloadFile.mockReset();
    mockExecFile.mockReset();
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (e: Error | null) => void) => cb(null));
  });

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true });
  });

  it('sdlMarkerName/rmluiMarkerName fijan versión', async () => {
    const { sdlMarkerName, rmluiMarkerName } = await import('./rmlui-setup.js');
    expect(sdlMarkerName()).toBe('sdl.3.2.4.ok');
    expect(rmluiMarkerName()).toBe('rmlui.6.2.ok');
  });

  it('marker presente → skip descargas (downloadFile no se llama)', async () => {
    const { setupRmlui } = await import('./rmlui-setup.js');
    const cacheDir = join(homeDir, '.wasm-linker', 'rmlui');
    const fontsDir = join(cacheDir, 'fonts');
    mkdirSync(fontsDir, { recursive: true });
    mkdirSync(join(cacheDir, 'sdl'), { recursive: true });
    mkdirSync(join(cacheDir, 'rmlui'), { recursive: true });
    writeFileSync(join(cacheDir, 'sdl', 'sdl.3.2.4.ok'), 'ok\n');
    writeFileSync(join(cacheDir, 'rmlui', 'rmlui.6.2.ok'), 'ok\n');
    for (const name of FONTS) writeFileSync(join(fontsDir, name), 'x');

    await setupRmlui();

    expect(mockDownloadFile).not.toHaveBeenCalled();
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('sin marker → descarga RmlUi + SDL3 con checksum pinned (downloadFile recibe sha256)', async () => {
    const { setupRmlui } = await import('./rmlui-setup.js');
    mockDownloadFile.mockResolvedValue(undefined);
    // extractFonts itera las 4 pins → pre-crear las 4 para que haga skip
    const fontsDir0 = join(homeDir, '.wasm-linker', 'rmlui', 'fonts');
    mkdirSync(fontsDir0, { recursive: true });
    for (const name of FONTS) writeFileSync(join(fontsDir0, name), 'x');

    await setupRmlui();

    const calls = mockDownloadFile.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const [, , , sha256] of calls) {
      expect(sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    const cacheDir = join(homeDir, '.wasm-linker', 'rmlui');
    expect(existsSync(join(cacheDir, 'rmlui', 'rmlui.6.2.ok'))).toBe(true);
    expect(existsSync(join(cacheDir, 'sdl', 'sdl.3.2.4.ok'))).toBe(true);
  });
});

describe('rmlui-setup: fallback source-build (T-022)', () => {
  let homeDir: string;

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'rmlui-setup-fb-'));
    fakeHome = homeDir;
    vi.clearAllMocks();
    mockDownloadFile.mockReset();
    mockExecFile.mockReset();
  });

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true });
  });

  it('RmlUi sin fallback → LinkerError con URL', async () => {
    const { setupRmlui } = await import('./rmlui-setup.js');
    mockDownloadFile.mockRejectedValue(new Error('HTTP 404'));

    await expect(setupRmlui()).rejects.toThrow(/RmlUi 6\.2 download failed and has no source fallback/);
    await expect(setupRmlui()).rejects.toThrow(/refs\/tags\/6\.2\.tar\.gz/);
  });

  it('SDL3 source tarball → build desde fuente (cmake -S) + marker', async () => {
    const { setupRmlui } = await import('./rmlui-setup.js');
    mockDownloadFile.mockImplementation(async (url: string) => {
      if (url.includes('mikke89')) return undefined; // RmlUi OK
      if (url.includes('libsdl-org')) return undefined; // SDL3 OK
    });
    // extractFonts necesita las 4 fonts pre-creadas (execFileSync mocked no extrae)
    const fontsDir = join(homeDir, '.wasm-linker', 'rmlui', 'fonts');
    mkdirSync(fontsDir, { recursive: true });
    for (const name of FONTS) writeFileSync(join(fontsDir, name), 'x');
    mockExecFile.mockImplementation((_cmd: string, args: string[], _opts: unknown, cb: (e: Error | null) => void) => cb(null));

    await setupRmlui();

    const cmakeCalls = mockExecFile.mock.calls.filter(([cmd]) => cmd === 'cmake');
    expect(cmakeCalls.length).toBeGreaterThanOrEqual(4); // RmlUi(2) + SDL3 configure/build/install(3) → ≥5; al menos configure+install
    const configure = cmakeCalls.find(([, args]) => args.includes('-S'));
    expect(configure).toBeDefined();
    const install = cmakeCalls.find(([, args]) => args.includes('--install'));
    expect(install).toBeDefined();
    expect(existsSync(join(homeDir, '.wasm-linker', 'rmlui', 'sdl', 'sdl.3.2.4.ok'))).toBe(true);
  });

  it('descarga SDL3 falla → LinkerError con URL+target (sin fallback)', async () => {
    const { setupRmlui } = await import('./rmlui-setup.js');
    mockDownloadFile.mockImplementation(async (url: string) => {
      if (url.includes('mikke89')) return undefined; // RmlUi OK
      if (url.includes('libsdl-org')) throw new Error('HTTP 404');
    });
    // extractFonts necesita las 4 fonts pre-creadas (execFileSync mocked no extrae)
    const fontsDir = join(homeDir, '.wasm-linker', 'rmlui', 'fonts');
    mkdirSync(fontsDir, { recursive: true });
    for (const name of FONTS) writeFileSync(join(fontsDir, name), 'x');
    mockExecFile.mockImplementation((_cmd: string, args: string[], _opts: unknown, cb: (e: Error | null) => void) => {
      if (args.some((a) => a.includes('RmlUi'))) return cb(null);
      cb(new Error('should not be reached'));
    });

    await expect(setupRmlui()).rejects.toThrow(/SDL3 3\.2\.4 download failed/);
    await expect(setupRmlui()).rejects.toThrow(/release-3\.2\.4/);
  });
});
