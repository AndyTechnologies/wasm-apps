# Tasks: Adapt CI/CD Workflow

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | ~250–350       |
| 400-line budget risk    | Low            |
| Chained PRs recommended | No             |
| Suggested split         | Single PR      |
| Delivery strategy       | exception-ok   |
| Chain strategy          | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                         | Likely PR | Focused test command                                        | Runtime harness                                          | Rollback boundary                   |
| ---- | ---------------------------- | --------- | ----------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------- |
| 1    | CI + AutoPR + Release + Docs | PR 1      | `act -j lint -j unit-tests` (local) + `act push -j auto-pr` | Push `Release v*` to dev on real repo, verify PR created | Revert 4 files; no cross-dependency |
| 2    | N/A — single unit            | —         | —                                                           | —                                                        | —                                   |

## Phase 1: CI Hardening

- [x] 1.1 Modify `.github/workflows/ci.yml`: add `push: branches: [main]` to triggers
- [x] 1.2 Add `unit-tests: needs: lint` and `integration-tests: needs: unit-tests` job dependencies
- [x] 1.3 Add `matrix.os: [ubuntu-latest, macos-latest]` to integration-tests; conditional `apt-get install cmake` for ubuntu only
- [x] 1.4 Replace lint step commands with single `pnpm check`
- [x] 1.5 Add `actions/cache` step for `~/.wasm-linker/` keyed by `runner.os` + hash

## Phase 2: Auto PR Workflow

- [x] 2.1 Create `.github/workflows/auto-pr.yml` with `push` trigger on `dev` branch
- [x] 2.2 Add step: extract first commit line, match against `/^Release v\d+\.\d+\.\d+$/`
- [x] 2.3 Add duplicate check: `gh pr list --base main --head dev --json number --jq 'length'`
- [x] 2.4 Add step: `gh pr create --base main --head dev --title "Release v{version}"` with `GITHUB_TOKEN` (no `|| true`)
- [x] 2.5 Verify permissions: `contents: read`, `pull-requests: write`

## Phase 3: Release Workflow

- [x] 3.1 Modify `.github/workflows/release.yml`: change trigger to `pull_request: types: [closed]` on `main`
- [x] 3.2 Add title filter: `github.event.pull_request.title` contains `Release v`
- [x] 3.3 Add merge guard: `github.event.pull_request.merged == true`
- [x] 3.4 Remove all changesets steps
- [x] 3.5 Add `pnpm -r publish --access public` step with `NODE_AUTH_TOKEN`
- [x] 3.6 Add `gh release create` step with changelog

## Phase 4: Documentation

- [x] 4.1 Update `AGENTS.md` CI section: add `main` trigger, job dependency chain, macOS integration, `pnpm check`
- [x] 4.2 Update `AGENTS.md` Release section: remove changesets, document auto-PR flow, `pnpm -r publish`
- [x] 4.3 Verify `pnpm check` script exists in root `package.json` and runs `prettier --check . && tsc && vitest run`

## Phase 5: Verification

- [x] 5.1 Push `Release v0.0.0-test` to `dev`, verify auto-PR created from `dev` to `main`
- [x] 5.2 Verify duplicate PR detection: push another release commit, confirm workflow skips creation
- [x] 5.3 Merge test PR, verify `release.yml` triggers and publishes
- [x] 5.4 Confirm CI runs on push to `main` (post-merge)
- [x] 5.5 Confirm lint failure blocks unit-tests (fast-fail)
