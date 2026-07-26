# Tasks: Filesystem Access

## Review Workload Forecast

| Field                   | Value         |
| ----------------------- | ------------- |
| Estimated changed lines | ~600-800      |
| 800-line budget risk    | Medium        |
| Chained PRs recommended | No            |
| Suggested split         | Single PR     |
| Delivery strategy       | auto-forecast |
| Chain strategy          | pending       |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

N/A — single PR within budget.

## Phase 1: Foundation — Types & Interfaces

- [ ] 1.1 **RED**: Write test — MountEntry type serialization, WappConfig/NativeAppOptions accept mounts
- [ ] 1.2 Add `MountEntry` interface + `PermissionDecision` enum to `packages/types/src/index.ts`
- [ ] 1.3 Add `mounts?: MountEntry[]` to `WappConfig` + `NativeAppOptions`
- [ ] 1.4 Add `mounts: Array<{host: string, guest: string}>` to `NunjucksTemplateContext` in `template-context.ts`
- [ ] 1.5 Modify `buildTemplateContext()` in `codegen.ts` to accept and inject `mounts`
- [ ] 1.6 Modify `generateCCode()` signature to pass `mounts` through
- [ ] 1.7 Thread `mounts` in `packages/linker/src/index.ts` → `createNativeApp()` → `generateCCode()`
- [ ] 1.8 Modify `packages/cli/src/index.ts` — read `config.mounts` from wapp.json, pass into `NativeAppOptions`

## Phase 2: C++ Runtime (fs-runtime.h)

- [ ] 2.1 **RED**: Write test — SHA-256 test vectors
- [ ] 2.2 Create `packages/linker/templates/fs-runtime.h` with embedded SHA-256 (public domain C++17)
- [ ] 2.3 Implement `FsRuntime::permissionId()` + `FsRuntime::isPathAllowed()`
- [ ] 2.4 Implement `FsRuntime::requestPath()` — `::open()` + WASI fd registration
- [ ] 2.5 Implement `.permissions.json` persistence (load, save, corrupt→reset)
- [ ] 2.6 Implement `FsRuntime::promptUser()` — terminal popup + AllowOnce(5min)/AllowForever/Deny

## Phase 3: Template & Wiring

- [ ] 3.1 Modify `main.c.njk` — `#include "fs-runtime.h"`, `{% for m in mounts %}` `wasi_config_preopen_dir()`
- [ ] 3.2 Add `request-path` host function block in `main.c.njk` — calls `FsRuntime::requestPath()`
- [ ] 3.3 Register `request-path` generator in `builtin-host-functions.ts`
- [ ] 3.4 Add `setMounts()` to `NativeAppBuilder` in `native-app-builder.ts`, thread to codegen
- [ ] 3.5 Modify `compileCpp()` in `compiler.ts` — copy `fs-runtime.h` to `src/` after writing main.cpp
- [ ] 3.6 **RED**: Write test — `generateCCode` with mounts produces expected preopen lines

## Phase 4: Build Cache

- [ ] 4.1 Add `mountsHash` to `BuildManifestOptions` in `build-cache.ts`
- [ ] 4.2 Check `mountsHash` in `isBuildUpToDate()` cache comparison
- [ ] 4.3 Pass `mountsHash` from `NativeAppBuilder.build()` → `saveBuildManifest()`

## Phase 5: Testing & Verification

- [ ] 5.1 **Unit**: mount resolution + cache key serialization (Jest)
- [ ] 5.2 **Unit**: `request-path` C++ generator string snapshot (Jest)
- [ ] 5.3 **Integration**: wapp.json with mounts → build → binary → WASI dir visible
- [ ] 5.4 **E2E**: path traversal (`../../etc/passwd`) → denied
- [ ] 5.5 **E2E**: AllowForever → restart → fd still valid
- [ ] 5.6 **E2E**: mount change in wapp.json → build cache miss
