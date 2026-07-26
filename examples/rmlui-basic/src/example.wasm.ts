/**
 * RmlUI Basic Example — AssemblyScript
 *
 * Demonstrates the RmlUI DOM API via host function imports.
 * The WASM module calls env.Rml_* functions to create a context,
 * load a document, and interact with elements — all rendered
 * natively by the generated C++ host binary.
 */

// ── Raw host function imports ──────────────────────────────────────────
// These are provided by the wasm-apps linker + RmlUI plugin at runtime.

@external("env", "Rml_CreateContext")
declare function rmlCreateContext(name: string, w: i32, h: i32): i32;

@external("env", "Rml_LoadDocument")
declare function rmlLoadDocument(ctx: i32, path: string): i32;

@external("env", "Rml_ShowDocument")
declare function rmlShowDocument(doc: i32): void;

@external("env", "Rml_CreateElement")
declare function rmlCreateElement(tag: string): i32;

@external("env", "Rml_AppendChild")
declare function rmlAppendChild(parent: i32, child: i32): i32;

@external("env", "Rml_SetAttribute")
declare function rmlSetAttribute(el: i32, name: string, value: string): i32;

@external("env", "Rml_SetTextContent")
declare function rmlSetTextContent(el: i32, text: string): i32;

@external("env", "Rml_GetElementById")
declare function rmlGetElementById(ctx: i32, id: string): i32;

@external("env", "Rml_AddEventListener")
declare function rmlAddEventListener(el: i32, event: string, cb: i32): i32;

@external("env", "Rml_GetBody")
declare function rmlGetBody(ctx: i32): i32;

// ── Entry point ─────────────────────────────────────────────────────────
// Called from the generated main.cpp interactive loop.

export function _start(): void {
  // 1. Create a rendering context
  const ctx = rmlCreateContext("main", 1024, 768);
  if (ctx < 0) {
    // Context creation failed — nothing we can do without a context
    return;
  }

  // 2. Load the RML document from the ui/ directory
  const doc = rmlLoadDocument(ctx, "ui/main.rml");
  if (doc > 0) {
    rmlShowDocument(doc);

    // 3. Enhance the document: add a dynamically created element
    const body = rmlGetBody(ctx);
    if (body > 0) {
      const greeting = rmlCreateElement("p");
      if (greeting > 0) {
        rmlSetTextContent(greeting, "Hello from AssemblyScript WASM!");
        rmlSetAttribute(greeting, "class", "wasm-greeting");
        rmlAppendChild(body, greeting);
      }
    }
  }

  // The host loop (RmlUI_Render) runs after _start returns,
  // so the document stays visible until the window is closed.
}
