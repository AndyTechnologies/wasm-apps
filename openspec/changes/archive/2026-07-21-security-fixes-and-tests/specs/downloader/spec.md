# Delta for downloader

## ADDED Requirements

### Requirement: HTTP Request Timeout

Every HTTP download request MUST have a timeout of 30 seconds. The system MUST abort the request and throw a `DownloadError` when the timeout is reached.

#### Scenario: Download completes within timeout

- GIVEN a responsive HTTP server
- WHEN the downloader fetches a resource
- THEN the download completes successfully within the timeout window

#### Scenario: Slow server times out

- GIVEN an HTTP server that stalls past 30 seconds
- WHEN the downloader fetches a resource
- THEN the request is aborted
- AND a `DownloadError` is thrown

### Requirement: Redirect Limit

The downloader MUST follow a maximum of 5 consecutive HTTP redirects. The system MUST throw a `DownloadError` when the redirect limit is exceeded.

#### Scenario: Normal redirect chain succeeds

- GIVEN a URL that redirects to a CDN endpoint (within 5 hops)
- WHEN the downloader follows the chain
- THEN the final resource is downloaded successfully

#### Scenario: Redirect loop is detected

- GIVEN a URL causing more than 5 consecutive redirects
- WHEN the downloader follows the chain
- THEN the download stops at the 5th redirect
- AND a `DownloadError` is thrown

### Requirement: Redirect Host Validation

The downloader MUST validate that each redirect URL's host belongs to the same base domain as the original request. Redirects to different base domains MUST be rejected with a `DownloadError`.

#### Scenario: Same-domain redirect succeeds

- GIVEN a URL on `github.com` that redirects to `objects.githubusercontent.com`
- WHEN the downloader follows the redirect
- THEN the redirect is accepted (base domain match)

#### Scenario: Cross-domain redirect is rejected

- GIVEN a URL on `github.com` that redirects to `malicious-site.com`
- WHEN the downloader follows the redirect
- THEN the redirect is rejected
- AND a `DownloadError` is thrown

### Requirement: Resume Integrity Check

When resuming a partial download, the system MUST verify that `startByte < serverContentLength` before appending. If the server content length is less than or equal to the local partial file size, the system MUST delete the partial file and restart the download from byte 0.

#### Scenario: Resume with valid server range succeeds

- GIVEN a partial download of 500 bytes and a server reporting 1000 bytes total
- WHEN the download resumes
- THEN downloading continues from byte 500

#### Scenario: Resume with truncated server content restarts

- GIVEN a partial download of 500 bytes and a server now reporting 400 bytes total
- WHEN the download resumes
- THEN the partial file is deleted
- AND the download restarts from byte 0
