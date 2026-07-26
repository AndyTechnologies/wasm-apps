# RmlUI DOM API Example

Demostración de la API DOM de RmlUI desde AssemblyScript, cubriendo:

- Element: createElement, createTextNode, appendChild, removeChild, insertBefore, replaceChild
- Attributes: setAttribute, getAttribute, removeAttribute, hasAttribute
- Content: textContent, innerHTML
- Style: setStyleProperty, getStyleProperty, setStyle
- Class list: addClass, removeClass, toggleClass, hasClass
- Query: querySelector, querySelectorAll
- Document: body, head, getElementById, createElement, createTextNode, show, close
- Render loop: update, render, isRunning
- Element re-parenting (removeChild + appendChild to different parent)

## Build & Run

```bash
cd ../..
pnpm build:example -- examples/rmlui-dom-api
```
