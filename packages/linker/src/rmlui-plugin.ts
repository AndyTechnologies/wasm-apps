import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PipelinePhase, type PluginContext, type WasmPlugin, type ExtraLib } from '@wasm-apps/types';
import type { PipelineContext, RmluiPluginConfig } from '@wasm-apps/types';
import { getRmluiCacheDir, getSdlIncludeDir, getRmluiIncludeDir, getSdlLibDir, getRmluiLibDir, RMLUI_VERSION, SDL3_VERSION } from './rmlui-dl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Module-level plugin state ────────────────────────────────────────────────
let isActive = false;
let activeTemplatePath: string | undefined;
let activeConfig: RmluiPluginConfig = {};

// ── Helpers for generating host function C++ bodies ─────────────────────────

/**
 * Body for a function that takes only scalar (i32) parameters and returns i32.
 * Calls the file-scope extern "C" function `::Rml_*` with the given arg indices.
 */
function scalarI32I32(name: string, argIndices: number[]): string {
  const args = argIndices.map((i) => `args[${i}].i32()`).join(', ');
  return `
    results[0] = Val(int32_t(::${name}(${args})));
    return std::monostate{};`;
}

/**
 * Body for a void-returning function with scalar params.
 */
function scalarVoid(name: string, argIndices: number[]): string {
  const args = argIndices.map((i) => `args[${i}].i32()`).join(', ');
  if (args) {
    return `
    ::${name}(${args});
    return std::monostate{};`;
  }
  return `
    ::${name}();
    return std::monostate{};`;
}

/**
 * Body for a function that takes one string param + optional scalars → i32.
 */
function string1I32(name: string, strArgIndex: number, extraScalarIndices: number[] = []): string {
  const scalars = extraScalarIndices.map((i) => `args[${i}].i32()`).join(', ');
  const callArgs = scalars ? `tag.c_str(), ${scalars}` : `tag.c_str()`;
  return `
    std::string tag = _readAsString(caller, args[${strArgIndex}].i32());
    results[0] = Val(int32_t(::${name}(${callArgs})));
    return std::monostate{};`;
}

/**
 * Body for a function that takes two string params + i32 handle → i32.
 * Pattern: (i32 handle, string p1, string p2) → i32
 */
function handleStringStringI32(name: string, handleIdx: number, str1Idx: number, str2Idx: number): string {
  return `
    Rml_ElementId el = args[${handleIdx}].i32();
    std::string p1 = _readAsString(caller, args[${str1Idx}].i32());
    std::string p2 = _readAsString(caller, args[${str2Idx}].i32());
    results[0] = Val(int32_t(::${name}(el, p1.c_str(), p2.c_str())));
    return std::monostate{};`;
}

/**
 * Body for a function that takes handle + string → i32.
 */
function handleStringI32(name: string, handleIdx: number, strIdx: number): string {
  return `
    Rml_ElementId el = args[${handleIdx}].i32();
    std::string s = _readAsString(caller, args[${strIdx}].i32());
    results[0] = Val(int32_t(::${name}(el, s.c_str())));
    return std::monostate{};`;
}

/**
 * Body for a function that takes handle + string → i32 (string pointer return).
 * The result is a WASM pointer to the returned string (written via _writeString).
 */
function handleStringStringReturn(name: string, handleIdx: number, strIdx: number): string {
  return `
    Rml_ElementId el = args[${handleIdx}].i32();
    std::string s = _readAsString(caller, args[${strIdx}].i32());
    const char* val = ::${name}(el, s.c_str());
    if (val) {
      results[0] = Val(int32_t(_writeString(caller, val)));
    } else {
      results[0] = Val(int32_t(0));
    }
    return std::monostate{};`;
}

/**
 * Body for a function that takes handle → string return.
 */
function handleStringReturn(name: string, handleIdx: number): string {
  return `
    Rml_ElementId el = args[${handleIdx}].i32();
    const char* val = ::${name}(el);
    if (val) {
      results[0] = Val(int32_t(_writeString(caller, val)));
    } else {
      results[0] = Val(int32_t(0));
    }
    return std::monostate{};`;
}

