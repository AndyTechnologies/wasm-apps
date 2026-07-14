# How to manage the cache

Three independent caching layers speed up repeated builds.

## View cache status

```bash
wapp cache info
```

Shows the path, size, and content count for each cache layer.

## Clear all caches

```bash
wapp cache clear
```

Removes all three caches. Next build will be from scratch.

## Cache layers

| Layer | Location | What it stores | Invalidated by |
|---|---|---|---|
| **Compiler cache** | `.wapp_cache/compiler/` | Compiled `.wasm`, `.d.ts`, `.js`, sourcemaps | Source code or compiler flag changes |
| **Build manifest** | `.wapp_build/build-manifest.json` | WASM hashes + linker options | Input `.wasm` or linker option changes |
| **Download cache** | `~/.wasm-linker/` | Wasmtime C-API archive | `wapp setup` or `cache clear` |

## Bypass cache

Compiler cache can be skipped per-invocation (not exposed via CLI yet). For the linker, modify any option or input file to trigger a rebuild.
