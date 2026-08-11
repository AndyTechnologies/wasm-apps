# Design: RmlUI Plugin — DOM-style Native UI for WebAssembly Apps

## Technical Approach

Plugin + Custom Template (Approach B from exploration). The `rmlui-plugin` registers as a built-in `WasmPlugin`, hooks `BeforeCodeGen` to swap the Nunjucks template directory, registers RmlUI DOM functions as host functions, and modifies CMake generation to link SDL3/RmlUI/GLAD. The specs (dom-api, render-loop, event-system, multi-language, resource-loader) are already written under `openspec/specs/` — this design implements them.

```
wapp.json ──→ plugin-loader.ts ──→ rmlui-plugin.ts
                                        │
                          ┌─────────────┼──────────────┐
                          ▼             ▼              ▼
                 template-rmlui/   hostFunction     compiler.ts
                 (Nunjucks)        Registry         (extraLibs)
                          │             │              │
                          ▼             ▼              ▼
                 main.cpp with      Rml_Create*     CMakeLists.txt
                 SDL3/RmlUI loop    host funcs      + SDL3/RmlUI
```

## Architecture Decisions

| Option                                                | Tradeoff                                                                      | Decision                                                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Built-in vs external plugin                           | External needs path resolution, built-in is simpler for core feature          | Built-in — switch on id in `plugin-loader.ts`                                                            |
| Custom template vs conditional in main.c.njk          | Conditional inflates vanilla template, custom dir is clean isolation          | Custom `templates-rmlui/` dir — `renderTemplate()` already supports `templatePath`                       |
| Static vs dynamic linking of SDL3/RmlUI               | Static = bigger binary, no runtime deps; dynamic = smaller but needs .dll/.so | Static — consistent with Wasmtime approach, one self-contained binary                                    |
| Option A (host controls loop) vs B (plugin owns loop) | A = composable, B = simpler                                                   | A — host calls `RmlUI_Update()`/`RmlUI_Render()` each frame                                              |
| Custom codegen vs reusing `generateCCode()`           | Custom codegen would need new strategy class                                  | Reuse `generateCCode()` → add `templatePath` parameter → `WasmtimeLinkerStrategy` already passes options |

## Data Flow

```
┌──────────────────────────────────────────────────────────┐
│  main.cpp (generated from templates-rmlui/)              │
│                                                          │
│  SDL_Init → CreateWindow → GLContext → gladLoadGL        │
│       → Rml::Initialise → Rml::CreateContext             │
│                                                          │
│  while (running) {                                       │
│    RmlUI_ProcessSdlEvents()  ← SDL_PollEvent loop        │
│    WASM_ProcessModuleCalls() ← entry_func(context)       │
│    RmlUI_Update()            ← context->Update()         │
│    RmlUI_Render()            ← context->Render() + swap  │
│  }                                                        │
│                                                          │
│  RmlUI_Shutdown() → reverse init order                   │
└──────────────────────────────────────────────────────────┘
```

WASM imports `env.Rml_*` → host function trampolines → C ABI stubs → RmlUI C++ API.

## File Changes

