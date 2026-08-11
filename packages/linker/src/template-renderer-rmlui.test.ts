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
    expect(output).toContain('Rml::LoadFontFace');
    expect(output).toContain('LatoLatin-Regular.ttf'); // default font fallback

    // RmlUi 6.2: Debugger::Initialise() sin contexto PROHIBIDO.
    // El debugger se inicializa con contexto vía Rml_DebuggerInitialise(ctx).
    expect(output).not.toMatch(/Debugger::Initialise\s*\(\)/);

    // RmlUi 6.2 backends + vendored GL loader (sin GLAD externo)
    expect(output).toContain('RmlUi/Backends/RmlUi_Platform_SDL.h');
    expect(output).toContain('RmlUi/Backends/RmlUi_Renderer_GL3.h');
    expect(output).toContain('vendor/RmlUi_Include_GL3.h');
    expect(output).not.toContain('<glad/gl.h>');
    expect(output).not.toContain('RmlUi_GL3/');
    expect(output).not.toContain('RmlUi_SDL/');

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

    expect(output).not.toMatch(/Debugger::Initialise\s*\(\)/);
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

    // C ABI implementations — post-RmlUi-6.2 symbols
    expect(output).toContain('Rml_CreateContext');
    expect(output).toContain('Rml_ReleaseContext');
    expect(output).toContain('Rml_LoadDocument');
    expect(output).toContain('Rml_LoadDocumentFromMemory');
    expect(output).toContain('Rml_GetNumDocuments');
    expect(output).toContain('Rml_GetDocument');
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
    expect(output).toContain('Rml_SetClass');
    expect(output).toContain('Rml_IsClassSet');
    expect(output).toContain('Rml_SetClassNames');
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

    // RmlUi 6.2: body/head via tag traversal (ElementDocument::GetBody/GetHead
    // fueron eliminados en 6.2) — helper _rmluiFindByTag
    expect(output).toContain('_rmluiFindByTag');
    expect(output).not.toMatch(/->GetBody\(\)/);
    expect(output).not.toMatch(/->GetHead\(\)/);

    // RmlUi 6.2 backends: clases global scope + helpers namespaced
    expect(output).toContain('RmlSDL::ConvertKey');
    expect(output).toContain('SystemInterface_SDL');
    expect(output).toContain('RenderInterface_GL3');

    // Render loop functions
    expect(output).toContain('RmlUI_ProcessSdlEvents');
    expect(output).toContain('RmlUI_Update');
    expect(output).toContain('RmlUI_Render');
    expect(output).toContain('RmlUI_Shutdown');
    expect(output).toContain('RmlUI_IsRunning');
  });

  it('does NOT render legacy RmlUi 5.x symbols', () => {
    const ctx = minimalContext({
      rmlui: {
        enabled: true,
        window: { title: 'Test', width: 1024, height: 768, resizable: false },
        debugger: false,
        resources: { searchPaths: [] },
      },
    });
    const output = renderTemplate(ctx, RMLUI_TEMPLATE_DIR);

    // RmlUi 6.2 removed LoadDocumentFromString (renamed to
    // LoadDocumentFromMemory) and the class_list API (replaced by
    // SetClass/IsClassSet/SetClassNames).
    expect(output).not.toContain('Rml_LoadDocumentFromString');
    expect(output).not.toContain('class_list');
    expect(output).not.toContain('Rml_AddClass');
    expect(output).not.toContain('Rml_RemoveClass');
    expect(output).not.toContain('Rml_ToggleClass');
    expect(output).not.toContain('Rml_HasClass');
    expect(output).not.toContain('rmlui_cast');

    // RmlUi 6.2 backends: old prefixed class names are gone
    expect(output).not.toContain('RmlSDL_SystemInterface_SDL');
    expect(output).not.toContain('RmlGL3_RenderInterface_GL3');
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

describe('Spec2 S-001..S-008 — scenario tests DOM (T-028)', () => {
  const ctx = minimalContext({
    rmlui: {
      enabled: true,
      window: { title: 'Test', width: 1024, height: 768, resizable: false },
      debugger: false,
      resources: { searchPaths: [] },
    },
  });
  const output = renderTemplate(ctx, RMLUI_TEMPLATE_DIR);

  it('S-001: body/head con doctype — traversal por TAG, no primer hijo', () => {
    // GetBody/GetHead DEBEN recorrer hijos directos comparando tag names.
    // El helper _rmluiFindByTag aparece ANTES de Rml_GetBody/Rml_GetHead.
    expect(output).toMatch(/_rmluiFindByTag\(Rml::ElementDocument\* doc, const char\* tag\) \{[\s\S]{0,400}?Rml_GetBody[\s\S]{0,400}?"body"/);
    expect(output).toMatch(/_rmluiFindByTag\([\s\S]{0,80}?,\s*"head"\)/);
    // El helper itera GetFirstChild→GetNextSibling comparando GetTagName().
    expect(output).toMatch(/for \(Rml::Element\* child = doc->GetFirstChild\(\); child; child = child->GetNextSibling\(\)\)/);
    expect(output).toMatch(/child->GetTagName\(\) == tag/);
    // GetBody/GetHead NO toman el primer hijo a ciegas: delegan en el helper.
    expect(output).not.toMatch(/GetDocuments\(\)\[0\]->GetFirstChild\(\)/);
  });

  it('S-002: sin body/head → 0 (ensureId con nullptr)', () => {
    // _rmluiEnsureId(nullptr) → 0; GetBody devuelve 0 si no encuentra.
    expect(output).toMatch(/static Rml_ElementId _rmluiEnsureId\(Rml::Element\* el\) \{[\s\S]*?if \(!el\) return 0;/);
    expect(output).toMatch(/return _rmluiEnsureId\(body\); \/\/ no body → 0/);
    expect(output).toMatch(/return _rmluiEnsureId\(head\); \/\/ no head → 0/);
    // RmlUi 6.2: enumeración index-based (GetNumDocuments/GetDocument), sin GetDocuments().
    expect(output).toMatch(/if \(cit->second->GetNumDocuments\(\) < 1\) return 0;/);
    expect(output).toMatch(/GetDocument\(0\)/);
  });

  it('S-003: append tras remove — RemoveChild devuelve ownership (release)', () => {
    // RemoveChild usa .release() → el elemento sobrevive y puede re-appendearse.
    expect(output).toMatch(/RemoveChild\(cit->second\)\.release\(\);/);
    expect(output).toMatch(/\/\/ \.release\(\): element stays alive \(caller-owned\), re-append stays valid/);
  });

  it('S-004: failed append mantiene child (parent inválido / ya attached)', () => {
    // Pre-check GetParentNode ANTES de mover ownership → -1 y child intacto.
    expect(output).toMatch(/if \(cit->second->GetParentNode\(\)\)\s*return RMLUI_ERR_INVALID_HANDLE;/);
    // El Rml::ElementPtr owned() se crea DESPUÉS del pre-check.
    const append = output.slice(output.indexOf('Rml_AppendChild'));
    const preCheck = append.indexOf('GetParentNode()');
    const ownedCtor = append.indexOf('Rml::ElementPtr owned');
    expect(preCheck).toBeGreaterThan(-1);
    expect(ownedCtor).toBeGreaterThan(preCheck);
  });

  it('S-005: missing vs empty attr — NULL vs buffer no-null con ""', () => {
    // Missing → nullptr; presente (incl. "") → copiado a _rmluiAttrBuf, nunca null.
    expect(output).toMatch(/const Rml::Variant\* val = it->second->GetAttribute\(name\);/);
    expect(output).toMatch(/if \(!val\) return nullptr;/);
    expect(output).toMatch(/strncpy\(_rmluiAttrBuf, attr\.c_str\(\), sizeof\(_rmluiAttrBuf\) - 1\);/);
    expect(output).toMatch(/return _rmluiAttrBuf;/);
  });

  it('S-006: toggle — SetClass(el, cls, !IsClassSet) sin API class-list', () => {
    expect(output).toMatch(/SetClass\(cls, enabled != 0\);/);
    expect(output).toContain('Toggle = SetClass(el, cls, !IsClassSet(el, cls)).');
    expect(output).not.toContain('Rml_ToggleClass');
  });

  it('S-007: QuerySelectorAll — lista null-terminada copiada a WASM, FreeNodeList no-op', () => {
    // El helper devuelve un vector<int32_t> (nunca un puntero nativo al WASM).
    expect(output).toMatch(/std::vector<int32_t> _rmluiQuerySelectorAllIds\(Rml_ElementId el, const char\* selector\)/);
    expect(output).toMatch(/ids\.push_back\(0\); \/\/ null-terminated/);
    // _writeI32List copia la lista a memoria WASM vía __new.
    expect(output).toMatch(/int32_t _writeI32List\(Caller& caller, const std::vector<int32_t>& ids\)/);
    expect(output).toMatch(/memcpy\(_data \+ _ptr, ids\.data\(\), allocSz\);/);
    expect(output).toMatch(/Rml_FreeNodeList\(const int32_t\* elements\)[\s\S]{0,200}?Nothing to free natively/);
    expect(output).toContain('(void)elements;');
  });

  it('S-008: "Héllo 世界" round-trip — CreateTextNode/SetTextContent sin transformar bytes', () => {
    // RmlUi 6.2: #text vía Factory::InstanceElement + ElementText::SetText;
    // SetTextContent reemplaza hijos con Factory::InstanceElementText.
    expect(output).toMatch(/InstanceElement\(nullptr, "#text", "text", attrs\)/);
    expect(output).toMatch(/textEl->SetText\(text\);/);
    expect(output).toMatch(/InstanceElementText\(it->second, text\);/);
    expect(output).not.toMatch(/wchar_t|std::wstring|utf8_/);
  });
});

describe('Spec4/5 — debugger init order + document enumeration (T-029)', () => {
  const ctx = minimalContext({
    rmlui: {
      enabled: true,
      window: { title: 'Test', width: 1024, height: 768, resizable: false },
      debugger: true,
      resources: { searchPaths: [] },
    },
  });
  const output = renderTemplate(ctx, RMLUI_TEMPLATE_DIR);

  it('S-001: Debugger::Initialise(debugCtx) tras CreateContext (paso 9), nunca sin contexto', () => {
    // Orden: CreateContext (paso 8) → Debugger::Initialise(debugCtx) dentro del if.
    const ctxIdx = output.indexOf('Rml::CreateContext("main"');
    const initIdx = output.indexOf('Rml::Debugger::Initialise(debugCtx)');
    expect(ctxIdx).toBeGreaterThan(-1);
    expect(initIdx).toBeGreaterThan(ctxIdx);
    // El Initialise sin argumento no debe existir en el código generado.
    expect(output).not.toMatch(/Debugger::Initialise\s*\(\s*\)\s*;/);
  });

  it('S-002: CreateContext failure → debugger nunca se inicializa (null-guard)', () => {
    expect(output).toMatch(/if \(Rml::Context\* debugCtx = Rml::CreateContext\(/);
    expect(output).toMatch(/} else \{[\s\S]{0,200}?CreateContext falló: debugger nunca se inicializa/);
  });

  it('S-003: toggle funciona — Rml_DebuggerToggle usa SetVisible(!IsVisible())', () => {
    expect(output).toMatch(/Rml::Debugger::SetVisible\(!Rml::Debugger::IsVisible\(\)\)/);
  });

  it('Spec5 S-001: load-from-memory usa URL por defecto "[document from memory]"', () => {
    expect(output).toMatch(/source_url \? source_url : "\[document from memory\]"/);
  });

  it('Spec5 S-002: enumerate 2 docs por índice + out-of-range → 0', () => {
    expect(output).toContain('it->second->GetNumDocuments()');
    expect(output).toMatch(/if \(index < 0 \|\| index >= \(int32_t\)it->second->GetNumDocuments\(\)\) return 0;/);
    expect(output).toMatch(/it->second->GetDocument\(index\)/);
    expect(output).not.toContain('GetDocument(name');
  });
});
