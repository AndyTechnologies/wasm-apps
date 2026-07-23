# Delta for tests

## ADDED Requirements

### Requirement: Downloader Test Suite

A test suite for the downloader module MUST verify HTTP timeout behavior, redirect limit enforcement, redirect host validation, and resume integrity logic using `vi.mock` for HTTP.

#### Scenario: Timeout triggers on slow server

- GIVEN a mocked HTTP server that never responds
- WHEN the downloader fetches with default timeout
- THEN the request is aborted within 30 seconds

#### Scenario: Redirect limit throws on chain

- GIVEN a mocked server that responds with 302 for every request
- WHEN the downloader follows redirects
- THEN a `DownloadError` is thrown at the 6th redirect

#### Scenario: Resume restarts on size mismatch

- GIVEN a partial file larger than the current server content-length
- WHEN the downloader resumes
- THEN the partial file is deleted and download restarts

### Requirement: Extract Test Suite

A test suite for the extract module MUST verify LZMA memory limit enforcement, tar symlink entry rejection, and tar absolute path rejection using minimal archive fixtures.

#### Scenario: Symlink entry in tar is rejected

- GIVEN a `.tar` fixture containing a symbolic link entry
- WHEN the system extracts it
- THEN a `DownloadError` is thrown and no symlink is created

### Requirement: Setup Integration Test

A test suite for the setup module MUST verify the download → extract → header verification integration flow.

### Requirement: Compiler Test Suite

A test suite for the compiler module MUST verify target validation, chmod error logging, and cmake-js failure propagation using `vi.mock` for filesystem operations.

### Requirement: Plugin Loader Test Suite

A test suite for the plugin-loader MUST verify built-in plugin loading by name, external plugin path validation, and the register/lookup API.

### Requirement: Plugin Manager Test Suite

A test suite for the plugin-manager MUST verify `register`, `get`, and `remove` operations for compiler, linker, codegen, and WASM plugin types.

### Requirement: Native App Builder Test Suite

A test suite for native-app-builder MUST verify the builder setter chain, `validate()` preconditions, and cache up-to-date detection.

### Requirement: Build Pipeline Test Suite

A test suite for build-pipeline MUST verify stage lifecycle (parse → resolve → codegen → compile), error propagation from any failing stage, and partial pipeline state after mid-pipeline failure.

### Requirement: Watch Utils Test Suite

A test suite for watch-utils MUST verify path normalization, `..` segment rejection, debounce timing, and poll-scan behavior.

### Requirement: Disk Cache Update Test Suite

A test suite for disk-cache MUST verify that the updated hash key computation produces deterministic keys for identical inputs and different keys for different inputs.
