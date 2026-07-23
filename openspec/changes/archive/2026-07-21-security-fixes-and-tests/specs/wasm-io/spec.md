# Delta for wasm-io

## ADDED Requirements

### Requirement: Section Bounds Validation

Every WASM section read MUST validate that the requested offset + length falls within the binary buffer boundaries before accessing memory.

The system MUST throw a `LinkerError` when an out-of-bounds read is detected during section parsing.

#### Scenario: Valid section within bounds succeeds

- GIVEN a well-formed WASM binary with sections at expected offsets
- WHEN `readSection()` is called with valid position and length
- THEN the section data is returned without error

#### Scenario: Out-of-bounds section read throws

- GIVEN a malformed WASM binary with a section header claiming length beyond the buffer
- WHEN `readSection()` reads that section
- THEN a `LinkerError` is thrown
- AND the parser does not access memory outside the buffer

#### Scenario: Import/export entry with truncated data

- GIVEN a WASM binary with an import section header that declares more entries than the remaining buffer can hold
- WHEN the parser iterates over those imports
- THEN a `LinkerError` is thrown at the first out-of-bounds access
