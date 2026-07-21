# Delta for disk-cache

## ADDED Requirements

### Requirement: Source Code Separate Hashing

The cache key computation MUST hash the source code separately using SHA-256 before including it in the canonical cache-key JSON object. The source code MUST NOT be embedded as raw text in the canonical object.

This change ensures that the cache key computation is O(source-length) for hashing rather than O(source-length) for JSON serialization of raw source text.

#### Scenario: Same source produces same key

- GIVEN identical source code and identical compiler flags
- WHEN `computeKey()` is called twice
- THEN both calls return the same cache key

#### Scenario: Different source produces different key

- GIVEN different source code with identical compiler flags
- WHEN `computeKey()` is called for each source
- THEN the cache keys differ

#### Scenario: Key does not contain raw source text

- GIVEN any source code
- WHEN `computeKey()` is called
- THEN the canonical JSON object contains the hex hash, not the raw source string
