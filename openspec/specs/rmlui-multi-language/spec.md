# RmlUI Multi-Language Binding Specification

## Purpose

Defines the three-layer binding architecture: a stable C ABI header (`RmlUI_ABI.h`), type-safe C++ wrappers (`RmlUI.hh`), Rust FFI declarations, and AssemblyScript type definitions. All three language targets call the same C ABI.

## Requirements

### Requirement: C ABI Header

The system MUST provide `RmlUI_ABI.h` with ALL exported functions marked `extern "C"`.

| Convention | Rule |
|------------|------|
| Prefix | `Rml_` for all public functions |
| Name mangling | Prevented via `extern "C"` |
| Calling convention | Default C (`__cdecl` on x86) |
| Opaque handles | `typedef int32_t Rml_ElementId`, `Rml_ContextId` |
| Error reporting | Return `int32_t` — 0 success, negative error code |
| String parameters | `const char*` null-terminated UTF-8 |
| No exceptions | Functions MUST NOT throw — catch all C++ exceptions internally |

#### Scenario: C++ caller links ABI

- GIVEN a C++ translation unit that includes `RmlUI_ABI.h`
- WHEN compiled with any C++ compiler
- THEN all `Rml_*` symbols MUST be exported with C linkage (no mangling) and link correctly

### Requirement: Error Propagation

The error code convention:

| Code | Meaning |
|------|---------|
| `0` | Success |
| `-1` | Invalid handle (element/context ID does not exist) |
| `-2` | Null or empty parameter |
| `-3` | Out of memory |
| `-4` | Operation not supported |
| `-5` | Internal RmlUI error |

Each language binding MUST translate these into language-appropriate error handling:
- **C++**: `RmlUI_Exception` (from `RmlUI.hh`) wrapping the error code
- **Rust**: `Result<T, RmlError>` enum with `{ InvalidHandle, NullParam, OutOfMemory, Unsupported, Internal }`
- **AssemblyScript**: Return codes exposed; AS wrapper returns `T | null` and sets `lastError` property

#### Scenario: Rust error propagation

- GIVEN a Rust program calling `Rml_AppendChild(invalid_id, child_id)` which returns `-1`
- WHEN the Rust wrapper converts the return code
- THEN the result MUST be `Err(RmlError::InvalidHandle)`

### Requirement: C++ Wrapper Header

`RmlUI.hh` MUST provide RAII wrappers:

| Class | Wraps | Key Methods |
|-------|-------|-------------|
| `RmlContext` | `Rml_ContextId` | constructor(name, dims), `document()` |
| `RmlElement` | `Rml_ElementId` | `appendChild()`, `setAttribute()`, `addEventListener()` |
| `RmlDocument` | `Rml_ElementId` (root) | `getElementById()`, `querySelector()` |
| `RmlStyle` | `Rml_ElementId` | `operator[]` for get/set, `apply(css_text)` |

Destructors SHALL NOT destroy elements — element lifetime is managed by RmlUI context. RAII here means safe handle wrapping, not ownership.

### Requirement: Rust Crate Structure

The crate `rmlui-sys` MUST contain:

```
rmlui-sys/
├── build.rs          # Link to pre-built libRmlUI_ABI.a
├── src/
│   ├── lib.rs        # extern "C" declarations
│   ├── types.rs      # RmlError, RmlElementId, safe wrappers
│   └── dom.rs        # RmlDocument, RmlElement builder pattern
```

`lib.rs` MUST use `#[link(name = "RmlUI_ABI")]` and declare each `extern "C" fn` with `unsafe`.

A safe wrapper crate `rmlui` SHOULD provide:
- `RmlContext::new(title, width, height)`
- `RmlElement::create(tag)`, `.append(child)`, `.attr(name, value)`
- `RmlDocument::by_id(id)` returning `Option<RmlElement>`

### Requirement: AssemblyScript Type Definitions

The AS module MUST import host functions via `@external("env", "Rml_*")`:

```typescript
// rmlui.ts
@external("env", "Rml_CreateElement")
export declare function createElement(tag: string): i32

@external("env", "Rml_AppendChild")
export declare function appendChild(parent: i32, child: i32): i32
```

The AS wrapper SHALL expose a `Document` class with methods that match browser DOM conventions:

```typescript
class Document {
  createElement(tag: string): Element
  getElementById(id: string): Element | null
  get body(): Element
}
```

### Requirement: Name Mangling Avoidance

The C ABI header MUST be the single source of truth. All language-specific wrappers MUST be generated or manually kept in sync with `RmlUI_ABI.h`. A script `scripts/rmlui-bindgen` SHOULD auto-generate the Rust `extern "C"` block and AS imports from the C header.

#### Scenario: Adding a new ABI function

- GIVEN a new function `Rml_SetProperty` is added to `RmlUI_ABI.h`
- WHEN `scripts/rmlui-bindgen` runs
- THEN it MUST produce updated `lib.rs` extern block and updated `rmlui.ts` imports
