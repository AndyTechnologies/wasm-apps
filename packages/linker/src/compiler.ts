import fs from 'fs';
import path from 'path';
import os from 'os';
import commandExists from 'command-exists';
import cmake_js from 'cmake-js';
import { CMakeError, logger } from '@wasm-apps/types';

const { CMake } = cmake_js;

export interface CompileOptions {
  source: string;
  includeDir: string;
  libPath: string;
  output: string;
  target?: string;
  wasi: boolean;
}

interface CrossToolchain {
  c: string;
  cxx: string;
  cFlags: string;
  cxxFlags: string;
  linkFlags: string;
}

interface ToolchainEntry {
  toolchain: CrossToolchain;
  targetOS: 'linux' | 'macos' | 'windows';
  description: string;
  installHint: string;
}

function getNativeTargetOS(): 'linux' | 'macos' | 'windows' {
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'win32') return 'windows';
  return 'linux';
}

function resolveToolchain(target?: string): ToolchainEntry {
  const hostOS = getNativeTargetOS();
  const triple = target || 'native';

  if (!target || triple === 'native') {
    return {
      toolchain: { c: '', cxx: '', cFlags: '', cxxFlags: '', linkFlags: '' },
      targetOS: hostOS,
      description: 'nativo',
      installHint: '',
    };
  }

  // --- Linux targets ---
  if (triple === 'x86_64-linux' || triple === 'x86_64-linux-gnu' || triple === 'x86_64-unknown-linux-gnu') {
    if (hostOS === 'linux' && process.arch === 'x64') {
      return {
        toolchain: { c: '', cxx: '', cFlags: '', cxxFlags: '', linkFlags: '' },
        targetOS: 'linux',
        description: 'nativo (x86_64-linux)',
        installHint: '',
      };
    }
    return {
      toolchain: { c: 'x86_64-linux-gnu-gcc', cxx: 'x86_64-linux-gnu-g++', cFlags: '', cxxFlags: '', linkFlags: '' },
      targetOS: 'linux',
      description: 'x86_64-linux',
      installHint: 'Instala el cross-compiler: apt install gcc-x86-64-linux-gnu g++-x86-64-linux-gnu',
    };
  }

  if (triple === 'aarch64-linux' || triple === 'aarch64-linux-gnu' || triple === 'aarch64-unknown-linux-gnu') {
    if (hostOS === 'linux' && process.arch === 'arm64') {
      return {
        toolchain: { c: '', cxx: '', cFlags: '', cxxFlags: '', linkFlags: '' },
        targetOS: 'linux',
        description: 'nativo (aarch64-linux)',
        installHint: '',
      };
    }
    return {
      toolchain: { c: 'aarch64-linux-gnu-gcc', cxx: 'aarch64-linux-gnu-g++', cFlags: '', cxxFlags: '', linkFlags: '' },
      targetOS: 'linux',
      description: 'aarch64-linux',
      installHint: 'Instala el cross-compiler: apt install gcc-aarch64-linux-gnu g++-aarch64-linux-gnu',
    };
  }

  // --- macOS targets ---
  if (triple === 'x86_64-macos' || triple === 'x86_64-apple-darwin' || triple === 'x86_64-apple-macos') {
    if (hostOS === 'macos' && process.arch === 'x64') {
      return {
        toolchain: { c: '', cxx: '', cFlags: '', cxxFlags: '', linkFlags: '' },
        targetOS: 'macos',
        description: 'nativo (x86_64-macos)',
        installHint: '',
      };
    }
    if (hostOS === 'macos' && process.arch === 'arm64') {
      return {
        toolchain: { c: '', cxx: '', cFlags: '-target x86_64-apple-macos', cxxFlags: '-target x86_64-apple-macos', linkFlags: '-target x86_64-apple-macos' },
        targetOS: 'macos',
        description: 'x86_64-macos (desde Apple Silicon)',
        installHint: '',
      };
    }
    return {
      toolchain: { c: 'x86_64-apple-darwin-cc', cxx: 'x86_64-apple-darwin-c++', cFlags: '', cxxFlags: '', linkFlags: '' },
      targetOS: 'macos',
      description: 'x86_64-macos (via osxcross)',
      installHint: 'Necesitas osxcross. Repo: https://github.com/tpoechtrager/osxcross\n'
        + 'Asegurate de que x86_64-apple-darwin-cc y x86_64-apple-darwin-c++ esten en el PATH.',
    };
  }

  if (triple === 'aarch64-macos' || triple === 'arm64-apple-darwin' || triple === 'arm64-apple-macos' || triple === 'aarch64-apple-darwin') {
    if (hostOS === 'macos' && process.arch === 'arm64') {
      return {
        toolchain: { c: '', cxx: '', cFlags: '', cxxFlags: '', linkFlags: '' },
        targetOS: 'macos',
        description: 'nativo (aarch64-macos)',
        installHint: '',
      };
    }
    if (hostOS === 'macos' && process.arch === 'x64') {
      return {
        toolchain: { c: '', cxx: '', cFlags: '-target arm64-apple-macos', cxxFlags: '-target arm64-apple-macos', linkFlags: '-target arm64-apple-macos' },
        targetOS: 'macos',
        description: 'aarch64-macos (desde Intel)',
        installHint: '',
      };
    }
    return {
      toolchain: { c: 'aarch64-apple-darwin-cc', cxx: 'aarch64-apple-darwin-c++', cFlags: '', cxxFlags: '', linkFlags: '' },
      targetOS: 'macos',
      description: 'aarch64-macos (via osxcross)',
      installHint: 'Necesitas osxcross. Repo: https://github.com/tpoechtrager/osxcross\n'
        + 'Asegurate de que aarch64-apple-darwin-cc y aarch64-apple-darwin-c++ esten en el PATH.',
    };
  }

  // --- Windows targets ---
  if (triple === 'x86_64-windows' || triple === 'x86_64-windows-gnu' || triple === 'x86_64-pc-windows-gnu') {
    if (hostOS === 'windows') {
      return {
        toolchain: { c: '', cxx: '', cFlags: '', cxxFlags: '', linkFlags: '' },
        targetOS: 'windows',
        description: 'nativo (x86_64-windows)',
        installHint: '',
      };
    }
    return {
      toolchain: { c: 'x86_64-w64-mingw32-gcc', cxx: 'x86_64-w64-mingw32-g++', cFlags: '', cxxFlags: '', linkFlags: '' },
      targetOS: 'windows',
      description: 'x86_64-windows (MinGW)',
      installHint: 'Instala MinGW-w64:\n'
        + '  Linux: apt install gcc-mingw-w64-x86-64 g++-mingw-w64-x86-64\n'
        + '  macOS: brew install mingw-w64\n'
        + '  Windows: instala MSYS2 (https://www.msys2.org/) y luego: pacman -S mingw-w64-x86_64-gcc',
    };
  }

  if (triple === 'x86_64-windows-msvc' || triple === 'x86_64-pc-windows-msvc') {
    if (hostOS === 'windows') {
      return {
        toolchain: { c: 'cl', cxx: 'cl', cFlags: '', cxxFlags: '', linkFlags: '' },
        targetOS: 'windows',
        description: 'x86_64-windows (MSVC)',
        installHint: 'Necesitas Visual Studio Build Tools con la toolchain de MSVC.\n'
          + 'Ejecuta desde una "Developer Command Prompt" o usa "vcvarsall.bat x64" antes de ejecutar wapp.',
      };
    }
    return {
      toolchain: { c: 'clang', cxx: 'clang++', cFlags: '-target x86_64-windows-msvc', cxxFlags: '-target x86_64-windows-msvc', linkFlags: '-target x86_64-windows-msvc -fuse-ld=lld' },
      targetOS: 'windows',
      description: 'x86_64-windows (MSVC via Clang)',
      installHint: 'Necesitas Clang y LLD:\n'
        + '  Linux: apt install clang lld\n'
        + '  macOS: brew install llvm',
    };
  }

  throw new CMakeError(`Target no soportado: "${triple}". Usa uno de: native, x86_64-linux, aarch64-linux, x86_64-macos, aarch64-macos, x86_64-windows, x86_64-windows-msvc`, { target: triple });
}

