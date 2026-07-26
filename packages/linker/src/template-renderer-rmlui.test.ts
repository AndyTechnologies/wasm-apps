import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { renderTemplate } from './template-renderer.js';
import type { NunjucksTemplateContext } from './template-context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RMLUI_TEMPLATE_DIR = path.resolve(__dirname, '../templates-rmlui');

function minimalContext(overrides?: Partial<NunjucksTemplateContext>): NunjucksTemplateContext {
  return {
    moduleName: 'test-app',
    entryPoint: 'instance0',
    entryFunctionName: '_start',
    escapedEntryFunctionName: '_start',
    wasi: true,
    wasmtimeVersion: '46.0.1',
    modules: [
      {
        index: 0,
        varName: 'wasm_bytes_0',
        lenVar: 'wasm_len_0',
        moduleVar: 'mod0',
        instanceVar: 'instance0',
        bufferHex: '    0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00',
        bufferLength: 8,
        exports: [{ name: '_start', kind: 'function', escapedName: '_start', safeName: '_start' }],
      },
    ],
    hostFunctions: [],
    globals: [],
    ...overrides,
  };
}

describe('renderTemplate — RmlUI', () => {
  it('renders interactive RmlUI loop when rmlui.enabled is true', () => {
    const ctx = minimalContext({
      rmlui: {
        enabled: true,
        window: { title: 'Test App', width: 800, height: 600, resizable: true },
        debugger: true,
        resources: { searchPaths: ['ui/'] },
      },
    });
  const output = renderTemplate(ctx, RMLUI_TEMPLATE_DIR);

  // SDL/GL/RmlUI init
    expect(output).toContain('SDL_Init(SDL_INIT_VIDEO)');
    expect(output).toContain('SDL_GL_SetAttribute');
    expect(output).toContain('SDL_CreateWindow');
    expect(output).toContain('SDL_GL_CreateContext');
    expect(output).toContain('gladLoadGL');
    expect(output).toContain('SDL_GL_MakeCurrent(_rmluiWindow, _rmluiGlContext)');
    expect(output).toContain('Rml::SetSystemInterface');
    expect(output).toContain('Rml::SetRenderInterface');
    expect(output).toContain('Rml::Initialise');
    expect(output).toContain('Rml::Debugger::Initialise');
    expect(output).toContain('Rml::LoadFontFace');
    expect(output).toContain('LatoLatin-Regular.ttf'); // default font fallback

    // Interactive loop
    expect(output).toContain('while (_rmluiRunning)');
    expect(output).toContain('RmlUI_ProcessSdlEvents()');
    expect(output).toContain('RmlUI_Update()');
    expect(output).toContain('entry_func.call(ctx, {})');
    expect(output).toContain('RmlUI_Render()');
    expect(output).toContain('RmlUI_Shutdown()');

    // Window config values rendered
    expect(output).toContain('Test App'); // title
    expect(output).toContain('800'); // width
    expect(output).toContain('600'); // height
    expect(output).toContain('SDL_WINDOW_RESIZABLE');

    // Loop uses break+_rmluiRunning instead of return 1
    expect(output).toContain('_rmluiRunning = false');
    expect(output).toContain('break;');
  });

  it('does NOT render RmlUI init when rmlui is undefined', () => {
    const ctx = minimalContext(); // no rmlui field
    const output = renderTemplate(ctx, RMLUI_TEMPLATE_DIR);

    expect(output).not.toContain('SDL_Init');
    expect(output).not.toContain('SDL_CreateWindow');
    expect(output).not.toContain('Rml::Initialise');
    expect(output).not.toContain('RmlUI_ProcessSdlEvents');
    expect(output).not.toContain('RmlUI_Render');
    expect(output).not.toContain('RmlUI_Shutdown');
    expect(output).not.toContain('_rmluiRunning');

    // Should use the non-rmlui path
    expect(output).toContain('entry_func.call(ctx, {})');
  });

  it('renders RmlUI without debugger when debugger is false', () => {
    const ctx = minimalContext({
      rmlui: {
        enabled: true,
        window: { title: 'Test', width: 1024, height: 768, resizable: false },
        debugger: false,
        resources: { searchPaths: [] },
      },
    });
    const output = renderTemplate(ctx, RMLUI_TEMPLATE_DIR);

    expect(output).not.toContain('Rml::Debugger::Initialise');
    expect(output).not.toContain('SDL_WINDOW_RESIZABLE'); // not resizable
  });

  it('renders configured defaultFont when provided', () => {
    const ctx = minimalContext({
      rmlui: {
        enabled: true,
        window: { title: 'Test', width: 1024, height: 768, resizable: false },
        debugger: false,
        resources: { searchPaths: [], defaultFont: 'Custom-Regular.ttf' },
      },
    });
    const output = renderTemplate(ctx, RMLUI_TEMPLATE_DIR);

    // W8: uses configured font instead of defaults
    expect(output).toContain('Custom-Regular.ttf');
    expect(output).not.toContain('LatoLatin-Regular.ttf');
    expect(output).not.toContain('NotoEmoji-Regular.ttf');
  });

  it('includes _rmlui-state.c.njk content when rmlui is enabled', () => {
    const ctx = minimalContext({
      rmlui: {
        enabled: true,
        window: { title: 'Test', width: 1024, height: 768, resizable: false },
        debugger: false,
        resources: { searchPaths: [] },
      },
    });
    const output = renderTemplate(ctx, RMLUI_TEMPLATE_DIR);

    // Shared state variables
    expect(output).toContain('_rmluiWindow');
    expect(output).toContain('_rmluiGlContext');
    expect(output).toContain('_rmluiRenderInterface');
    expect(output).toContain('_rmluiSystemInterface');
    expect(output).toContain('_rmluiContexts');
    expect(output).toContain('_rmluiElements');
    expect(output).toContain('_rmluiCallbacks');
    expect(output).toContain('_rmluiRunning');
    expect(output).toContain('_rmluiNextContextId');
    expect(output).toContain('_rmluiNextElementId');
    expect(output).toContain('_rmluiNextCallbackId');

    // String buffers
    expect(output).toContain('_rmluiAttrBuf');
    expect(output).toContain('_rmluiContentBuf');
    expect(output).toContain('_rmluiHTMLBuf');
    expect(output).toContain('_rmluiStyleBuf');

    // Reentrancy guard
    expect(output).toContain('_rmluiInEventDispatch');

    // C ABI implementations
    expect(output).toContain('Rml_CreateContext');
    expect(output).toContain('Rml_ReleaseContext');
    expect(output).toContain('Rml_LoadDocument');
    expect(output).toContain('Rml_LoadDocumentFromString');
    expect(output).toContain('Rml_ShowDocument');
    expect(output).toContain('Rml_CreateElement');
    expect(output).toContain('Rml_CreateTextNode');
    expect(output).toContain('Rml_AppendChild');
    expect(output).toContain('Rml_RemoveChild');
    expect(output).toContain('Rml_InsertBefore');
    expect(output).toContain('Rml_ReplaceChild');
    expect(output).toContain('Rml_SetAttribute');
    expect(output).toContain('Rml_GetAttribute');
    expect(output).toContain('Rml_SetTextContent');
    expect(output).toContain('Rml_GetTextContent');
    expect(output).toContain('Rml_SetInnerHTML');
    expect(output).toContain('Rml_GetInnerHTML');
    expect(output).toContain('Rml_SetStyleProperty');
    expect(output).toContain('Rml_GetStyleProperty');
    expect(output).toContain('Rml_SetStyle');
    expect(output).toContain('Rml_AddEventListener');
    expect(output).toContain('Rml_RemoveEventListener');
    expect(output).toContain('Rml_AddClass');
    expect(output).toContain('Rml_RemoveClass');
    expect(output).toContain('Rml_ToggleClass');
    expect(output).toContain('Rml_HasClass');
    expect(output).toContain('Rml_LoadFont');
    expect(output).toContain('Rml_LoadFontFromBuffer');
    expect(output).toContain('Rml_LoadTexture');
    expect(output).toContain('Rml_LoadTextureFromBuffer');
    expect(output).toContain('Rml_GetTextureDimensions');
    expect(output).toContain('Rml_GetElementById');
    expect(output).toContain('Rml_QuerySelector');
    expect(output).toContain('Rml_QuerySelectorAll');
    expect(output).toContain('Rml_FreeNodeList');
    expect(output).toContain('Rml_GetBody');
    expect(output).toContain('Rml_GetHead');
    expect(output).toContain('Rml_GetCurrentEvent');
    expect(output).toContain('Rml_DebuggerToggle');
    expect(output).toContain('Rml_LoadDocumentFromBuffer');
    expect(output).toContain('Rml_SetResourcePath');
    expect(output).toContain('Rml_RegisterResourceProvider');

    // Render loop functions
    expect(output).toContain('RmlUI_ProcessSdlEvents');
    expect(output).toContain('RmlUI_Update');
    expect(output).toContain('RmlUI_Render');
    expect(output).toContain('RmlUI_Shutdown');
    expect(output).toContain('RmlUI_IsRunning');
  });

  it('renders W10: elements survive removeChild (no erase)', () => {
    const ctx = minimalContext({
      rmlui: {
        enabled: true,
        window: { title: 'Test', width: 1024, height: 768, resizable: false },
        debugger: false,
        resources: { searchPaths: [] },
      },
    });
    const output = renderTemplate(ctx, RMLUI_TEMPLATE_DIR);

    // AppendChild should NOT contain _rmluiElements.erase
    expect(output).toContain('Rml_AppendChild');
    expect(output).not.toMatch(/Rml_AppendChild[\s\S]{0,600}?_rmluiElements.erase/);

    // InsertBefore should NOT contain _rmluiElements.erase
    expect(output).toContain('Rml_InsertBefore');
    expect(output).not.toMatch(/Rml_InsertBefore[\s\S]{0,600}?_rmluiElements.erase/);

    // ReplaceChild should NOT contain _rmluiElements.erase
    expect(output).toContain('Rml_ReplaceChild');
    expect(output).not.toMatch(/Rml_ReplaceChild[\s\S]{0,600}?_rmluiElements.erase/);
  });

  it('renders S3: embedded resources template when rmlui is enabled', () => {
    const ctx = minimalContext({
      rmlui: {
        enabled: true,
        window: { title: 'Test', width: 1024, height: 768, resizable: false },
        debugger: false,
        resources: { searchPaths: [] },
      },
    });
    const output = renderTemplate(ctx, RMLUI_TEMPLATE_DIR);

    // Embedded resources section (accessor always present)
    expect(output).toContain('Rml_GetEmbeddedResource');
    expect(output).toContain('Embedded resource accessor');
  });

  it('renders W4: reentrancy guard in event dispatch', () => {
    const ctx = minimalContext({
      rmlui: {
        enabled: true,
        window: { title: 'Test', width: 1024, height: 768, resizable: false },
        debugger: false,
        resources: { searchPaths: [] },
      },
    });
    const output = renderTemplate(ctx, RMLUI_TEMPLATE_DIR);

    // Reentrancy guard
    expect(output).toContain('_rmluiInEventDispatch');
    expect(output).toContain('if (_rmluiInEventDispatch) return;');

    // Thread-local event
    expect(output).toContain('thread_local Rml_Event _rmluiCurrentEvent');
    expect(output).toContain('_rmluiEventDispatch');
  });
});
