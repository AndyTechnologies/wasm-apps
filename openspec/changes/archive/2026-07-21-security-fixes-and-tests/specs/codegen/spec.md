# Delta for codegen

## ADDED Requirements

### Requirement: Error Return Instead of Process Exit

The `define_exports` function MUST return an error code (`int`) instead of calling `std::exit(1)` when a code generation error occurs. The caller MUST check the return value and propagate the error.

This requirement applies to `main()`-context callers only. Lambda or callback contexts are exempt.

#### Scenario: Successful codegen returns 0

- GIVEN valid WASM exports
- WHEN `define_exports` generates C++ code
- THEN the function returns 0
- AND the generated code is correct

#### Scenario: Codegen error returns 1 instead of exit

- GIVEN an invalid WASM export that would previously trigger `std::exit(1)`
- WHEN `define_exports` processes it
- THEN the function returns 1
- AND the process continues (no immediate exit)
- AND the caller handles the error return