function validateToolchain(entry: ToolchainEntry): void {
  const { toolchain, installHint, targetOS } = entry;
  const toCheck = [toolchain.c, toolchain.cxx].filter(Boolean);

  const isMsvc = targetOS === 'windows'
    && (toolchain.c === 'cl' || toolchain.c === 'clang');
  if (isMsvc && process.platform === 'win32') {
    return;
  }

  const missing = toCheck.filter(cmd => !commandExists.sync(cmd));

  if (missing.length > 0) {
    throw new CMakeError(
      `Toolchain(s) no encontrada(s): ${missing.join(', ')}\n`
      + `Target: ${entry.description}\n`
      + installHint,
      { missing, target: entry.description },
    );
  }
}

function getPlatformLibs(targetOS: 'linux' | 'macos' | 'windows'): string {
  if (targetOS === 'macos') {
    return '"-framework Security" "-framework Foundation"';
  }
  if (targetOS === 'linux') {
    return 'pthread dl m';
  }
  if (targetOS === 'windows') {
    return 'ws2_32.lib bcrypt.lib ole32.lib';
  }
  return '';
}

function generateCMakeLists(entry: ToolchainEntry): string {
  const { toolchain, targetOS } = entry;
  const libs = getPlatformLibs(targetOS);

  const lines: string[] = [
    'cmake_minimum_required(VERSION 3.15)',
    'project(wasm-app LANGUAGES CXX)',
    '',
    'set(CMAKE_CXX_STANDARD 17)',
    'set(CMAKE_CXX_STANDARD_REQUIRED ON)',
    '',
    'set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${WASM_OUTPUT_DIR}")',
    '',
    'add_executable("${OUTPUT_NAME}" "${SOURCE_FILE}")',
    'target_include_directories("${OUTPUT_NAME}" PRIVATE "${WASMTIME_INCLUDE_DIR}")',
    'target_link_libraries("${OUTPUT_NAME}" PRIVATE "${WASMTIME_LIB_PATH}")',
    '',
  ];

  if (toolchain.c) {
    lines.push(`set(CMAKE_C_COMPILER "${toolchain.c}")`);
  }
  if (toolchain.cxx) {
    lines.push(`set(CMAKE_CXX_COMPILER "${toolchain.cxx}")`);
  }
  if (toolchain.cFlags) {
    lines.push(`set(CMAKE_C_FLAGS "\${CMAKE_C_FLAGS} ${toolchain.cFlags}")`);
  }
  if (toolchain.cxxFlags) {
    lines.push(`set(CMAKE_CXX_FLAGS "\${CMAKE_CXX_FLAGS} ${toolchain.cxxFlags}")`);
  }
  if (toolchain.linkFlags) {
    lines.push(`set(CMAKE_EXE_LINKER_FLAGS "\${CMAKE_EXE_LINKER_FLAGS} ${toolchain.linkFlags}")`);
  }

  if (libs) {
    lines.push(`target_link_libraries("\${OUTPUT_NAME}" PRIVATE ${libs})`);
  }

  lines.push(
    '',
    'if(WASI)',
    '  target_compile_definitions("${OUTPUT_NAME}" PRIVATE WASI_ENABLED)',
    'endif()',
  );

  return lines.join(os.EOL);
}

