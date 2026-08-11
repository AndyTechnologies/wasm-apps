# RmlUI DOM API Specification

## Purpose

Defines the C ABI DOM-style API that WebAssembly modules use to construct and manipulate RmlUI document trees. Every host function is exposed via `extern "C"` and callable from C++, Rust, and AssemblyScript.

## Requirements

### Requirement: Element Tree Construction

The system MUST expose a DOM node factory via C ABI.

| Function             | Signature                                | Behavior                                 |
| -------------------- | ---------------------------------------- | ---------------------------------------- |
| `Rml_CreateDocument` | `() → i32 (context_id)`                  | Create empty document with `<body>` root |
| `Rml_CreateElement`  | `(const char* tag) → i32 (element_id)`   | Create element, returns 0 on failure     |
| `Rml_CreateTextNode` | `(const char* text) → i32 (element_id)`  | Create text node                         |
| `Rml_AppendChild`    | `(i32 parent, i32 child) → i32 (error)`  | Append child, returns 0 on success       |
| `Rml_RemoveChild`    | `(i32 parent, i32 child) → i32 (error)`  | Remove child, returns 0 on success       |
| `Rml_InsertBefore`   | `(i32 parent, i32 child, i32 ref) → i32` | Insert child before reference sibling    |
| `Rml_ReplaceChild`   | `(i32 parent, i32 new, i32 old) → i32`   | Replace old child with new               |

Error codes: `0` = success, `-1` = invalid parent/element ID, `-2` = wrong context, `-3` = out of memory.

#### Scenario: Build a two-element tree

- GIVEN a document context
- WHEN the host calls `Rml_CreateElement("div")` returning id 1, then `Rml_CreateElement("p")` returning id 2, then `Rml_AppendChild(1, 2)`
- THEN element 2 MUST be a child of element 1 in RmlUI internal tree

#### Scenario: Append to invalid parent

- GIVEN an element_id that was never created
- WHEN the host calls `Rml_AppendChild(999, 2)`
- THEN the function MUST return `-1` (invalid ID) and NOT mutate the DOM

### Requirement: Attribute and Content Access

The system MUST support reading/writing element attributes and content.

| Function              | Signature                                               |
| --------------------- | ------------------------------------------------------- |
| `Rml_SetAttribute`    | `(i32 elem, const char* name, const char* value) → i32` |
| `Rml_GetAttribute`    | `(i32 elem, const char* name) → const char*`            |
| `Rml_RemoveAttribute` | `(i32 elem, const char* name) → i32`                    |
| `Rml_HasAttribute`    | `(i32 elem, const char* name) → i32`                    |
| `Rml_SetTextContent`  | `(i32 elem, const char* text) → i32`                    |
| `Rml_GetTextContent`  | `(i32 elem) → const char*`                              |
| `Rml_SetInnerHTML`    | `(i32 elem, const char* html) → i32`                    |
| `Rml_GetInnerHTML`    | `(i32 elem) → const char*`                              |

Returned strings MUST be valid until the next call to the same getter (single-slot buffer). `SetInnerHTML` MUST parse the HTML string into RmlUI child nodes.

#### Scenario: Set and get attribute

- GIVEN an element with id 1
- WHEN `Rml_SetAttribute(1, "class", "button")` returns 0, then `Rml_GetAttribute(1, "class")`
- THEN the returned string MUST equal `"button"`

#### Scenario: innerHTML parsing

- GIVEN an empty `<div>` element
- WHEN `Rml_SetInnerHTML(elem, "<p>Hello</p>")` returns 0
- THEN the element MUST have exactly one child of tag `p`

### Requirement: Style Object

The system MUST expose individual RML property accessors and a bulk setter.

| Function               | Signature                                               |
| ---------------------- | ------------------------------------------------------- |
| `Rml_SetStyleProperty` | `(i32 elem, const char* prop, const char* value) → i32` |
| `Rml_GetStyleProperty` | `(i32 elem, const char* prop) → const char*`            |
| `Rml_SetStyle`         | `(i32 elem, const char* css_text) → i32`                |

Supported properties: `color`, `width`, `height`, `display`, `position`, `left`, `top`, `font-size`, `background-color`, `border`, `margin`, `padding`, `text-align`, `opacity`, `z-index`, `visibility`.

#### Scenario: Set style and verify

- GIVEN an element
- WHEN `Rml_SetStyleProperty(elem, "color", "red")` returns 0
- THEN `Rml_GetStyleProperty(elem, "color")` MUST return `"red"`

### Requirement: Query Methods

The system MUST support element lookup.

| Function               | Signature                                            |
| ---------------------- | ---------------------------------------------------- |
| `Rml_GetElementById`   | `(i32 context, const char* id) → i32`                |
| `Rml_QuerySelector`    | `(i32 context, const char* selector) → i32`          |
| `Rml_QuerySelectorAll` | `(i32 context, const char* selector) → i32* (array)` |
| `Rml_GetBody`          | `(i32 context) → i32`                                |
| `Rml_GetHead`          | `(i32 context) → i32`                                |

`Rml_QuerySelectorAll` returns a null-terminated array of element IDs. Caller MUST call `Rml_FreeNodeList` to free.

#### Scenario: getElementById

- GIVEN a document with `<div id="main">`
- WHEN `Rml_GetElementById(ctx, "main")`
- THEN returns the element id of the div

### Requirement: Class List

| Function                | Signature                           |
| ----------------------- | ----------------------------------- |
| `Rml_ClassListAdd`      | `(i32 elem, const char* cls) → i32` |
| `Rml_ClassListRemove`   | `(i32 elem, const char* cls) → i32` |
| `Rml_ClassListToggle`   | `(i32 elem, const char* cls) → i32` |
| `Rml_ClassListContains` | `(i32 elem, const char* cls) → i32` |

### Requirement: Element Lifecycle

Elements progress through: **Create → Attach → Render → Detach → Destroy**.

- `Rml_CreateElement` allocates (unattached). Attaching via `Rml_AppendChild` moves to Attach.
- Render occurs automatically via the render loop (see render-loop spec).
- `Rml_RemoveChild` detaches. The detached element is NOT destroyed until the context is closed.
- Destroyed elements MUST NOT be accessed — any call with a destroyed ID returns `-1`.

#### Scenario: Remove then re-append

- GIVEN an attached child element
- WHEN `Rml_RemoveChild(parent, child)` returns 0, then `Rml_AppendChild(different_parent, child)` returns 0
- THEN the child MUST appear under `different_parent` (not destroyed, just moved)
