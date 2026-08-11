/**
 * Pins de descarga para las dependencias RmlUI (SDL3, RmlUi, fonts).
 *
 * Cada pin fija URL, nombre de archivo y SHA256. El SHA256 se verifica
 * después de cada descarga (downloadFile purga el archivo en mismatch).
 *
 * Fuentes de los digests (computados en apply, T-019):
 *   - SDL3-devel-3.2.4-VC.zip     → release-3.2.4 (win32-x64 prebuilt)
 *   - SDL3-3.2.4.tar.gz           → release-3.2.4 (linux/macos source)
 *   - RmlUi-6.2.tar.gz            → refs/tags/6.2
 *   - fonts: Samples/assets/*.ttf del tarball RmlUi 6.2
 */

export interface RmluiPin {
  url: string;
  fileName: string;
  sha256: string;
}

/** SDL3: prebuilt VC.zip para win32-x64; source tarball para el resto. */
export const SDL3_PINS: Record<string, RmluiPin> = {
  'win32-x64': {
    url: 'https://github.com/libsdl-org/SDL/releases/download/release-3.2.4/SDL3-devel-3.2.4-VC.zip',
    fileName: 'SDL3-devel-3.2.4-VC.zip',
    sha256: '56537a0840bf3b9f328370670497aa15221e60bff4b1fbe0450e3e60c44a4ba2',
  },
  'linux-x64': {
    url: 'https://github.com/libsdl-org/SDL/releases/download/release-3.2.4/SDL3-3.2.4.tar.gz',
    fileName: 'SDL3-3.2.4.tar.gz',
    sha256: '2938328317301dfbe30176d79c251733aa5e7ec5c436c800b99ed4da7adcb0f0',
  },
  'linux-arm64': {
    url: 'https://github.com/libsdl-org/SDL/releases/download/release-3.2.4/SDL3-3.2.4.tar.gz',
    fileName: 'SDL3-3.2.4.tar.gz',
    sha256: '2938328317301dfbe30176d79c251733aa5e7ec5c436c800b99ed4da7adcb0f0',
  },
  'darwin-x64': {
    url: 'https://github.com/libsdl-org/SDL/releases/download/release-3.2.4/SDL3-3.2.4.tar.gz',
    fileName: 'SDL3-3.2.4.tar.gz',
    sha256: '2938328317301dfbe30176d79c251733aa5e7ec5c436c800b99ed4da7adcb0f0',
  },
  'darwin-arm64': {
    url: 'https://github.com/libsdl-org/SDL/releases/download/release-3.2.4/SDL3-3.2.4.tar.gz',
    fileName: 'SDL3-3.2.4.tar.gz',
    sha256: '2938328317301dfbe30176d79c251733aa5e7ec5c436c800b99ed4da7adcb0f0',
  },
};

/** RmlUi: tarball del tag pinned (independiente de plataforma). */
export const RMLUI_PIN: RmluiPin = {
  url: 'https://github.com/mikke89/RmlUi/archive/refs/tags/6.2.tar.gz',
  fileName: 'RmlUi-6.2.tar.gz',
  sha256: '814c3ff7b9666280338d8f0dda85979f5daf028d01c85fc8975431d1e2fd8e8b',
};

/** Fonts: extraídas de Samples/assets/ del tarball RmlUi 6.2. */
export const RMLUI_FONT_PINS: Record<string, RmluiPin> = {
  'LatoLatin-Regular.ttf': {
    url: '',
    fileName: 'LatoLatin-Regular.ttf',
    sha256: 'd785334ac4e7810f571def986bbad41161f68ac385db8813f798bf04d71478e1',
  },
  'LatoLatin-Bold.ttf': {
    url: '',
    fileName: 'LatoLatin-Bold.ttf',
    sha256: '74dc638cf436cce77a0217a2a55ce7906a4cc9e4c595c6f1dcd9dd858078c1b6',
  },
  'LatoLatin-Italic.ttf': {
    url: '',
    fileName: 'LatoLatin-Italic.ttf',
    sha256: '1121daa4b0f0510074f54b046b2a25016614cca419974b992e2b8a2b2231f5da',
  },
  'NotoEmoji-Regular.ttf': {
    url: '',
    fileName: 'NotoEmoji-Regular.ttf',
    sha256: '415dc6290378574135b64c808dc640c1df7531973290c4970c51fdeb849cb0c5',
  },
};

/** Devuelve el pin SDL3 para la plataforma/arquitectura dada. */
export function getSdl3Pin(platform: string, arch: string): RmluiPin {
  const key = `${platform}-${arch}`;
  const pin = SDL3_PINS[key];
  if (!pin) {
    throw new Error(`Unsupported platform for SDL3: ${key}`);
  }
  return pin;
}
