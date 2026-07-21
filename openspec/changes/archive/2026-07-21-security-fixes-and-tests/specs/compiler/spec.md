# Delta for compiler

## ADDED Requirements

### Requirement: CMake Target Validation

The system MUST validate the `--target` argument passed to CMake against a regex pattern that allows only alphanumeric characters, underscores, and hyphens (`^[a-zA-Z0-9_-]+$`). Arguments containing shell metacharacters or path separators MUST be rejected.

The system MUST throw a `ConfigError` when the target argument is invalid.

#### Scenario: Valid target passes validation

- GIVEN a target string `x86_64-linux`
- WHEN the compiler validates it
- THEN validation succeeds

#### Scenario: Target with shell metacharacters is rejected

- GIVEN a target string `x86_64-linux; rm -rf /`
- WHEN the compiler validates it
- THEN validation fails
- AND a `ConfigError` is thrown

#### Scenario: Target with path separators is rejected

- GIVEN a target string `../../etc/passwd`
- WHEN the compiler validates it
- THEN validation fails
- AND a `ConfigError` is thrown

### Requirement: Chmod Error Logging

The system MUST log a warning when `fs.chmod` fails after writing a CMake script file. The system MUST NOT silently swallow chmod errors.

#### Scenario: chmod succeeds

- GIVEN a CMake script file was written successfully
- WHEN the compiler applies chmod +x
- THEN no warning is logged

#### Scenario: chmod fails logs warning

- GIVEN a CMake script file on a filesystem that denies chmod
- WHEN the compiler applies chmod +x
- THEN a warning is logged describing the failure
- AND the build continues (chmod failure is non-fatal)
