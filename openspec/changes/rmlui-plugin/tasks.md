# Tasks: RmlUI Plugin — DOM-style Native UI for WebAssembly Apps

## Review Workload Forecast

| Field                   | Value                     |
| ----------------------- | ------------------------- |
| Estimated changed lines | ~1150–1300                |
| 400-line budget risk    | High                      |
| 800-line budget risk    | High                      |
| Chained PRs recommended | Yes                       |
| Suggested split         | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy       | auto-forecast             |
| Chain strategy          | pending                   |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                        | Likely PR | Focused test command                                                          | Runtime harness                                                                                      | Rollback boundary                                                                          |
| ---- | ------------------------------------------- | --------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1    | Templates + CMake + download system         | PR 1      | `pnpm -F @wasm-apps/linker test -- --testPathPattern="compiler                | setup"`                                                                                              | N/A — no runtime binary yet, pure linker infrastructure                                    | Revert `templates-rmlui/`, `rmlui-dl.ts`, `rmlui-setup.ts`, and `compiler.ts`/`setup.ts` changes                               |
| 2    | Plugin registration + wiring                | PR 2      | `pnpm -F @wasm-apps/linker test -- --testPathPattern="plugin-loader           | codegen"`                                                                                            | N/A — plugin loads but no binary produced (no RmlUI deps on CI)                            | Revert `rmlui-plugin.ts`, `plugin-loader.ts`, `codegen.ts`, `wasmtime-linker-strategy.ts`, `native-app-builder.ts`, `index.ts` |
| 3    | C ABI + C++ wrappers + host function bridge | PR 3      | `pnpm -F @wasm-apps/linker test -- --testPathPattern="rmlui-plugin"`          | Manual: build a minimal C++ example with RmlUI enabled, verify `main.c.njk` includes RmlUI lifecycle | Revert `rmlui-abi.h`, `rmlui.hh`, and DOM host function registrations in `rmlui-plugin.ts` |
| 4    | Bindgen + language examples                 | PR 4      | `node scripts/rmlui-bindgen/index.mjs packages/types/src/rmlui-abi.h --check` | `pnpm -F @wasm-apps/examples build --example rmlui-basic`                                            | Revert `scripts/rmlui-bindgen/` and any example app directories                            |

## Phase 1: Infrastructure & Templates

- [ ] T-001 Create `packages/linker/templates-rmlui/main.c.njk` with RmlUI lifecycle entry including preamble, WASM module setup, loop with event pump/update/render, and cleanup
- [ ] T-002 Create `packages/linker/templates-rmlui/_rmlui-setup.c.njk` — `SDL_Init` → `SDL_CreateWindow` → `SDL_GL_CreateContext` → `gladLoadGL` → `Rml::Initialise` → `Rml::CreateContext` sequence with guard checks at each step
- [ ] T-003 Create `packages/linker/templates-rmlui/_rmlui-event-loop.c.njk` — `SDL_PollEvent` loop mapping SDL3 events to `Rml::Input::*` handlers, `SDL_EVENT_QUIT` stops loop, `WASM_ProcessModuleCalls()` before `context->Update()`
- [ ] T-004 Create `packages/linker/templates-rmlui/_rmlui-render.c.njk` — `SDL_GL_MakeCurrent` → `glDisable(GL_DEPTH_TEST)` → `glClear` → `context->Render()` → `SDL_GL_SwapWindow`
- [ ] T-005 Create `packages/linker/templates-rmlui/_rmlui-cleanup.c.njk` — null-safe reverse-init shutdown: `context->RemoveReference` → `Rml::Shutdown` → `SDL_GL_DeleteContext` → `SDL_DestroyWindow` → `SDL_Quit`
- [ ] T-006 Modify `packages/linker/src/compiler.ts` — add `ExtraLib` interface and `generateCMakeLists(wasmtimePath, extraLibs?)` overload that appends include/lib dirs and link targets
- [ ] T-007 Create `packages/linker/src/rmlui-dl.ts` — platform-aware download manifest for SDL3/RmlUI/GLAD assets mirroring `wasmtime-dl.ts` pattern with version pinning and SHA256
- [ ] T-008 Create `packages/linker/src/rmlui-setup.ts` — `setupRmlui()` function downloading + extracting all three deps to `~/.wasm-linker/rmlui/`
- [ ] T-009 Modify `packages/linker/src/setup.ts` — wire `setupRmlui()` into `runSetup()` alongside existing `setupWasmtime()`

## Phase 2: Plugin Registration

- [ ] T-010 Create `packages/linker/src/rmlui-plugin.ts` — `WasmPlugin` with `id: 'rmlui-plugin'`, registers all `Rml_*` host functions via `ctx.hostFunctions.register()`, hooks `BeforeCodeGen` to signal RmlUI mode
- [ ] T-011 Modify `packages/linker/src/plugin-loader.ts` — add `rmlui-plugin` case to built-in `DEFAULT_PLUGINS` and switch, dynamically import `./rmlui-plugin.js`
- [ ] T-012 Modify `packages/linker/src/codegen.ts` — `generateCCode()` accepts optional `templatePath` parameter, passes it to `renderTemplate()`
- [ ] T-013 Modify `packages/linker/src/wasmtime-linker-strategy.ts` — pass `templatePath` from options through `generateCCode()` call
- [ ] T-014 Modify `packages/linker/src/native-app-builder.ts` — when `rmlui-plugin` is enabled, call `setTemplateDir('templates-rmlui')` before build; wire `pluginConfigs` through to `loadPlugins()`
- [ ] T-015 Add `RmluiPluginConfig` and `ExtraLib` types to `packages/types/src/index.ts`

## Phase 3: C ABI & C++ Wrappers

- [ ] T-016 Create `packages/types/src/rmlui-abi.h` — all `extern "C"` functions with `Rml_*` prefix: opaque handles (`Rml_ContextId`, `Rml_ElementId`, `Rml_DocumentId`), error enum (`Rml_Error`), element tree API, attribute API, style API, query API, class list API, document loading API, font loading API, render loop API, event bridge API
- [ ] T-017 Create `packages/types/src/rmlui.hh` — RAII C++ wrappers: `RmlContext`, `RmlElement`, `RmlDocument`, `RmlStyle` classes with safe handle wrapping (destructors do NOT destroy elements — element lifecycle is RmlUI-managed)
- [ ] T-018 Add all DOM API host function trampolines in `rmlui-plugin.ts` — each `Rml_*` extern C call wrapped in a Wasmtime lambda with proper `_readAsString`/`_writeToString` WASM memory bridging

## Phase 4: Bindgen & Examples

- [ ] T-019 Create `scripts/rmlui-bindgen/index.mjs` — JS script parsing `rmlui-abi.h` to generate Rust `extern "C"` block + AssemblyScript `@external` imports, using regex-based header parser and code templates
- [ ] T-020 Create C++ example `examples/rmlui-basic/` — create document, add elements, set attributes, run event loop
- [ ] T-021 Create Rust example `examples/rmlui-rust/` — using `rmlui-sys` crate with safe `Result<T, RmlError>` wrappers
- [ ] T-022 Create AssemblyScript example `examples/rmlui-as/` — using `@external("env", "Rml_*")` with DOM-style Document class
