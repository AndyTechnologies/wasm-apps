/**
 * RmlUI DOM API Example — AssemblyScript
 *
 * Comprehensive demonstration of every Element and Document method
 * provided by rmlui-bindings.ts, including DOM tree manipulation,
 * attribute access, style properties, class lists, and queries.
 */

import {
  Element,
  Document,
  createContext,
  loadDocument,
  loadDocumentFromString,
  releaseContext,
  update,
  render,
  isRunning,
  RMLUI_OK,
} from "../../packages/types/src/rmlui-bindings";

// ── Entry point ─────────────────────────────────────────────────────────

export function _start(): void {
  // 1. Create RmlUI context
  let ctx: i32 = createContext("main", 1024, 768);
  if (ctx <= 0) return;

  // 2. Load document
  let docId: i32 = loadDocument(ctx, "ui/main.rml");
  if (docId <= 0) return;
  let doc: Document = new Document(ctx, docId);
  doc.show();

  // 3. Test body access
  let body = doc.body;
  if (body) {
    // 4. createElement + appendChild
    let p: Element = doc.createElement("p");
    p.textContent = "Hello from AssemblyScript DOM API!";
    p.setAttribute("class", "wasm-greeting");
    p.setStyleProperty("color", "cyan");
    p.addClass("highlight");
    body.appendChild(p);

    // 5. Test class list methods
    let hasHighlight: bool = p.hasClass("highlight");
    if (hasHighlight) {
      p.toggleClass("highlight");
      p.addClass("confirmed");
    }

    // 6. createTextNode + insertBefore
    let label: Element = doc.createElement("span");
    label.textContent = "Label: ";
    body.insertBefore(label, p);

    // 7. Test innerHTML setter
    let div: Element = doc.createElement("div");
    div.innerHTML = "<em>Italic via innerHTML</em>";
    body.appendChild(div);

    // 8. Test querySelector from body
    let found = body.querySelector("p");
    if (found) {
      let existingClass: string = found.getAttribute("class");
      found.setStyleProperty("font-size", "18px");
    }

    // 9. Test querySelectorAll — index-based for loop
    let all = body.querySelectorAll("p");
    if (all.length > 0) {
      for (let i: i32 = 0; i < all.length; i++) {
        let el: Element = all[i];
        el.setStyleProperty("margin", "4px");
      }
    }

    // 10. Test removeChild + re-append
    if (label) {
      body.removeChild(label);
      body.appendChild(label);
    }

    // 11. Test getElementById
    let byId = doc.getElementById("main-content");
    if (byId) {
      byId.setStyleProperty("background", "#1a1a2e");
    }

    // 12. Test hasAttribute + removeAttribute
    if (p.hasAttribute("class")) {
      let className: string = p.getAttribute("class");
      p.removeAttribute("class");
    }

    // 13. Test style methods
    p.setStyle("color: orange\nfont-weight: bold");
    let color: string = p.getStyleProperty("color");
  }

  // 14. Test update + render loop detection
  let running: i32 = isRunning();
}

function renderLoopCheck(): void {
  // Check if the render loop is active
  if (isRunning() > 0) {
    update();
    render();
  }
}