function binaryPathInDir(dir: string, targetName: string): string {
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(dir, `${targetName}${ext}`);
}

function locateBuiltBinary(workDir: string, targetName: string): string | null {
  const candidates = [
    binaryPathInDir(workDir, targetName),
    binaryPathInDir(path.join(workDir, 'Release'), targetName),
    binaryPathInDir(path.join(workDir, 'Debug'), targetName),
    binaryPathInDir(path.join(workDir, 'RelWithDebInfo'), targetName),
    binaryPathInDir(path.join(workDir, 'MinSizeRel'), targetName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export async function compileWithCMake(opts: CompileOptions): Promise<void> {
  const triple = opts.target || 'native';
  logger.detail(`Resolviendo toolchain para target: ${triple}`);

  const entry = resolveToolchain(opts.target);
  logger.detail(`Toolchain seleccionada: ${entry.description}`);

  if (entry.installHint) {
    validateToolchain(entry);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wasm-linker-'));
  const cmakeListsPath = path.join(tmpDir, 'CMakeLists.txt');
  const outputBaseName = path.basename(opts.output).replace(/\.[^/.]+$/, '');
  const outputDir = path.dirname(path.resolve(opts.output));

  try {
    const cmakeContent = generateCMakeLists(entry);
    fs.writeFileSync(cmakeListsPath, cmakeContent, 'utf-8');

    logger.detail(`CMakeLists.txt generado: ${cmakeListsPath}\n`);

    const cmake = new CMake({
      directory: tmpDir,
      cMakeOptions: {
        SOURCE_FILE: opts.source,
        WASMTIME_INCLUDE_DIR: opts.includeDir,
        WASMTIME_LIB_PATH: opts.libPath,
        OUTPUT_NAME: outputBaseName,
        WASM_OUTPUT_DIR: outputDir,
        WASI: opts.wasi ? 'ON' : 'OFF',
      },
    });

    logger.detail(`Configurando cmake-js en ${tmpDir}`);
    try {
      await cmake.configure();
    } catch (err: unknown) {
      throw new CMakeError(`Error al configurar cmake`, {
        causeMessage: (err as Error).message,
        tmpDir,
      });
    }

    logger.detail(`Compilando con cmake-js`);
    try {
      await cmake.build();
    } catch (err: unknown) {
      throw new CMakeError(`Error al compilar con cmake`, {
        causeMessage: (err as Error).message,
        tmpDir,
      });
    }

    const expectedBinary = binaryPathInDir(outputDir, outputBaseName);
    if (!fs.existsSync(expectedBinary)) {
      const workDir = path.join(tmpDir, 'build');
      const found = locateBuiltBinary(workDir, outputBaseName);
      if (found) {
        fs.copyFileSync(found, expectedBinary);
      } else {
        throw new CMakeError(
          `No se encontro el binario compilado. Se esperaba en: ${expectedBinary}`,
          { outputDir, targetName: outputBaseName, tmpDir },
        );
      }
    }

    const finalPath = path.resolve(opts.output);
    if (expectedBinary !== finalPath) {
      fs.renameSync(expectedBinary, finalPath);
    }

    logger.detail(`Binario generado: ${finalPath}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