| File                                                      | Action | Description                                                                     |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `packages/linker/src/rmlui-plugin.ts`                     | Create | Plugin class: registers host functions, hooks BeforeCodeGen for template path   |
| `packages/linker/src/plugin-loader.ts`                    | Modify | Add `rmlui-plugin` case to built-in switch                                      |
| `packages/linker/src/compiler.ts`                         | Modify | Add `generateCMakeLists(extraLibs)` overload + `ExtraLib` type                  |
| `packages/linker/src/codegen.ts`                          | Modify | `generateCCode()` accepts optional `templatePath`, passes to `renderTemplate()` |
| `packages/linker/src/wasmtime-linker-strategy.ts`         | Modify | Pass `templatePath` from options to `generateCCode()`                           |
| `packages/linker/src/native-app-builder.ts`               | Modify | Wire `templateDir` through build pipeline when plugin sets it                   |
| `packages/linker/templates-rmlui/`                        | New    | 5 Nunjucks templates for RmlUI lifecycle                                        |
| `packages/linker/templates-rmlui/main.c.njk`              | New    | Entry template: includes all partials in correct order                          |
| `packages/linker/templates-rmlui/_rmlui-setup.c.njk`      | New    | SDL_Init → window → context → RmlUI init                                        |
| `packages/linker/templates-rmlui/_rmlui-event-loop.c.njk` | New    | SDL_PollEvent → RmlUI::InputEventHandler                                        |
| `packages/linker/templates-rmlui/_rmlui-render.c.njk`     | New    | GL clear → context->Render → swap                                               |
| `packages/linker/templates-rmlui/_rmlui-cleanup.c.njk`    | New    | Reverse-init shutdown sequence                                                  |
| `packages/linker/src/rmlui-dl.ts`                         | Create | Platform-aware download manifest for SDL3/RmlUI/GLAD                            |
| `packages/linker/src/rmlui-setup.ts`                      | Create | Download + extract orchestration for RmlUI deps                                 |
| `packages/types/src/rmlui-abi.h`                          | Create | C ABI: opaque handles, extern "C" functions, error enum                         |
| `packages/types/src/rmlui.hh`                             | Create | C++ RAII wrappers over C ABI                                                    |
| `packages/types/src/index.ts`                             | Modify | Add `RmluiPluginConfig` type, `ExtraLib` type                                   |
| `packages/linker/src/setup.ts`                            | Modify | Wire `setupRmlui()` into `runSetup()`                                           |
| `scripts/rmlui-bindgen/`                                  | New    | Auto-generate Rust extern "C" + AS imports from `rmlui-abi.h`                   |

## Template Architecture

### templates-rmlui/main.c.njk

Entry point. Includes preamble, sets up SDL + RmlUI, runs loop with event pump/update/render, cleans up. Context: `rmlui.enabled: true`, `rmlui.window_config`, host functions already defined.

**Nunjucks context variables:**

```json
{
  "rmlui": {
    "enabled": true,
    "window": { "title": "My App", "width": 1024, "height": 768, "resizable": true },
    "debugger": false,
    "resources": { "searchPaths": ["./ui"] }
  }
}
```

### Partial templates

| Template                  | Context          | What it generates                                                                                                                                    |
| ------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_rmlui-setup.c.njk`      | `rmlui.window.*` | `SDL_Init` → `SDL_CreateWindow` → `SDL_GL_CreateContext` → `gladLoadGL` → `Rml::Initialise` → `Rml::CreateContext`                                   |
| `_rmlui-event-loop.c.njk` | `rmlui.enabled`  | `while (SDL_PollEvent(&e))` with switch mapping SDL3 events → `Rml::Input::*` / `context->SetDimensions`. Sets `running = false` on `SDL_EVENT_QUIT` |
| `_rmlui-render.c.njk`     | `rmlui.window.*` | `SDL_GL_MakeCurrent` → `glDisable(DEPTH_TEST)` → `glClear` → `context->Render()` → `SDL_GL_SwapWindow`                                               |
| `_rmlui-cleanup.c.njk`    | `rmlui.enabled`  | Guarded null-safe cleanup: `context->RemoveReference` → `Rml::Shutdown` → `SDL_GL_DeleteContext` → `SDL_DestroyWindow` → `SDL_Quit`                  |

**Sequence in main.c.njk:**

```
{% if rmlui.enabled %}
  {% include "_rmlui-setup.c.njk" %}
{% endif %}
  [WASM module setup — reused from vanilla template]
{% if rmlui.enabled %}
  while (running) {
    {% include "_rmlui-event-loop.c.njk" %}
    [WASM entry call via wasmtime::Func::call]
    {% include "_rmlui-render.c.njk" %}
  }
  {% include "_rmlui-cleanup.c.njk" %}
{% else %}
  [vanilla WASM call]
{% endif %}
```

## CMake Integration

New function in `compiler.ts`:

```ts
export interface ExtraLib {
  name: string;
  includeDir: string;
  libDir: string;
  libs: string[]; // e.g. ['SDL3', 'RmlUi', 'glad']
  frameworks?: string[]; // macOS only: ['Cocoa', 'IOKit', 'CoreFoundation']
}