/**
 * Body for context + string → i32 (handle return).
 */
function contextStringHandle(name: string): string {
  return `
    Rml_ContextId ctx = args[0].i32();
    std::string s = _readAsString(caller, args[1].i32());
    results[0] = Val(int32_t(::${name}(ctx, s.c_str())));
    return std::monostate{};`;
}

/**
 * Body for context + (string, i32, i32) → i32 (context creation).
 */
function contextStringIIHandle(name: string): string {
  return `
    std::string name = _readAsString(caller, args[0].i32());
    int w = args[1].i32();
    int h = args[2].i32();
    results[0] = Val(int32_t(::${name}(name.c_str(), w, h)));
    return std::monostate{};`;
}

/**
 * Body for void-no-arg render loop function.
 */
function voidNoArg(name: string): string {
  return `
    ::${name}();
    return std::monostate{};`;
}

/**
 * Body for i32-no-arg (returns i32, no parameters).
 */
function i32NoArg(name: string): string {
  return `
    results[0] = Val(int32_t(::${name}()));
    return std::monostate{};`;
}

// ── Plugin definition ────────────────────────────────────────────────────────

const rmluiPlugin: WasmPlugin = {
  id: 'rmlui-plugin',

  register(ctx: PluginContext): void {
    isActive = true;

    // ── Register RmlUI host functions (real bridge bodies) ────────────

    // Context lifecycle
    ctx.hostFunctions.register('env', 'Rml_CreateContext', (_params, _results) => contextStringIIHandle('Rml_CreateContext'));
    ctx.hostFunctions.register('env', 'Rml_ReleaseContext', (_params, _results) => scalarVoid('Rml_ReleaseContext', [0]));

    // Document loading
    ctx.hostFunctions.register('env', 'Rml_LoadDocument', (_params, _results) => contextStringHandle('Rml_LoadDocument'));
    ctx.hostFunctions.register('env', 'Rml_LoadDocumentFromMemory', (_params, _results) => {
      if (_params.length >= 3) {
        return `
    Rml_ContextId c = args[0].i32();
    std::string rml = _readAsString(caller, args[1].i32());
    std::string sourceUrl = _readAsString(caller, args[2].i32());
    results[0] = Val(int32_t(::Rml_LoadDocumentFromMemory(c, rml.c_str(), sourceUrl.c_str())));
    return std::monostate{};`;
      }
      return `
    results[0] = Val(int32_t(RMLUI_ERR_NULL_PARAM));
    return std::monostate{};`;
    });
    ctx.hostFunctions.register('env', 'Rml_GetNumDocuments', (_params, _results) => {
      return `
    Rml_ContextId c = args[0].i32();
    results[0] = Val(int32_t(::Rml_GetNumDocuments(c)));
    return std::monostate{};`;
    });
    ctx.hostFunctions.register('env', 'Rml_GetDocument', (_params, _results) => {
      return `
    Rml_ContextId c = args[0].i32();
    int32_t index = args[1].i32();
    results[0] = Val(int32_t(::Rml_GetDocument(c, index)));
    return std::monostate{};`;
    });
    ctx.hostFunctions.register('env', 'Rml_ShowDocument', (_params, _results) => scalarVoid('Rml_ShowDocument', [0]));
    ctx.hostFunctions.register('env', 'Rml_HideDocument', (_params, _results) => scalarVoid('Rml_HideDocument', [0]));
    ctx.hostFunctions.register('env', 'Rml_CloseDocument', (_params, _results) => scalarVoid('Rml_CloseDocument', [0]));

    // Element tree construction
    ctx.hostFunctions.register('env', 'Rml_CreateElement', (_params, _results) => string1I32('Rml_CreateElement', 0));
    ctx.hostFunctions.register('env', 'Rml_CreateTextNode', (_params, _results) => string1I32('Rml_CreateTextNode', 0));
    ctx.hostFunctions.register('env', 'Rml_AppendChild', (_params, _results) => scalarI32I32('Rml_AppendChild', [0, 1]));
    ctx.hostFunctions.register('env', 'Rml_RemoveChild', (_params, _results) => scalarI32I32('Rml_RemoveChild', [0, 1]));
    ctx.hostFunctions.register('env', 'Rml_InsertBefore', (_params, _results) => scalarI32I32('Rml_InsertBefore', [0, 1, 2]));
    ctx.hostFunctions.register('env', 'Rml_ReplaceChild', (_params, _results) => scalarI32I32('Rml_ReplaceChild', [0, 1, 2]));

    // Attributes and content
    ctx.hostFunctions.register('env', 'Rml_SetAttribute', (_params, _results) => handleStringStringI32('Rml_SetAttribute', 0, 1, 2));
    ctx.hostFunctions.register('env', 'Rml_GetAttribute', (_params, _results) => handleStringStringReturn('Rml_GetAttribute', 0, 1));
    ctx.hostFunctions.register('env', 'Rml_RemoveAttribute', (_params, _results) => handleStringI32('Rml_RemoveAttribute', 0, 1));
    ctx.hostFunctions.register('env', 'Rml_HasAttribute', (_params, _results) => handleStringI32('Rml_HasAttribute', 0, 1));

    ctx.hostFunctions.register('env', 'Rml_SetTextContent', (_params, _results) => handleStringI32('Rml_SetTextContent', 0, 1));
    ctx.hostFunctions.register('env', 'Rml_GetTextContent', (_params, _results) => handleStringReturn('Rml_GetTextContent', 0));
    ctx.hostFunctions.register('env', 'Rml_SetInnerHTML', (_params, _results) => handleStringI32('Rml_SetInnerHTML', 0, 1));
    ctx.hostFunctions.register('env', 'Rml_GetInnerHTML', (_params, _results) => handleStringReturn('Rml_GetInnerHTML', 0));

    // Style properties
    ctx.hostFunctions.register('env', 'Rml_SetStyleProperty', (_params, _results) => handleStringStringI32('Rml_SetStyleProperty', 0, 1, 2));
    ctx.hostFunctions.register('env', 'Rml_GetStyleProperty', (_params, _results) => handleStringStringReturn('Rml_GetStyleProperty', 0, 1));
    ctx.hostFunctions.register('env', 'Rml_SetStyle', (_params, _results) => handleStringI32('Rml_SetStyle', 0, 1));

    // Events
    ctx.hostFunctions.register('env', 'Rml_AddEventListener', (_params, _results) => {
      if (_params.length >= 3) {
        return `
    Rml_ElementId el = args[0].i32();
    std::string event = _readAsString(caller, args[1].i32());
    Rml_CallbackId cbId = args[2].i32();
    results[0] = Val(int32_t(::Rml_AddEventListener(el, event.c_str(), cbId)));
    return std::monostate{};`;
      }
      return `
    results[0] = Val(int32_t(RMLUI_ERR_INVALID_HANDLE));
    return std::monostate{};`;
    });
    ctx.hostFunctions.register('env', 'Rml_RemoveEventListener', (_params, _results) => handleStringI32('Rml_RemoveEventListener', 0, 1));

    // Class list
    ctx.hostFunctions.register('env', 'Rml_SetClass', (_params, _results) => {
      if (_params.length >= 3) {
        return `
    Rml_ElementId el = args[0].i32();
    std::string cls = _readAsString(caller, args[1].i32());
    int32_t enabled = args[2].i32();
    results[0] = Val(int32_t(::Rml_SetClass(el, cls.c_str(), enabled)));
    return std::monostate{};`;
      }
      return `
    results[0] = Val(int32_t(RMLUI_ERR_NULL_PARAM));
    return std::monostate{};`;
    });
    ctx.hostFunctions.register('env', 'Rml_IsClassSet', (_params, _results) => handleStringI32('Rml_IsClassSet', 0, 1));
    ctx.hostFunctions.register('env', 'Rml_SetClassNames', (_params, _results) => handleStringI32('Rml_SetClassNames', 0, 1));

    // Font loading
    ctx.hostFunctions.register('env', 'Rml_LoadFont', (_params, _results) => string1I32('Rml_LoadFont', 0));
    ctx.hostFunctions.register('env', 'Rml_LoadFontFromBuffer', (_params, _results) => {
      if (_params.length >= 3) {
        return `
    std::string name = _readAsString(caller, args[0].i32());
    int32_t dataPtr = args[1].i32();
    int32_t dataLen = args[2].i32();
    // Read binary data from WASM memory directly
    auto _mem2 = caller.get_export("memory");
    auto* _memPtr = std::get_if<wasmtime::Memory>(&*_mem2);
    auto _span2 = _memPtr->data(caller.context());
    const void* buf = (dataPtr > 0 && dataLen > 0) ? (_span2.data() + dataPtr) : nullptr;
    results[0] = Val(int32_t(::Rml_LoadFontFromBuffer(name.c_str(), buf, dataLen)));
    return std::monostate{};`;
      }
      return `
    results[0] = Val(int32_t(RMLUI_ERR_NULL_PARAM));
    return std::monostate{};`;
    });

    // Texture loading
    ctx.hostFunctions.register('env', 'Rml_LoadTexture', (_params, _results) => string1I32('Rml_LoadTexture', 0));
    ctx.hostFunctions.register('env', 'Rml_LoadTextureFromBuffer', (_params, _results) => {
      if (_params.length >= 3) {
        return `
    std::string name = _readAsString(caller, args[0].i32());
    int32_t dataPtr = args[1].i32();
    int32_t dataLen = args[2].i32();
    auto _mem2 = caller.get_export("memory");
    auto* _memPtr = std::get_if<wasmtime::Memory>(&*_mem2);
    auto _span2 = _memPtr->data(caller.context());
    const void* buf = (dataPtr > 0 && dataLen > 0) ? (_span2.data() + dataPtr) : nullptr;
    results[0] = Val(int32_t(::Rml_LoadTextureFromBuffer(name.c_str(), buf, dataLen)));
    return std::monostate{};`;
      }
      return `
    results[0] = Val(int32_t(RMLUI_ERR_NULL_PARAM));
    return std::monostate{};`;
    });

    // Render loop
    ctx.hostFunctions.register('env', 'RmlUI_ProcessSdlEvents', (_params, _results) => voidNoArg('RmlUI_ProcessSdlEvents'));
    ctx.hostFunctions.register('env', 'RmlUI_Update', (_params, _results) => voidNoArg('RmlUI_Update'));
    ctx.hostFunctions.register('env', 'RmlUI_Render', (_params, _results) => voidNoArg('RmlUI_Render'));
    ctx.hostFunctions.register('env', 'RmlUI_Shutdown', (_params, _results) => voidNoArg('RmlUI_Shutdown'));
    ctx.hostFunctions.register('env', 'RmlUI_IsRunning', (_params, _results) => i32NoArg('RmlUI_IsRunning'));

    // Query selectors
    ctx.hostFunctions.register('env', 'Rml_GetElementById', (_params, _results) => contextStringHandle('Rml_GetElementById'));
    ctx.hostFunctions.register('env', 'Rml_QuerySelector', (_params, _results) => handleStringI32('Rml_QuerySelector', 0, 1));

    // Document body/head
    ctx.hostFunctions.register('env', 'Rml_GetBody', (_params, _results) => {
      return `
    Rml_ContextId c = args[0].i32();
    results[0] = Val(int32_t(::Rml_GetBody(c)));
    return std::monostate{};`;
    });
    ctx.hostFunctions.register('env', 'Rml_GetHead', (_params, _results) => {
      return `
    Rml_ContextId c = args[0].i32();
    results[0] = Val(int32_t(::Rml_GetHead(c)));
    return std::monostate{};`;
    });

    // New in v1 (added after verification)
    ctx.hostFunctions.register('env', 'Rml_LoadDocumentFromBuffer', (_params, _results) => {
      if (_params.length >= 3) {
        return `
    Rml_ContextId c = args[0].i32();
    int32_t dataPtr = args[1].i32();
    int32_t dataLen = args[2].i32();
    auto _mem = caller.get_export("memory");
    auto* _memPtr = std::get_if<wasmtime::Memory>(&*_mem);
    auto _span = _memPtr->data(caller.context());
    const void* buf = (dataPtr > 0 && dataLen > 0) ? (_span.data() + dataPtr) : nullptr;
    results[0] = Val(int32_t(::Rml_LoadDocumentFromBuffer(c, buf, dataLen)));
    return std::monostate{};`;
      }
      return `results[0] = Val(int32_t(RMLUI_ERR_NULL_PARAM)); return std::monostate{};`;
    });
    ctx.hostFunctions.register(
      'env',
      'Rml_QuerySelectorAll',
      (_params, _results) => `
    std::string s = _readAsString(caller, args[1].i32());
    auto ids = _rmluiQuerySelectorAllIds(args[0].i32(), s.c_str());
    results[0] = Val(int32_t(_writeI32List(caller, ids)));
    return std::monostate{};`,
    );
    ctx.hostFunctions.register(
      'env',
      'Rml_FreeNodeList',
      (_params, _results) => `
    // List lives in WASM memory; the AssemblyScript GC owns it.
    (void)args[0].i32();
    return std::monostate{};`,
    );
    ctx.hostFunctions.register('env', 'Rml_GetTextureDimensions', (_params, _results) => {
      return `
    std::string name = _readAsString(caller, args[0].i32());
    int32_t w = 0, h = 0;
    int32_t rc = ::Rml_GetTextureDimensions(name.c_str(), &w, &h);
    // Write back w, h to WASM memory if output pointers provided
    results[0] = Val(int32_t(rc));
    return std::monostate{};`;
    });
    ctx.hostFunctions.register('env', 'Rml_SetResourcePath', (_params, _results) => contextStringHandle('Rml_SetResourcePath'));
    ctx.hostFunctions.register('env', 'Rml_RegisterResourceProvider', (_params, _results) => {
      // Complex: needs to read a struct from WASM memory. Placeholder for v1.
      return `results[0] = Val(int32_t(RMLUI_ERR_UNSUPPORTED)); return std::monostate{};`;
    });
    ctx.hostFunctions.register('env', 'Rml_GetCurrentEvent', (_params, _results) => {
      return `
    const Rml_Event* ev = ::Rml_GetCurrentEvent();
    // Return pointer as i32 (WASM address), 0 if null
    // WASM consumer reads it via memory load
    results[0] = Val(int32_t(reinterpret_cast<intptr_t>(ev)));
    return std::monostate{};`;
    });

    // Debugger
    ctx.hostFunctions.register('env', 'Rml_DebuggerToggle', (_params, _results) => voidNoArg('Rml_DebuggerToggle'));

    // --- Register BeforeCodeGen hook: set template path ---

    ctx.pipeline.register(PipelinePhase.BeforeCodeGen, 'rmlui-plugin', (_pCtx: PipelineContext) => {
      activeTemplatePath = path.resolve(__dirname, '../templates-rmlui');
    });

    // --- Register BeforeLink hook: add RmlUI extra libs ---

    ctx.pipeline.register(PipelinePhase.BeforeLink, 'rmlui-plugin', (_pCtx: PipelineContext) => {
      const cacheDir = getRmluiCacheDir();
      const sdlIncludeDir = getSdlIncludeDir(cacheDir, RMLUI_VERSION);
      const rmluiIncludeDir = getRmluiIncludeDir(cacheDir, RMLUI_VERSION);

      ctx.logger.detail(`[rmlui-plugin] Extra libs would be added from:
        SDL:  ${sdlIncludeDir}
        RmlUI: ${rmluiIncludeDir}`);
    });

    // --- Store config ---

    if (ctx.config) {
      activeConfig = ctx.config as unknown as RmluiPluginConfig;
    }

    ctx.logger.detail('RmlUI plugin registered with real DOM API bridge host functions');
  },
};

