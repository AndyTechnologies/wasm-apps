# Proposal: RmlUI Plugin — DOM-style native UI for WebAssembly apps

## Intent

Provide a built-in plugin making RmlUI + SDL3 + OpenGL 3 available to all three
language targets (C++, Rust, AssemblyScript) through a familiar DOM-style API.
Currently the toolchain produces console-only native executables — this change
enables native windows with UI elements coupled to WebAssembly logic.

## Scope

### In Scope
- Built-in `rmlui-plugin` hardcoded by id in `plugin-loader.ts`
- Nunjucks template dir `packages/linker/templates-rmlui/` with RmlUI lifecycle (init, update, render, cleanup)
- Modified `generateCMakeLists()` to link SDL3, RmlUI, GLAD, glm as static libs
- Download system for pre-built SDL3/RmlUI/GLAD (reuse `downloader.ts` pattern)
- DOM-style C ABI (`createElement`, `appendChild`, `addEventListener`, etc.)
- C++ headers wrapping C API; Rust crate via `extern "C"`; AssemblyScript type defs
- SDL3 event → RmlUI bridge + DOM `addEventListener` callbacks (main thread only)
- Resource loader: RML/font/image from files, strings, embedded data
- RmlUI Debugger activation function
- Config via `wapp.json` `plugins[].config` and dead-code elimination when disabled

### Out of Scope
- Custom RmlUI themes/skins or default app styling
- Multi-window or multi-monitor support
- Mobile (iOS/Android) or Web platform
- Hot-reload of RML documents at runtime

## Capabilities

### New Capabilities
- `rmlui-dom-api`: DOM-style API — createElement, appendChild, setAttribute, addEventListener, textContent, innerHTML, style, getElementById, querySelector
- `rmlui-render-loop`: SDL3 window/context creation, RmlUI render, Update()/Render() host-loop hooks
- `rmlui-multi-language`: C ABI (stable FFI), C++ wrappers, Rust crate (extern "C"), AS type defs
- `rmlui-event-system`: SDL3→RmlUI event bridge + DOM callbacks, main-thread dispatch
- `rmlui-resource-loader`: RML/font/image from files, strings, embedded data; extensible interface

### Modified Capabilities
None — wholly new feature. No existing specs change.

## Approach

Plugin + Custom Template (exploration Approach B):
1. Add `rmlui-plugin` to `DEFAULT_PLUGINS` and route its registration in `plugin-loader.ts` (switch on id, configure template path)
2. Create `packages/linker/templates-rmlui/` — full Nunjucks template set with RmlUI init, event pump, render, cleanup replacing vanilla main()
3. Modify `generateCMakeLists()` to accept `extraLibs` — SDL3, RmlUI, GLAD, glm as STATIC imports
4. Reuse `downloader.ts` for platform-aware pre-built deps
5. Plugin registers host functions via `ctx.hostFunctions` for DOM API execution
6. Event bridge: SDL3_PollEvent loop → `RmlUI::ProcessEvent` → DOM JS callbacks

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/linker/src/plugin-loader.ts` | Modified | Add rmlui-plugin as builtin |
| `packages/linker/templates-rmlui/` | New | RmlUI lifecycle Nunjucks templates |
| `packages/linker/src/generateCMakeLists.ts` | Modified | Accept extraLibs param |
| `packages/linker/src/downloader.ts` | Modified | RmlUI/SDL3/GLAD download manifest |
| `packages/linker/src/setup.ts` | Modified | Download RmlUI deps on setup |
| `packages/types/src/index.ts` | Modified | PluginConfig types for rmlui |
| `packages/types/src/rmlui-abi.h` | New | C ABI header for DOM API |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cross-platform SDL3/RmlUI static builds | Med | CI matrix + pre-built downloads |
| Binary size increase (~15-20MB) | High | Dead-code elimination when disabled |
| RmlUI API version drift | Low | Pin version in download manifest |

## Rollback Plan

Disable `rmlui-plugin` in wapp.json → linker falls back to default templates and default CMakeLists.txt. Zero effect on existing builds.

## Dependencies

- SDL3 (stable), RmlUI v6+, GLAD (OpenGL 3 loader), glm (header-only math)

## Success Criteria

- [ ] C++ sample builds and runs an interactive RmlUI window
- [ ] Rust sample calls DOM API via extern "C" bindings
- [ ] AssemblyScript sample calls DOM API from WASM
- [ ] All three build on Linux, macOS, Windows
- [ ] Plugin disabled → zero RmlUI/SDL3 code in output binary