export function generateCMakeLists(wasmtimePath?: string, extraLibs?: ExtraLib[]): string {
  /* ... */
}
```

Changes to generated CMakeLists.txt:

- `include_directories(...)` appends each `extraLib.includeDir`
- `link_directories(...)` appends each `extraLib.libDir`
- `target_link_libraries(...)` appends each `extraLib.libs` as `-l<lib>` (Unix) or `<lib>.lib` (Windows/macOS)
- macOS: extra `target_link_libraries(... ${frameworks})` with `-framework` flag

## Download System

**File**: `packages/linker/src/rmlui-dl.ts` (mirrors `wasmtime-dl.ts` pattern)

```ts
interface RmluiAsset {
  sdl: { url: string; fileName: string; sha256: string };
  rmlui: { url: string; fileName: string; sha256: string };
  glad: { url: string; fileName: string; sha256: string };
}
```

- Platform mapping: same triple logic as `getWasmtimeTarget()`
- Version pinned in manifest: `SDL3-3.2.0`, `RmlUI-6.0`, `glad-2.0.6`
- Extraction to `~/.wasm-linker/rmlui/{sdl,rmlui,glad}/`
- **File**: `packages/linker/src/rmlui-setup.ts` — `setupRmlui()` downloads + extracts all three
- Manifest hash verification via existing `downloadFile(expectedHash)`

## C ABI (rmlui-abi.h)

```c
typedef int32_t Rml_ContextId;
typedef int32_t Rml_ElementId;
typedef int32_t Rml_DocumentId;

typedef enum {
  RMLUI_OK = 0,
  RMLUI_ERR_INVALID_HANDLE = -1,
  RMLUI_ERR_NULL_PARAM = -2,
  RMLUI_ERR_OUT_OF_MEMORY = -3,
  RMLUI_ERR_UNSUPPORTED = -4,
  RMLUI_ERR_INTERNAL = -5,
} Rml_Error;

extern "C" {
  // Context lifecycle
  Rml_ContextId Rml_CreateContext(const char* name, int w, int h);
  void Rml_ReleaseContext(Rml_ContextId ctx);

  // Document loading
  Rml_DocumentId Rml_LoadDocument(Rml_ContextId ctx, const char* path);
  Rml_DocumentId Rml_LoadDocumentFromString(Rml_ContextId ctx, const char* rml);
  void Rml_ShowDocument(Rml_DocumentId doc);

  // Element tree (see dom-api spec)
  Rml_ElementId Rml_CreateElement(const char* tag);
  int32_t Rml_AppendChild(Rml_ElementId parent, Rml_ElementId child);
  int32_t Rml_SetAttribute(Rml_ElementId el, const char* name, const char* value);
  const char* Rml_GetAttribute(Rml_ElementId el, const char* name);
  int32_t Rml_AddEventListener(Rml_ElementId el, const char* event, int32_t cb_id);

  // Rendering loop
  void RmlUI_ProcessSdlEvents();
  void RmlUI_Update();
  void RmlUI_Render();
  void RmlUI_Shutdown();

  // Font / resource (see resource-loader spec)
  int32_t Rml_LoadFont(const char* path);
  int32_t Rml_LoadFontFromBuffer(const char* name, const void* data, int32_t len);
}
```

## Event Bridge

```
SDL_PollEvent → switch(event.type):
  SDL_EVENT_QUIT           → running = false
  SDL_EVENT_MOUSE_MOTION   → Rml::Input::MouseMove(x, y)
  SDL_EVENT_MOUSE_DOWN     → Rml::Input::MouseButtonDown(btn)
  SDL_EVENT_MOUSE_UP       → Rml::Input::MouseButtonUp(btn)
  SDL_EVENT_KEY_DOWN       → Rml::Input::KeyDown(mod)
  SDL_EVENT_TEXT_INPUT     → Rml::Input::TextInput(c)
  SDL_EVENT_WINDOW_RESIZED → context->SetDimensions(w, h)
