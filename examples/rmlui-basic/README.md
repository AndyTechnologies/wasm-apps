# rmlui-basic — AssemblyScript RmlUI Example

Shows how to use the RmlUI DOM API from AssemblyScript via host function imports.

## How it works

1. The **RmlUI plugin** registers host functions (`env.Rml_*`) in the linker.
2. The **generated `main.cpp`** initialises SDL3 + OpenGL 3 + RmlUI, defines all host
   functions as real bridge bodies, loads the WASM module, and enters an interactive loop.
3. The **WASM module** (`src/example.wasm.ts`) calls `env.Rml_*` to create a context,
   load a document, and dynamically append elements to the DOM.
4. After `_start` returns, the host loop calls `RmlUI_Render()` each frame, keeping
   the UI interactive until the user closes the window.

## Structure

```
rmlui-basic/
├── wapp.json              # Toolchain config with rmlui-plugin enabled
├── src/
│   └── example.wasm.ts    # AssemblyScript source — calls env.Rml_* functions
├── ui/
│   ├── main.rml           # RmlUI document template (HTML-like)
│   └── style.rcss         # RmlUI stylesheet (CSS-like)
└── README.md
```

## How to run

```bash
cd examples/rmlui-basic
wapp build
./rmlui-basic
```

Requires SDL3 and OpenGL 3.3-capable GPU. The RmlUI plugin must be installed
(`packages/linker` provides the template and host function registrations).

## Key takeaways

| Concept | How it's done |
|---------|--------------|
| Context creation | `Rml_CreateContext("main", 1024, 768)` |
| Document loading | `Rml_LoadDocument(ctx, "ui/main.rml")` |
| DOM manipulation | `Rml_CreateElement`, `Rml_AppendChild`, `Rml_SetTextContent` |
| Attribute setting | `Rml_SetAttribute(el, "class", "wasm-greeting")` |
| Render loop | Handled by the host — `_start` only sets up the scene |
