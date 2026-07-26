# Design: Filesystem Access (Two-Layer)

## Technical Approach

Hybrid TS/C++ pipeline: CLI threads `mounts` from `wapp.json` through the linker to Nunjucks template context. The template generates WASI preopen calls (static layer) and registers a `request-path` host function (dynamic layer). Core fs logic lives in a new header-only `fs-runtime.h` copied to the build directory at compile time. Cache invalidation includes a mounts hash.

## Architecture Decisions

### Decision: Mount config format

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `mounts: { "/guest": "./host" }` (object) | Key ordering ambiguous, no metadata extension | Rejected |
| `mounts: [{ host, guest }]` (array of objects) | Explicit, extendable, natural JSON | **Chosen** |

### Decision: fs-runtime.h inclusion strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Compile as separate .cpp | Requires CMakeLists.txt changes, complicates build script | Rejected |
| Copy header to build dir in `compileCpp()` | Minimal change (copy file alongside main.cpp before cmake-js), keeps `#include "fs-runtime.h"` working | **Chosen** |

### Decision: Permission file schema

```
.permissions.json → [{ id, wasmHash, path, decision, grantedAt }]
```

Keyed by `id = sha256(wasmHash + ":" + path)` for O(1) lookup. Corrupted JSON → reset to empty set.

### Decision: SHA-256 source

| Option | Tradeoff | Decision |
|--------|----------|----------|
| OpenSSL/libcrypto | External dependency, not always available | Rejected |
| Public domain single-header C++17 | No deps, audit-ready, embed in `fs-runtime.h` | **Chosen** |

### Decision: WASI fd allocation

Static mounts → `wasi_config_preopen_dir()` at init (standard WASI). Dynamic `request-path` → `FsRuntime::requestPath()` calls `::open()` + Wasmtime C-API to register fd in WASI context.

## Data Flow

```
wapp.json { mounts: [{host, guest}] }
  │
  ▼ CLI resolveConfig()
packages/cli/src/index.ts
  │  mounts in NativeAppOptions
  ▼
packages/linker/src/index.ts  createNativeApp()
  │  mounts → generateCCode()
  ▼
packages/linker/src/codegen.ts  buildTemplateContext()
  │  mounts added to NunjucksTemplateContext
  ▼
packages/linker/templates/main.c.njk
  │  for mount in mounts → wasi_config_preopen_dir()
  │  #include "fs-runtime.h"
  │  request-path host function body → FsRuntime::requestPath()
  ▼
packages/linker/src/compiler.ts  compileCpp()
  │  copies fs-runtime.h to src/
  ▼
cmake-js → native binary
```

## Interfaces

### New TypeScript types (`packages/types`)

```typescript
interface MountEntry {
  host: string;   // resolved relative to wapp.json at build time
  guest: string;  // WASI virtual path, e.g. "/data"
}
// Added to WappConfig: mounts?: MountEntry[]
// Added to NativeAppOptions: mounts?: MountEntry[]
```

### `request-path` host function contract

| Field | Value |
|-------|-------|
| Module | `env` |
| Name | `request-path` |
| Params | `[i32]` — pointer to null-terminated path string in WASM memory |
| Results | `[i32]` — fd > 0 on success, 0 = denied, -1 = traversal, -2 = not found |

### C++ function signatures (`fs-runtime.h`)

```cpp
namespace FsRuntime {
  // Validates path + permissions, opens file, registers WASI fd
  // Returns fd (>0) or error code (<=0)
  int32_t requestPath(const std::string& path, Caller& caller,
                      const std::vector<std::string>& allowedRoots);

  // Canonicalize + prefix check — rejects ../ and symlink escapes
  bool isPathAllowed(const std::string& realPath,
                     const std::vector<std::string>& allowedRoots);

  // SHA-256 of (wasmHash + ":" + path)
  std::string permissionId(const std::string& wasmHash,
                           const std::string& path);

  // Terminal popup: "Program <hash> wants to access: <path>"
  // Returns AllowOnce (5-min TTL), AllowForever, or Deny
  PermissionDecision promptUser(const std::string& wasmHash,
                                const std::string& path);
}
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/types/src/index.ts` | Modify | Add `MountEntry`, `mounts` to `WappConfig` + `NativeAppOptions` |
| `packages/cli/src/index.ts` | Modify | Pass `config.mounts` into `NativeAppOptions` |
| `packages/linker/src/index.ts` | Modify | Thread `mounts` through `createNativeApp()` → `generateCCode()` + cache |
| `packages/linker/src/codegen.ts` | Modify | Accept `mounts`, inject into `buildTemplateContext()` |
| `packages/linker/src/template-context.ts` | Modify | Add `mounts: Array<{host: string, guest: string}>` to `NunjucksTemplateContext` |
| `packages/linker/templates/main.c.njk` | Modify | Add `#include "fs-runtime.h"`, `{% for m in mounts %}` `wasi_config_preopen_dir()`, `request-path` host function block |
| `packages/linker/templates/fs-runtime.h` | **Create** | SHA-256, permission manager, path validation (`realpath` + prefix), terminal popup, JSON perm persistence |
| `packages/linker/src/builtin-host-functions.ts` | Modify | Register `request-path` generator → emits call to `FsRuntime::requestPath()` |
| `packages/linker/src/native-app-builder.ts` | Modify | Add `setMounts()`, thread to codegen |
| `packages/linker/src/build-cache.ts` | Modify | Add `mountsHash` to `BuildManifestOptions`, check in `isBuildUpToDate()` |
| `packages/linker/src/compiler.ts` | Modify | After writing `main.cpp`, copy `templates/fs-runtime.h` to `src/fs-runtime.h` |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Mount resolution + cache key | Jest — serialization, hash computation |
| Unit | `request-path` C++ generator string | Jest — snapshots of generated body |
| Integration | End-to-end: wapp.json → binary with mounts | Build a test fixture, run binary, verify WASI dir visible |
| E2E | Path traversal detection | Symlink inside mount → request outside → denied |
| E2E | Permission persistence | AllowForever → restart → fd still valid |
| E2E | Cache invalidation on mount change | Build, change mounts, rebuild = cache miss |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Absent `mounts` field = no static preopens, `request-path` not registered = WASM gets `permission-denied` if it tries to import it.

## Open Questions

- [ ] Confirm Wasmtime v46 C-API function for dynamic fd registration (`wasmtime_wasi_context_add_fd` or equivalent)
- [ ] Decide SHA-256 header source: embed in `fs-runtime.h` or separate `sha256.h`
