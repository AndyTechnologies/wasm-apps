# permission-manager Specification

## Purpose

Manage and persist file access permissions using SHA-256 hashing of the WASM binary, with AllowOnce (5-min TTL), AllowForever, and a terminal popup flow.

## Requirements

### Requirement: Permission Keying

Permissions MUST be keyed by the SHA-256 hash of the `.wasm` binary combined with the requested host path.

#### Scenario: Same binary, different paths

- GIVEN a WASM binary with hash `A` requests path `/data` and path `/etc`
- WHEN both paths have AllowForever grants
- THEN they are stored as separate entries: `(A, /data)` and `(A, /etc)`

### Requirement: AllowOnce TTL

An AllowOnce grant MUST expire after 5 minutes from grant time, requiring the user to re-authorize.

#### Scenario: Expired AllowOnce

- GIVEN the user granted AllowOnce for path `/data` 6 minutes ago
- WHEN the same binary requests `/data` again
- THEN the permission is not found and the terminal popup is shown

### Requirement: Permission Persistence

Permissions MUST be persisted in a `.permissions.json` file adjacent to the executable.

#### Scenario: AllowForever persists across restarts

- GIVEN the user selected AllowForever for path `/data`
- WHEN the executable restarts
- THEN `.permissions.json` contains the grant and `request-path` returns a valid fd

#### Scenario: Corrupted permissions file

- GIVEN `.permissions.json` contains invalid JSON
- WHEN the permission manager reads it
- THEN it resets to an empty permission set

### Requirement: Terminal Popup

When no valid permission is found, the host MUST display a terminal popup showing the requested path and the program's SHA-256 hash, then prompt for AllowOnce, AllowForever, or Deny.

#### Scenario: Popup displayed on first access

- GIVEN a WASM binary requests `/data` for the first time
- WHEN no permission entry exists
- THEN the terminal shows: "Program <hash> wants to access: /data\nAllow [O]nce, [F]orever, [D]eny:"
- AND the host waits for user input via `getline()`

### Requirement: PermissionDecision Enum

The system MUST define a `PermissionDecision` enum with variants `AllowOnce`, `AllowForever`, and `Deny`.

#### Scenario: Deny returns permission-denied

- GIVEN the user selects Deny in the popup
- WHEN the WASM module calls `request-path`
- THEN the host returns `permission-denied` error
