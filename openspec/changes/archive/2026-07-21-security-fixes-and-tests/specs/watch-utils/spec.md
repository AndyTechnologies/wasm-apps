# Delta for watch-utils

## ADDED Requirements

### Requirement: Watch Path Sanitization

The system MUST normalize the filename received from `fs.watch` using `path.normalize()` before passing it to the change handler. Paths containing `..` segments MUST be rejected.

Rejected paths MUST NOT trigger file change processing — the handler MUST be skipped.

#### Scenario: Normal filename passes through

- GIVEN a filename `src/app.ts` from `fs.watch`
- WHEN the system normalizes it
- THEN `src/app.ts` is passed to the change handler

#### Scenario: Normalized path resolves correctly

- GIVEN a filename `./src/../src/app.ts` from `fs.watch`
- WHEN the system normalizes it
- THEN `src/app.ts` is passed to the change handler

#### Scenario: Path with .. traversal is rejected

- GIVEN a filename `../../etc/passwd` from `fs.watch`
- WHEN the system normalizes and inspects it
- THEN the path is rejected
- AND the change handler is NOT invoked
