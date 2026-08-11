# RmlUI Render Loop Specification

## Purpose

Defines the SDL3+OpenGL3 window creation and rendering loop that integrates RmlUI with the existing toolchain's `main.cpp` entry point. The linker's Nunjucks template set (`templates-rmlui/`) produces this code.

## Requirements

### Requirement: Initialization Sequence

The system MUST initialize in this exact order:

1. `SDL_Init(SDL_INIT_VIDEO)` — MUST succeed or abort with error
2. `SDL_GL_SetAttribute` for OpenGL 3.3 core profile (doublebuffer, depth size 24)
3. `SDL_CreateWindow(title, width, height, SDL_WINDOW_OPENGL)` — MUST succeed
4. `SDL_GL_CreateContext(window)` — MUST succeed
5. `SDL_GL_MakeCurrent(window, context)` — MUST succeed
6. `gladLoadGL()` or `gladLoadGLLoader(SDL_GL_GetProcAddress)` — MUST succeed
7. `Rml::Initialise()` — MUST succeed
8. `Rml::CreateContext(name, dimensions, render_interface)` — MUST succeed

#### Scenario: Full initialization

- GIVEN a system with SDL3 and OpenGL 3.3 support
- WHEN the init function runs steps 1-8
- THEN a visible window MUST be created, a valid OpenGL context MUST be active, and `Rml::CreateContext` MUST return a valid context pointer

#### Scenario: SDL_Init fails

- GIVEN a system where SDL_Init returns an error
- WHEN step 1 fails
- THEN the initialization MUST return a non-zero error code and MUST NOT proceed to any subsequent step

### Requirement: Window Configuration

The template SHALL accept these parameters from `wapp.json`:

| Parameter   | Default      | Type    |
| ----------- | ------------ | ------- |
| `title`     | `"Wasm App"` | string  |
| `width`     | `1024`       | integer |
| `height`    | `768`        | integer |
| `resizable` | `true`       | boolean |

The host MUST NOT be required to provide an existing window — the plugin creates its own. If the host wants to supply an existing SDL_Window, that is out of scope for v1.

### Requirement: Update Function

`void RmlUI_Update()` MUST be called once per frame after the SDL event pump:

1. `RmlUI_ProcessSdlEvents()` — pumps `SDL_PollEvent`, calls `Rml::InputEventHandler` on each
2. `context->Update()` — advances RmlUI internal animation timers
3. Returns void — errors are logged internally

### Requirement: Render Function

`void RmlUI_Render()` MUST be called once per frame after `Update()`:

1. `SDL_GL_MakeCurrent(window, context)` — ensures correct context
2. `glDisable(GL_DEPTH_TEST)` — RmlUI is 2D
3. `glClear(GL_COLOR_BUFFER_BIT)` — clear to configured background
4. `context->Render()` — RmlUI renders the full frame
5. `SDL_GL_SwapWindow(window)` — present frame

OpenGL state MUST be restored if the host does additional rendering. The RmlUI render scope SHOULD push/pop GL state.

#### Scenario: Frame render

- GIVEN an initialized RmlUI context with one document loaded
- WHEN `RmlUI_Render()` is called
- THEN `context->Render()` MUST be invoked, and `SDL_GL_SwapWindow` MUST be called exactly once

### Requirement: Shutdown Sequence

`void RmlUI_Shutdown()` MUST execute in reverse init order:

1. `context->RemoveReference()` (or RemoveAllDocuments)
2. `Rml::Shutdown()`
3. `SDL_GL_DeleteContext(context)`
4. `SDL_DestroyWindow(window)`
5. `SDL_Quit()`

Shutdown MUST be safe to call even if init failed partway — each step MUST guard against null handles.

#### Scenario: Partial init then shutdown

- GIVEN init failed at step 5 (after window, before context)
- WHEN `RmlUI_Shutdown()` is called
- THEN `SDL_DestroyWindow(window)` MUST run; `SDL_GL_DeleteContext` and `Rml::Shutdown` MUST be skipped because their handles are null

### Requirement: Main Loop Integration

The Nunjucks main.c.njk template MUST produce a loop:

```
Initialize()
while (running) {
    RmlUI_Update()
    RmlUI_Render()
}
Shutdown()
```

`WASM_ProcessModuleCalls()` MUST be called during `Update()`, before `context->Update()`, so WASM callbacks execute within the same frame.

#### Scenario: 60 FPS loop

- GIVEN no events pending and no animations running
- WHEN the loop runs for 60 iterations
- THEN each iteration MUST call Update once and Render once, and the window MUST NOT close until SDL_QUIT is received