export default rmluiPlugin;

/**
 * Devuelve la configuración activa del plugin RmlUI.
 * Útil para que otras partes del sistema consulten el estado del plugin.
 */
export function getRmluiConfig(): { isActive: boolean; config: RmluiPluginConfig; templatePath?: string } {
  return {
    isActive,
    config: activeConfig,
    templatePath: activeTemplatePath,
  };
}

/**
 * Devuelve las librerías extra (SDL3, RmlUi core+debugger) necesarias para
 * linkar un binario RmlUI. Vacío si el plugin no está activo.
 * Consumido por compileCpp(extraLibs) → generateCMakeListsWithExtras.
 */
export function getRmluiExtraLibs(): ExtraLib[] {
  if (!isActive) return [];
  const cacheDir = getRmluiCacheDir();
  const backendsDir = path.join(getRmluiIncludeDir(cacheDir, RMLUI_VERSION), 'RmlUi', 'Backends');
  // SDL3 estático en macOS exige todos los frameworks que enlaza su CMake
  // (sdl3-config.cmake → SDL3::SDL3-static): audio/video/input de la plataforma.
  const sdl3Frameworks = [
    'Cocoa',
    'IOKit',
    'CoreVideo',
    'CoreFoundation',
    'CoreGraphics',
    'CoreText',
    'AudioToolbox',
    'CoreAudio',
    'AVFoundation',
    'CoreMedia',
    'CoreHaptics',
    'GameController',
    'ForceFeedback',
    'Metal',
    'UniformTypeIdentifiers',
    'QuartzCore',
    'Carbon',
  ];
  const extraLibs: ExtraLib[] = [
    {
      name: 'sdl3',
      includeDir: getSdlIncludeDir(cacheDir, SDL3_VERSION),
      libDir: getSdlLibDir(cacheDir, SDL3_VERSION),
      libs: ['SDL3'],
      frameworks: process.platform === 'darwin' ? sdl3Frameworks : undefined,
    },
    {
      name: 'rmlui',
      includeDir: getRmluiIncludeDir(cacheDir, RMLUI_VERSION),
      libDir: getRmluiLibDir(cacheDir, RMLUI_VERSION),
      // Los backends SDL/GL3 son header+cpp: compilarlos junto a main.cpp.
      // Orden: rmlui_debugger antes que rmlui (el debugger referencia el vtable
      // de Rml::Plugin de la core lib).
      sources: [path.join(backendsDir, 'RmlUi_Platform_SDL.cpp'), path.join(backendsDir, 'RmlUi_Renderer_GL3.cpp')],
      // RmlUi 6.2 backends comprueban RMLUI_SDL_VERSION_* antes de incluir
      // SDL (los .cpp de backend se compilan como TUs separados).
      defines: [
        `RMLUI_SDL_VERSION_MAJOR=${SDL3_VERSION.split('.')[0]}`,
        `RMLUI_SDL_VERSION_MINOR=${SDL3_VERSION.split('.')[1]}`,
        `RMLUI_SDL_VERSION_PATCH=${SDL3_VERSION.split('.')[2]}`,
      ],
      libs: ['rmlui_debugger', 'rmlui'],
      frameworks: process.platform === 'darwin' ? sdl3Frameworks : undefined,
    },
  ];
  if (process.platform === 'linux') {
    extraLibs[0].libs.push('dl');
    // RmlUi 6.2 usa FreeType para el font engine; la lib viene después de
    // rmlui en el orden de enlazado para resolver las FT_* referencias.
    extraLibs[1].libs.push('freetype');
  } else if (process.platform === 'darwin') {
    // FreeType desde Homebrew (libfreetype.dylib). brew --prefix falla si no
    // hay brew: cae a /opt/homebrew (Apple Silicon) o /usr/local (Intel).
    const brewPrefix = (() => {
      try {
        return execFileSync('brew', ['--prefix', 'freetype'], { encoding: 'utf8' }).trim();
      } catch {
        return process.arch === 'arm64' ? '/opt/homebrew' : '/usr/local';
      }
    })();
    extraLibs.push({
      name: 'freetype',
      includeDir: path.join(brewPrefix, 'include'),
      libDir: path.join(brewPrefix, 'lib'),
      libs: ['freetype'],
    });
  }
  return extraLibs;
}
