# static-mounts Specification

## Purpose

Allow WASM modules to read host filesystem directories declared in `wapp.json`, resolved to WASI preopens at build time.

## Requirements

### Requirement: Mount Declaration

The `wapp.json` manifest MUST support a `mounts` field containing an array of path-mapping objects.

#### Scenario: Declare a single mount

- GIVEN a `wapp.json` with `{ "mounts": [{ "host": "./data", "guest": "/data" }] }`
- WHEN the CLI reads the manifest
- THEN it parses the mount entry and passes it to the linker

#### Scenario: Multiple mounts

- GIVEN a `wapp.json` with two mount entries
- WHEN the linker processes them
- THEN each entry generates a separate WASI preopen via `wasi_config_preopen_dir()`

### Requirement: Path Resolution

Mount `host` paths MUST resolve relative to the `wapp.json` file location at build time.

#### Scenario: Relative path resolution

- GIVEN `wapp.json` at `/project/my-app/wapp.json` with `"host": "./assets"`
- WHEN the linker resolves the path
- THEN the resolved host path is `/project/my-app/assets`

### Requirement: Invalid Path Handling

An unresolvable or non-existent host path MUST produce a build error.

#### Scenario: Non-existent directory

- GIVEN a mount with `"host": "./nonexistent"`
- WHEN the CLI reads the manifest
- THEN the build fails with a linker error and a descriptive message

### Requirement: Cache Invalidation

The build cache key MUST include a hash of the `mounts` array.

#### Scenario: Mount change invalidates cache

- GIVEN a successful build with mounts `["./data"]`
- WHEN the user changes mounts to `["./data", "./assets"]`
- THEN the next build is a cache miss and re-links
