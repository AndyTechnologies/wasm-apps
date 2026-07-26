# RmlUI Event System Specification

## Purpose

Defines the bridge between SDL3 input events and RmlUI, plus the DOM callback mechanism that dispatches events to WebAssembly-registered listeners.

## Requirements

### Requirement: SDL Event Pump Integration

The system MUST call `SDL_PollEvent` in the main loop before `Rml::Context::Update`.

```
while (running) {
    SDL_Event e;
    while (SDL_PollEvent(&e)) {
        if (e.type == SDL_EVENT_QUIT) running = false;
        RmlUI_ProcessSdlEvent(&e);
    }
    context->Update();
    context->Render();
}
```

`RmlUI_ProcessSdlEvent` MUST map SDL3 events to `Rml::InputEventHandler`:

| SDL3 Event | RmlUI Input Handler |
|------------|---------------------|
| `SDL_EVENT_MOUSE_MOTION` | `Rml::Input::MouseMove(x, y)` |
| `SDL_EVENT_MOUSE_BUTTON_DOWN` | `Rml::Input::MouseButtonDown(button)` |
| `SDL_EVENT_MOUSE_BUTTON_UP` | `Rml::Input::MouseButtonUp(button)` |
| `SDL_EVENT_MOUSE_WHEEL` | `Rml::Input::MouseWheel(delta, direction)` |
| `SDL_EVENT_KEY_DOWN` | `Rml::Input::KeyDown(key_modifier)` |
| `SDL_EVENT_KEY_UP` | `Rml::Input::KeyUp(key_modifier)` |
| `SDL_EVENT_TEXT_INPUT` | `Rml::Input::TextInput(utf8_char)` |
| `SDL_EVENT_WINDOW_RESIZED` | `context->SetDimensions(w, h)` |

#### Scenario: Mouse click on button

- GIVEN a window with a rendered button at screen position (100, 50)
- WHEN the user clicks at (100, 50) and SDL produces `SDL_EVENT_MOUSE_BUTTON_DOWN`
- THEN `Rml::Input::MouseButtonDown(0)` MUST be called, and RmlUI MUST fire a click event on the button

#### Scenario: SDL_QUIT stops loop

- GIVEN the main loop is running
- WHEN `SDL_EVENT_QUIT` is received
- THEN the running flag MUST be set to false and the loop MUST exit

### Requirement: DOM Callback Registration

The system MUST store callbacks registered via `Rml_AddEventListener` and invoke them when RmlUI dispatches matching events.

| Function | Signature |
|----------|-----------|
| `Rml_AddEventListener` | `(i32 elem, const char* event, i32 callback_id) → i32` |
| `Rml_RemoveEventListener` | `(i32 elem, const char* event) → i32` |

Supported event types: `click`, `dblclick`, `mousedown`, `mouseup`, `mousemove`, `mouseover`, `mouseout`, `focus`, `blur`, `keydown`, `keyup`, `keypress`, `load`, `resize`, `scroll`, `change`, `submit`.

The callback storage MUST map `(element_id, event_type) → callback_id`. The `callback_id` is an index into a WASM-callable function table.

#### Scenario: Register and fire click

- GIVEN an element with id 5 and a registered callback_id 1 for "click"
- WHEN the user clicks the element and RmlUI fires click
- THEN the bridge MUST invoke the WASM function at table index 1 with an event object describing the click

### Requirement: Callback Invocation Contract

All callbacks MUST execute:
- **On the main thread only** — no thread safety concerns
- **Non-reentrant** — if a callback modifies the DOM, re-entrant event dispatch MUST be deferred to the next frame
- **Synchronous** — the WASM function is called via `wasmtime::Func::call` before `SDL_GL_SwapWindow`

#### Scenario: Reentrancy guard

- GIVEN a click callback that calls `Rml_RemoveChild` which removes the clicked element
- WHEN the callback modifies the DOM during dispatch
- THEN the event system MUST NOT fire additional events from the same SDL poll cycle that result from the DOM modification (deferred to next frame)

### Requirement: Event Object Serialization

When invoking a WASM callback, the bridge MUST populate a C `Rml_Event` struct and pass a pointer:

```c
typedef struct {
    Rml_ElementId target;
    Rml_ElementId current_target;
    const char* type;
    int32_t mouse_screen_x;
    int32_t mouse_screen_y;
    int32_t key_code;
    int32_t modifiers;
    uint8_t prevent_default;    /* set to 1 by callback */
    uint8_t stop_propagation;   /* set to 1 by callback */
} Rml_Event;
```

The struct is read/write — WASM code can set `prevent_default` or `stop_propagation` fields. After the callback returns, the bridge checks these flags:
- `prevent_default == 1`: calls `event->StopPropagation()` on the RmlUI event
- `stop_propagation == 1`: does NOT call further listeners on parent elements

#### Scenario: preventDefault on submit

- GIVEN a form submit event callback
- WHEN the callback sets `prevent_default = 1` on the event struct
- THEN after the callback returns, the bridge MUST call `event->StopPropagation()` so RmlUI does not process the default submit action

### Requirement: Future-Proof Touch/Gesture Events

The event struct MUST reserve fields for future touch support:

```c
int32_t touch_active;       /* 0 = mouse, 1 = touch */
int32_t touch_id;           /* touch finger ID, -1 if not touch */
```

These fields MUST be zero-initialized in v1. The SDL→RmlUI mapping function MUST ignore touch events if not yet handled, rather than crashing.
