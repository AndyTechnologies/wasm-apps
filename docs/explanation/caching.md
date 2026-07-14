# How caching works

Three independent cache layers speed up repeated builds by avoiding unnecessary work.

## Compiler cache

**Location:** `.wapp_cache/compiler/` (project-local)

**Key:** SHA-256 of `{sourceCode, runtime, isDev, sourceMap, optimizeLevel, shrinkLevel}`

**Storage:** One directory per key containing `result.json`, `out.wasm`, `out.d.ts`, `out.js`, `out.wasm.map`

Any change to source code or compiler flags produces a different hash → cache miss → fresh compilation. Identical input → cache hit → skips `asc.main()` entirely and loads artifacts from disk.

## Build manifest

**Location:** `.wapp_build/build-manifest.json` (project-local)

The manifest stores hashes of all input `.wasm` files plus linker options (entry, target, wasi, moduleMatching, wasmtimePath, wasmtimeVersion). If the current state matches the manifest, `createNativeApp()` returns immediately.

## Download cache

**Location:** `~/.wasm-linker/wasmtime/` (user-global)

The Wasmtime C-API archive (~15 MB) is downloaded once and cached globally. HTTP range requests enable resumable downloads. Cleared with `wapp cache clear` and regenerated with `wapp setup`.

## Cache management

| Command | Effect |
|---|---|
| `wapp cache info` | Show all three caches with size and content count |
| `wapp cache clear` | Delete all three caches completely |
