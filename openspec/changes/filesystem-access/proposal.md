# Proposal: Two-Layer Filesystem Access

## Intent

Enable WASM modules to read host filesystem data through two layers: static mounts (wapp.json → WASI preopens) and dynamic runtime access via an import function with permission management. No external crypto deps.

## Scope

### In Scope
- Static mount declaration in wapp.json → WASI preopens at build time
- Dynamic `request-path` import returning WASI file descriptors (u32)
- Path traversal validation (deny `../`, symlink escapes)
- Terminal permission popup (Phase 1 — no GUI)
- SHA-256 permission persistence (`.permissions.json`, AllowOnce/AllowForever)
- Build cache invalidation on mount changes

### Out of Scope
- Native GUI popups, multi-user, networked fs, write access

## Capabilities

### New Capabilities
- `static-mounts`: Declare host dir mounts in wapp.json, resolved to WASI preopens via `wasi_config_preopen_dir()`
- `dynamic-fs-access`: `request-path` import — WASM calls at runtime, host validates and returns a WASI-compatible fd
- `permission-manager`: SHA-256 permission persistence, AllowOnce (5-min TTL), AllowForever, terminal popup

### Modified Capabilities
None — net-new feature domain.

## Approach

Hybrid C++/TypeScript. CLI reads mounts from wapp.json, threads through linker to Nunjucks template context. Template generates WASI preopens and registers `request-path` host function. Core fs logic (SHA-256, path validation, TTL, popup) lives in new header-only `fs-runtime.h`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/types` | Modified | New mount/perm/request-path types |
| `packages/cli` | Modified | Read mounts from wapp.json |
| `packages/linker/src/codegen.ts` | Modified | Pass mounts to template ctx |
| `packages/linker/src/template-context.ts` | Modified | New `mounts` field |
| `packages/linker/templates/main.c.njk` | Modified | WASI preopens + request-path host fn |
| `packages/linker/templates/fs-runtime.h` | **New** | Header-only C++: SHA-256, perms, path validation |
| `packages/linker/src/builtin-host-functions.ts` | Modified | Register request-path generator |
| `packages/linker/src/native-app-builder.ts` | Modified | Mounts setter |
| `packages/linker/src/build-cache.ts` | Modified | Include mounts hash in cache key |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Path traversal bypass | Low | `realpath()` + reject non-prefix paths |
| SHA-256 bugs | Low | Public domain impl + test vectors |
| Perm file corruption | Low | Parse fail = reset to no perms |

## Rollback Plan

Remove `mounts` from wapp.json to disable fs access. Delete `.permissions.json` manually. Unregistered `request-path` returns `permission-denied`.

## Dependencies

Wasmtime v46 C-API (`wasi_config_preopen_dir()`). No external crypto libs.

## Success Criteria

- [ ] Static mounts visible as WASI directories from compiled WASM
- [ ] `request-path` returns valid fd for permitted host paths
- [ ] Path traversal (`../../etc/passwd`) returns `permission-denied`
- [ ] AllowOnce persists ≤5 min, AllowForever persists across restarts
- [ ] Changing `mounts` in wapp.json invalidates the build cache
