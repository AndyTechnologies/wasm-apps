# RmlUI Resource Loader Specification

## Purpose

Defines how Rml documents, fonts, and textures are loaded — from filesystem paths, in-memory strings, or embedded buffers — and how plugins can extend the resource provider.

## Requirements

### Requirement: RML Document Loading

The system MUST expose three document loading functions:

| Function | Signature | Behavior |
|----------|-----------|----------|
| `Rml_LoadDocument` | `(i32 ctx, const char* path) → i32 (doc_id)` | Load from filesystem path, return document handle, or 0 on failure |
| `Rml_LoadDocumentFromString` | `(i32 ctx, const char* rml) → i32` | Parse RML string, return document handle |
| `Rml_LoadDocumentFromBuffer` | `(i32 ctx, const void* data, i32 len) → i32` | Load from embedded byte buffer |

All three MUST call `Rml::Context::LoadDocument()` or equivalent. The returned document handle is valid until the context is destroyed.

#### Scenario: Load RML from string

- GIVEN an initialized RmlUI context
- WHEN `Rml_LoadDocumentFromString(ctx, "<rml><body><p>Hello</p></body></rml>")` is called
- THEN it MUST return a valid document handle, and `Rml_ShowDocument(doc)` MUST display `<p>Hello</p>`

### Requirement: Font Loading

RmlUI requires at least one font face before it can render text. The system MUST provide:

| Function | Signature | Behavior |
|----------|-----------|----------|
| `Rml_LoadFont` | `(const char* path) → i32` | Load TrueType from file, return 0 on success |
| `Rml_LoadFontFromBuffer` | `(const char* name, const void* data, i32 len) → i32` | Load from embedded TTF/OTF buffer |

The system MUST load a default font (e.g., `NotoSans-Regular.ttf`) automatically during initialization if available. The default font path SHALL be configurable via `wapp.json` `plugins[].config.defaultFont`.

#### Scenario: Load default font

- GIVEN the plugin init sequence
- WHEN the font search path contains `NotoSans-Regular.ttf`
- THEN `Rml::LoadFontFace("NotoSans-Regular.ttf")` MUST be called before `Rml::CreateContext`

#### Scenario: Font missing is handled gracefully

- GIVEN no font files are found in any search path
- WHEN init completes without a font
- THEN the system MUST log a warning and continue (text will not render, but the app will not crash)

### Requirement: Image/Texture Loading

Images in RML (`<img src="...">`, `decorator: image(...)`) are loaded through the `Rml::Texture` interface. The system MUST wrap this with:

| Function | Signature |
|----------|-----------|
| `Rml_LoadTexture` | `(const char* path) → i32` |
| `Rml_LoadTextureFromBuffer` | `(const char* name, const void* data, i32 len) → i32` |
| `Rml_GetTextureDimensions` | `(const char* name) → struct {i32 w, i32 h}` |

The system SHALL provide a custom `Rml::FileInterface` implementation that resolves paths against configured search paths.

### Requirement: Custom Resource Provider Interface

The system MUST allow plugins to extend resource loading by implementing a provider interface:

```c
typedef struct {
    const char* scheme;           /* e.g. "wasm" */
    void* user_data;
    Rml_ResourceResponse (*open)(const char* path, void* user_data);
    void (*close)(Rml_ResourceResponse resp, void* user_data);
} Rml_ResourceProvider;
```

`Rml_RegisterResourceProvider(provider)` SHALL register the provider. When RmlUI encounters a URL with the registered scheme, it MUST call the provider's `open` callback. Built-in schemes: `file://` (default), `asset://` (resolved relative to the WASM binary).

#### Scenario: Custom wasm:// scheme

- GIVEN a registered `Rml_ResourceProvider` for scheme `"wasm"`
- WHEN RmlUI loads `<img src="wasm://icon.png">`
- THEN the provider's `open` callback MUST be called with path `"icon.png"`; if the callback returns a valid buffer, that data MUST be used as the texture source

### Requirement: Search Path Configuration

The system MUST support a search path for resources:

```
Rml_SetResourcePath(i32 ctx, const char* path_list)
```

`path_list` is `;`-separated (Unix) or `;`-separated (Windows). Default path: `./assets/`. The system's `FileInterface` SHALL search each path in order.

### Requirement: Embedded Resource Format

For WASM modules, resources can be embedded at link time. The Nunjucks template SHALL produce a header with `unsigned char` arrays:

```c
// _embedded-resources.c.njk
static const unsigned char _res_font_noto[] = { 0x00, 0x01, ... };
static const size_t _res_font_noto_len = 123456;
```

The plugin SHALL provide `Rml_LoadFontFromBuffer("NotoSans", _res_font_noto, _res_font_noto_len)` during init. The linker embeds `< 1 MB` resources by default; larger resources MUST come from the filesystem.

#### Scenario: Embedded font works offline

- GIVEN a WASM app built with `--embed-resource NotoSans-Regular.ttf`
- WHEN the app runs on a system without the font file
- THEN the plugin MUST still load the font from the embedded buffer and text MUST render correctly
