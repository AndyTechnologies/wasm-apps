# dynamic-fs-access Specification

## Purpose

Provide a runtime import function `request-path` that validates and returns WASI file descriptors for host paths requested by WASM modules.

## Requirements

### Requirement: Import Signature

The host MUST expose an import function `request-path` with signature `(path: string, flags: string[]) -> result<u32, error>`.

#### Scenario: Successful request

- GIVEN a WASM module calls `request-path("/data/config.json", ["read"])`
- WHEN the path is within an allowed root
- THEN the host returns a valid WASI file descriptor (`u32`)

#### Scenario: Failed request

- GIVEN a WASM module calls `request-path("/restricted/secret.txt", ["read"])`
- WHEN the path is outside allowed roots
- THEN the host returns an error code

### Requirement: Path Traversal Prevention

The host MUST canonicalize the requested path with `realpath()` and reject paths that do not start with an allowed root directory prefix.

#### Scenario: Directory traversal denied

- GIVEN a WASM module calls `request-path("../../etc/passwd", ["read"])`
- WHEN the host canonicalizes the path
- THEN the host returns `permission-denied` error

#### Scenario: Symlink escape denied

- GIVEN a symlink inside a mount that points outside the allowed root
- WHEN the host canonicalizes the path via `realpath()`
- THEN the resolved path is outside the prefix and `permission-denied` is returned

### Requirement: Async Compatibility

The `request-path` host function MUST be async-compatible and not block the event loop.

#### Scenario: Concurrent requests

- GIVEN two WASM modules call `request-path` concurrently
- WHEN both paths are valid
- THEN both receive valid file descriptors without blocking each other
