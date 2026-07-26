# RmlUI Plugin — Verification Report

## Summary

| Check | Result |
|-------|--------|
| **Build** | ✅ Pass — `pnpm -r build` completes cleanly |
| **Tests** | ✅ Pass — 37 files, 357 tests pass |
| **rmlui-dom-api** | ❌ FAIL — Critical gaps |
| **rmlui-render-loop** | ❌ FAIL — Critical pipeline gap |
| **rmlui-multi-language** | ⚠️ WARNING — Minor gaps |
| **rmlui-event-system** | ⚠️ WARNING — Event object not serialized |
| **rmlui-resource-loader** | ❌ FAIL — Missing functions |
| **Configuration** | ⚠️ WARNING — Partially implemented |

---

## CRITICAL Issues

### C1 — `rmlui` context never populated in template (BLOCKING)

**Where**: `packages/linker/src/codegen.ts` · `buildTemplateContext()` (line 136)

The `NunjucksTemplateContext` interface defines an optional `rmlui` field, but **no code populates it**. The `buildTemplateContext()` function constructs the rendering context from `ResolvedLink` data alone. There is no pipeline stage, hook, or adapter that injects the `rmlui` config into the template context.

**Impact**: Every `main.c.njk` template contains `{% if rmlui.enabled %}` which evaluates to `false`/`undefined`. The entire RmlUI initialization block (SDL3, GLAD, RmlUI init, font loading), the interactive event loop (`while (_rmluiRunning)`), and the shutdown sequence are **silently omitted** from generated C++. The generated binary falls through to the non-rmlui path (single `entry_func.call()` then exit).

**Spec refs**: Render-loop spec Requirement: Initialization Sequence, Main Loop Integration. All init/loop/render/shutdown features are inoperative.

