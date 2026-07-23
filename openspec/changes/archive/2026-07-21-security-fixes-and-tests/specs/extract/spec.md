# Delta for extract

## ADDED Requirements

### Requirement: LZMA Memory Limit

The extraction system MUST enforce a memory limit on the LZMA decompressor to prevent denial-of-service via compression bombs.

The system MUST throw a `DownloadError` when the decompressor exceeds the configured memory limit.

#### Scenario: Normal archive extracts successfully

- GIVEN a legitimate `.tar.xz` archive under the memory limit
- WHEN the system extracts it
- THEN the decompression succeeds and files are written

#### Scenario: Compression bomb exceeds memlimit

- GIVEN a crafted `.tar.xz` archive designed to decompress to a very large size
- WHEN the system starts extraction
- THEN the decompressor fails with a memory limit error
- AND a `DownloadError` is thrown

### Requirement: Tar Entry Filter

The extraction system MUST reject symbolic link entries and entries with absolute paths during tar extraction.

The system MUST NOT write files outside the extraction target directory.

#### Scenario: Normal file extracts correctly

- GIVEN a `.tar` archive containing regular relative-path files
- WHEN the system extracts via the tar filter
- THEN all files are written to the target directory

#### Scenario: Symlink entry is rejected

- GIVEN a `.tar` archive containing a symbolic link entry
- WHEN the system extracts via the tar filter
- THEN the symlink entry is skipped
- AND a `DownloadError` is thrown

#### Scenario: Absolute path entry is rejected

- GIVEN a `.tar` archive containing an entry with an absolute path (e.g., `/etc/passwd`)
- WHEN the system extracts via the tar filter
- THEN the absolute path entry is skipped
- AND a `DownloadError` is thrown
