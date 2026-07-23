## Exploration: CI/CD Workflow

### Current State

The project uses GitHub Actions for CI/CD with two workflows: `ci.yml` for continuous integration and `release.yml` for publishing. The branching model is `dev` for daily work and `main` for stable releases. CI runs on push to `dev` and PRs to `main`. Release workflow triggers on push to `main` (and merged PRs to `main`), using Changesets for version management and npm publishing with OIDC/Trusted Publishers.

### Current CI/CD Architecture

- **CI triggers**:
  - Push to `dev` branch
  - Pull requests targeting `main` branch
- **Jobs** (3 jobs, sequential dependencies):
  1. `lint` — ubuntu-latest only (Prettier + TypeScript build/typecheck)
  2. `unit-tests` — matrix: ubuntu-latest, macos-latest, windows-latest
  3. `integration-tests` — ubuntu-latest only, needs: unit-tests (requires cmake + wasmtime setup)
- **Release**:
  - Triggered on push to `main` + merged PRs to `main` + manual dispatch
  - Checks for pending changesets (`.changeset/*.md`)
  - If changesets exist: versions packages, creates "chore: version packages" PR
  - If no changesets: publishes to npm via `pnpm changeset publish`, creates GitHub Release with changelog
  - 4 packages versioned as fixed group, public access, OIDC/Trusted Publishers

### Gaps Found

1. **CI doesn't run on push to `main`** — only on push to `dev` and PRs to `main`. A direct push to `main` would skip CI entirely.
2. **Integration tests only on ubuntu** — no macOS/Windows coverage for the linker/native binary pipeline, despite the project claiming cross-platform support.
3. **No dependency of `unit-tests` on `lint`** — unit-tests runs parallel to lint, meaning tests could run on code that fails typechecking.
4. **No CI gate for PRs to `dev`** — AGENTS.md mentions PRs from feature branches to `dev` but CI only runs on PRs to `main`.
5. **`pnpm check` not used in CI** — AGENTS.md says "pnpm check debe pasar antes del PR" but CI runs format:check, build, and vitest run as separate steps instead of using the combined `pnpm check` script.
6. **No caching for integration test dependencies** — cmake and wasmtime are re-installed on every integration run.

### Analysis

What works:

- Clear separation of lint → unit tests → integration tests
- Cross-platform unit testing (3 OS matrix)
- Changesets-based release automation with version PR creation
- OIDC/Trusted Publishers for npm (no token rotation needed)
- Concurrency control on release workflow

What needs change:

- CI should also trigger on push to `main` (safety net)
- `unit-tests` should depend on `lint` passing first
- Integration tests should expand to at least macOS
- Add PR validation for `dev` branch PRs
- Use `pnpm check` in CI for consistency with AGENTS.md
- Cache cmake/wasmtime for integration tests

### Recommendation

Update CI workflow to: (1) add push to `main` trigger, (2) make `unit-tests` depend on `lint`, (3) add macOS runner for integration-tests, (4) add caching for wasmtime/cmake in integration tests, (5) add PR validation for `dev` branch. Update AGENTS.md to document triggers and match reality.

### Ready for Proposal

Yes