```

DOM callbacks: C++ `unordered_map<pair<element_id, string>, int32_t>` stores `(elem, event_type) → callback_id`. When RmlUI fires, the bridge calls the registered wasmtime::Func by callback_id.

## Plugin Implementation

```ts
// packages/linker/src/rmlui-plugin.ts
import { PipelinePhase, type PluginContext, type WasmPlugin } from '@wasm-apps/types';

const rmluiPlugin: WasmPlugin = {
  id: 'rmlui-plugin',
  register(ctx: PluginContext): void {
    // 1. Register host functions (DOM API) in 'env' module
    ctx.hostFunctions.register('env', 'Rml_CreateElement', (p, r) => `...`);
    ctx.hostFunctions.register('env', 'Rml_AppendChild', (p, r) => `...`);
    // ... all Rml_* functions

    // 2. Hook BeforeCodeGen to set template path for RmlUI lifecycle
    ctx.pipeline.register(PipelinePhase.BeforeCodeGen, this.id, (pipelineCtx) => {
      // Set config flag so codegen knows to use templates-rmlui/
      pipelineCtx.cppCode = ''; // marker — actual template swap via NativeAppBuilder.templateDir
    });
  },
};
export default rmluiPlugin;
```

The actual template path switch happens in `NativeAppBuilder` — when `rmlui-plugin` is enabled and active, `builder.setTemplateDir('templates-rmlui')` is called before `build()`.

## Binding Layers

| Language | Layer                 | Mechanism                                                               |
| -------- | --------------------- | ----------------------------------------------------------------------- |
| C++      | `rmlui.hh`            | RAII wrappers calling `extern "C"` `Rml_*` functions                    |
| Rust     | `rmlui-sys` + `rmlui` | `#[link(name = "RmlUI_ABI")]` + safe `Result<T, RmlError>` wrappers     |
| AS       | `rmlui.ts`            | `@external("env", "Rml_*")` host function declarations + Document class |

## Config Schema

```json
{
  "plugins": [
    {
      "id": "rmlui-plugin",
      "enabled": true,
      "config": {
        "window": { "title": "My App", "width": 1024, "height": 768, "resizable": true },
        "debugger": false,
        "resources": { "searchPaths": ["./ui"], "defaultFont": "./assets/NotoSans-Regular.ttf" },
        "embedResources": ["NotoSans-Regular.ttf"]
      }
    }
  ]
}
```

TypeScript type:

```ts
interface RmluiPluginConfig {
  window: { title: string; width: number; height: number; resizable: boolean };
  debugger: boolean;
  resources: { searchPaths: string[]; defaultFont?: string };
  embedResources: string[];
}
```

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. SDL3/RmlUI are statically linked C++ libraries exposed via C ABI; all interaction is memory-safe FFI within the same process.

## Migration / Rollout

No migration required. New feature — existing `wapp.json` files without `rmlui-plugin` produce identical binaries. Rollback: remove the plugin config entry.

## Open Questions

- [ ] Exact download URLs for pre-built SDL3/RmlUI/GLAD static libs per platform — need to decide on a distribution source (GitHub releases vs vcpkg vs custom CI)
- [ ] Glad loader source: embed `glad.c` in templates or link pre-built? Recommendation: embed in `_rmlui-setup.c.njk` as inline OpenGL 3.3 loader
- [ ] Font embedding: should `embedResources` be a list of paths, or auto-detect fonts in search paths?
- [ ] `rmlui-bindgen` script: shell script, JS script, or Nunjucks template? Recommendation: JS using `@wasm-apps/types` to parse the C header
