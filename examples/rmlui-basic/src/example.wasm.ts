/**
 * RmlUI Basic Example — AssemblyScript
 *
 * Demonstrates the RmlUI DOM API via the Element and Document wrapper
 * classes from rmlui-bindings.ts. All host function calls go through
 * the safe typed wrappers instead of raw @external declarations.
 */

import { Element, Document, createContext, loadDocument, update, render, isRunning, shutdown, RMLUI_OK } from '../../../packages/types/src/rmlui-bindings';

// ── Entry point ─────────────────────────────────────────────────────────
// Called from the generated main.cpp interactive loop.

export function _start(): void {
  // 1. Create a rendering context
  let ctx = createContext('main', 1024, 768);
  if (ctx <= 0) {
    // Context creation failed — nothing we can do without a context
    return;
  }

  // 2. Load the RML document from the ui/ directory
  let docId = loadDocument(ctx, 'ui/main.rml');
  if (docId <= 0) return;

  let doc = new Document(ctx, docId);
  doc.show();

  // 3. Access the document body and demonstrate DOM API
  let body = doc.body;
  if (body) {
    // 3a. createElement + textContent + setAttribute
    let p = doc.createElement('p');
    p.textContent = 'Hello from AssemblyScript WASM!';
    p.setAttribute('class', 'wasm-greeting');
    p.setStyleProperty('color', 'cyan');
    p.addClass('highlight');
    body.appendChild(p);

    // 3b. hasClass / toggleClass
    if (p.hasClass('highlight')) {
      p.toggleClass('highlight');
      p.addClass('confirmed');
    }

    // 3c. createTextNode + insertBefore
    let label = doc.createElement('span');
    label.textContent = 'Dynamic: ';
    body.insertBefore(label, p);

    // 3d. innerHTML setter / getter
    let div = doc.createElement('div');
    div.innerHTML = '<em>Created via innerHTML</em>';
    body.appendChild(div);

    // 3e. removeChild + re-append
    body.removeChild(label);
    body.appendChild(label);

    // 3f. querySelector
    let found = body.querySelector('p');
    if (found) {
      found.setStyleProperty('font-size', '18px');
    }

    // 3g. querySelectorAll — use index-based for loop
    let all = body.querySelectorAll('p');
    if (all.length > 0) {
      for (let i = 0; i < all.length; i++) {
        all[i].setStyleProperty('margin', '4px');
      }
    }

    // 3h. getElementById
    let output = doc.getElementById('output');
    if (output) {
      output.textContent = 'DOM API ready.';
    }

    // 3i. hasAttribute + getAttribute + removeAttribute
    if (p.hasAttribute('class')) {
      let cls = p.getAttribute('class');
      p.removeAttribute('class');
    }

    // 3j. Bulk style via setStyle
    p.setStyle('color: orange\nfont-weight: bold');

    // 3k. getStyleProperty
    let color = p.getStyleProperty('color');
  }

  // 4. Check running state (the host loop runs after _start returns)
  if (isRunning() > 0) {
    update();
    render();
  }
}