**Fix required**: `buildTemplateContext()` must accept `RmluiPluginConfig` (from active pipeline state or `rmlui-plugin.ts`'s `activeConfig`), construct the `rmlui` sub-object, and include it in the returned `NunjucksTemplateContext`.

### C2 — Missing ABI functions from specs

The following functions are spec'd but **not present in `rmlui-abi.h`**:

| Spec | Missing Function | Source |
|------|-----------------|--------|
| dom-api | `Rml_QuerySelectorAll(ctx, selector) → i32*` | dom-api spec §Query Methods |
| dom-api | `Rml_FreeNodeList(array)` | dom-api spec §Query Methods |
| resource-loader | `Rml_LoadDocumentFromBuffer(ctx, data, len) → i32` | resource-loader spec §RML Document Loading |
| resource-loader | `Rml_GetTextureDimensions(name) → {w, h}` | resource-loader spec §Image/Texture Loading |
| resource-loader | `Rml_SetResourcePath(ctx, path_list)` | resource-loader spec §Search Path Configuration |
| resource-loader | `Rml_ResourceProvider` struct | resource-loader spec §Custom Resource Provider Interface |
| resource-loader | `Rml_RegisterResourceProvider(provider)` | resource-loader spec §Custom Resource Provider Interface |
| resource-loader | Embedded resource template (`_embedded-resources.c.njk`) | resource-loader spec §Embedded Resource Format |

**Severity**: 6 missing function signatures, 1 missing struct type, 1 missing template.

### C3 — Event object serialization not implemented

**Where**: `packages/linker/templates-rmlui/_rmlui-state.c.njk` :: `_rmluiEventDispatch` (line 338)

**Spec requirement**: Event-system spec §Event Object Serialization — the bridge MUST populate a C `Rml_Event` struct with `target`, `type`, `mouse_screen_x/y`, `key_code`, `modifiers`, `prevent_default`, `stop_propagation`, and touch-reserved fields. WASM callbacks must be able to read these and set `prevent_default`/`stop_propagation`.

**Implementation**: The `BridgeListener::ProcessEvent()` creates a synthetic `Rml::Event("__bridge__", 0, Rml::Dictionary(), true, 0)` with no real data. The callback receives no event context, cannot inspect mouse/key state, and cannot prevent default actions.

**Impact**: WASM event callbacks are functionally blind — they know an event fired but nothing about it. The `prevent_default`/`stop_propagation` contract is entirely unimplemented.

---

## WARNING Issues

### W1 — Class list naming mismatch

| Spec Name | Implementation Name |
|-----------|-------------------|
| `Rml_ClassListAdd` | `Rml_AddClass` |
| `Rml_ClassListRemove` | `Rml_RemoveClass` |
| `Rml_ClassListToggle` | `Rml_ToggleClass` |
| `Rml_ClassListContains` | `Rml_HasClass` |

The spec's DOM API uses a `Rml_ClassList*` prefix; the implementation uses a shorter `Rml_*Class` naming. Both bindings (Rust, AS, C++) follow the implementation naming. The bindgen generates from the header, so generated code matches the implementation. **Spec vs code inconsistency only** — fix the spec or rename the functions.

### W2 — `Rml_CreateDocument` vs `Rml_CreateContext`

The dom-api spec lists `Rml_CreateDocument() → i32 (context_id)` — "Create empty document with `<body>` root". The implementation uses `Rml_CreateContext(name, w, h)` which creates an RmlUI context (container for documents), not a document. The naming and behavior are different. The implementation's approach is architecturally correct (RmlUI separates contexts and documents), but the spec needs updating.

### W3 — Init sequence incomplete in template

**Issue**: The spec (render-loop §Initialization Sequence) requires `SDL_GL_MakeCurrent(window, context)` in step 5 of init. The template's init block in `main.c.njk` (line 54–82) does NOT call `MakeCurrent` — it only sets GL attributes, creates window and context, then proceeds to gladLoadGL and RmlUI init. The `RmlUI_Render()` function does call `MakeCurrent` before each frame, but the spec requires it during init as well.

**Impact**: On some GL implementations, operations after context creation (gladLoadGL, RmlUI init) may fail without a current context.

### W4 — Reentrancy guard for event dispatch not implemented

**Spec**: Event-system spec §Callback Invocation Contract — "if a callback modifies the DOM, re-entrant event dispatch MUST be deferred to the next frame."

**Implementation**: No reentrancy guard exists. Callbacks fire synchronously within `RmlUI_ProcessSdlEvents`. DOM mutations during callbacks could trigger nested RmlUI events within the same poll cycle.

### W5 — `RmlUI_Update()` semantics differ from spec

**Spec**: `RmlUI_Update()` is called once per frame after the SDL event pump and before `WASM_ProcessModuleCalls()`. Separate from `RmlUI_ProcessSdlEvents()`.

**Implementation**: `RmlUI_ProcessSdlEvents()` polls events AND calls `context->Update()` at the end (line 468–470 in `_rmlui-state.c.njk`). The WASM entry function is called between ProcessSdlEvents and Render (in `main.c.njk` line 117). This means `context->Update()` runs before the WASM callback in the same frame, not after it. The spec's separation is conceptually cleaner but the implementation bundles them.

### W6 — No `RmlStyle` RAII class in C++ wrappers

**Spec**: Multi-language spec §C++ Wrapper Header — requires a separate `RmlStyle` class with `operator[]` for get/set and `apply(css_text)`.

**Implementation**: Style methods are directly on `RmlElement` (`setStyleProperty`, `getStyleProperty`, `setStyle`). No separate `RmlStyle` class. Functionally equivalent but deviates from spec.

### W7 — No `Document` class with browser DOM API in AS

**Spec**: Multi-language spec §AssemblyScript Type Definitions — requires a `Document` class with `createElement()`, `getElementById()`, `.body` property.

**Implementation**: Only raw `@external` imports and flat wrapper functions exist in `rmlui-bindings.ts`. No class hierarchy.

### W8 — Default font not configurable

**Spec**: Resource-loader spec §Font Loading — default font path SHALL be configurable via `wapp.json` `plugins[].config.defaultFont`.

**Implementation**: Font paths are hardcoded in all templates (`LatoLatin-Regular.ttf`, `LatoLatin-Bold.ttf`, `LatoLatin-Italic.ttf`, `NotoEmoji-Regular.ttf`). The `RmluiPluginConfig` interface has `resources.defaultFont` but it's never consumed.

### W9 — Texture loading functions are stubs

| Function | Implementation |
|----------|---------------|
| `Rml_LoadTexture` | Returns `RMLUI_OK` (no-op) — "Texture loading is handled by RmlUI's render interface automatically" |
| `Rml_LoadTextureFromBuffer` | Returns `RMLUI_ERR_UNSUPPORTED` |

These are marked as v1 placeholders. The spec calls for working texture loading.

### W10 — No re-append after remove in element lifecycle

**Spec**: dom-api spec §Element Lifecycle scenario "Remove then re-append" — the child MUST appear under a different parent (not destroyed, just moved).

**Implementation**: `Rml_AppendChild` calls `pit->second->AppendChild(cit->second)` then `_rmluiElements.erase(child)`. The spec requires the element to be movable without being destroyed. The implementation's `AppendChild` should not erase the child if it was previously removed (should keep it alive). Since `Rml_RemoveChild` calls `pit->second->RemoveChild(cit->second)` but does NOT erase the child from the element map, the child's ID remains valid. However, the RmlUI internal ownership model may have destroyed the child. The `AppendChild` implementation erases the child from the element map (assuming ownership transfer), which prevents re-append to a different parent.

---

## SUGGESTION Issues

### S1 — Placeholder download URLs

`rmlui-dl.ts` uses placeholder GitHub release URLs that don't exist yet. Noted in code comments as TBD. The setup handles failures gracefully with warnings.

### S2 — Rust crate structure incomplete

No `build.rs` or separate `rmlui-sys` package as specified by multi-language spec §Rust Crate Structure. The example `Cargo.toml` has no dependencies. Acceptable for v1.

### S3 — Embedded resource format not implemented

No `_embedded-resources.c.njk` template. The spec resource-loader §Embedded Resource Format describes embedding `< 1 MB` resources as `unsigned char` arrays.

### S4 — `Rml_QuerySelector` returns single element

The header only has `Rml_QuerySelector` (returns one element). The spec's `Rml_QuerySelectorAll` (returns array) is missing entirely. The ABI implementation for querySelector only returns the first match.

### S5 — Callbacks not invoked through WASM function table

The spec says callback_id is an index into a WASM-callable function table. The implementation stores `std::function<void()>` in C++, not a WASM function table index. The `BridgeListener` calls C++ lambdas, not WASM functions. For WASM-originated callbacks (registered from WASM code via `Rml_AddEventListener`), the callback ID would index into the C++ map, but the `Rml_AddEventListener` host function in `rmlui-plugin.ts` just passes the callback ID to the ABI layer — the actual callback invocation happens in native C++ code, not in WASM.

---

## Compliance Matrix

### rmlui-dom-api — 4 requirements

| Requirement | Functions | Status | Notes |
|-------------|-----------|--------|-------|
| Element Tree Construction | 7 specified, 6 in header | ❌ | Missing `Rml_CreateDocument` (renamed to `Rml_CreateContext`) |
| Attribute and Content Access | 8 specified, 8 in header | ✅ | All present |
| Style Object | 3 specified, 3 in header | ✅ | All present |
| Query Methods | 5 specified, 3 in header + 1 partial | ❌ | Missing `Rml_QuerySelectorAll`, `Rml_FreeNodeList` |

### rmlui-render-loop — 5 requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| Initialization Sequence | ❌ | `MakeCurrent` missing from init; context creation deferred to WASM |
| Window Configuration | ✅ | Config in `RmluiPluginConfig`, passed to template (but not consumed due to C1) |
| Update Function | ⚠️ | Bundled into ProcessSdlEvents instead of separate call |
| Render Function | ✅ | Correct steps with additional BeginFrame/EndFrame |
| Shutdown Sequence | ⚠️ | Null-guards present but Rml::Shutdown order differs from spec |

### rmlui-multi-language — 5 requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| C ABI Header | ✅ | 44 functions, extern "C", opaque handles, error codes |
| Error Propagation | ✅ | All 3 language bindings have error translation |
| C++ Wrapper Header | ⚠️ | No separate `RmlStyle` class |
| Rust Crate Structure | ⚠️ | No `build.rs` or `rmlui-sys` package |
| AssemblyScript Type Definitions | ⚠️ | No `Document` class; no browser-like DOM API |

### rmlui-event-system — 5 requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| SDL Event Pump Integration | ✅ | All 8 mappings implemented |
| DOM Callback Registration | ✅ | `Rml_AddEventListener`/`RemoveEventListener` exist |
| Callback Invocation Contract | ❌ | No reentrancy guard; callbacks fire synchronously |
| Event Object Serialization | ❌ | No `Rml_Event` struct populated |
| Future-Proof Touch/Gesture Events | ❌ | Touch fields not reserved |

### rmlui-resource-loader — 5 requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| RML Document Loading | ⚠️ | Missing `Rml_LoadDocumentFromBuffer` |
| Font Loading | ⚠️ | Default font not configurable |
| Image/Texture Loading | ❌ | Both functions are stubs; missing `Rml_GetTextureDimensions` |
| Custom Resource Provider Interface | ❌ | Missing entirely |
| Search Path Configuration | ❌ | Missing `Rml_SetResourcePath` |

---

## Build & Test Results

| Command | Exit Code | Result |
|---------|-----------|--------|
| `pnpm -r build` | 0 | ✅ All packages compile (types, compiler, linker, cli) |
| `pnpm test:unit` | 0 | ✅ 37 test files, 357 tests, all passing |

---

## Conclusion

**Status**: FAIL — fixes required before this change can be archived.

The primary blocker is **Critical issue C1** (rmlui context never populated in template context), which renders the entire RmlUI initialization, event loop, render pipeline, and shutdown path inoperative. Until this is fixed, none of the render-loop, event-system, or resource-loader features work in generated binaries.

Additionally, **8 spec'd ABI functions are missing from the header** (C2), and the **event object serialization contract is unimplemented** (C3).

**Next**: `fixes-required` — address C1, C2, and C3 before re-verification.
