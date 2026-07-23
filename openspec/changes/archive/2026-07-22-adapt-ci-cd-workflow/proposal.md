# Proposal: Adapt CI/CD Workflow

## Intent

Replace the changesets-based release workflow with a simpler Release v{version} mechanism, and harden CI to match documented rules. The new flow: commit `Release v{version}` to `dev` → auto-create PR to `main` → manual merge → CD publishes to npm.

## Scope

### In Scope

- CI runs on push to `dev` (existing) + push to `main` (new) + PR to `main` (existing)
- `unit-tests` depends on `lint` passing first
- macOS runner for integration-tests
- Use `pnpm check` in CI (format:check + build + vitest run)
- Caching for cmake/wasmtime in integration tests
- Auto PR workflow: commit `Release v{version}` creates PR `dev→main`
- Replace changesets release with Release PR trigger
- Update AGENTS.md to document rules

### Out of Scope

- Windows runner for integration tests (deferred)
- Auto-merge (PRs wait for manual merge)
- Changes to individual test files

## Capabilities

### New Capabilities

- `auto-release-pr`: Automatic PR creation from `dev` to `main` when a Release v{version} commit lands on dev

### Modified Capabilities

None — no existing specs need behavioral changes at the spec level.

## Approach

1. Update `.github/workflows/ci.yml`: add push-to-main trigger, job dependency lint→unit-tests, macOS for integration, caching, `pnpm check` step
2. Create `.github/workflows/auto-pr.yml`: new workflow triggered on push-to-dev, checks commit message for `^Release v\d+\.\d+\.\d+$`, creates PR via `gh`
3. Update `.github/workflows/release.yml`: trigger on PR merge where title contains `Release v`, remove changesets logic, publish directly
4. Update `AGENTS.md`: document new release workflow, remove changesets references

## Affected Areas

| Area                            | Impact   | Description                                        |
| ------------------------------- | -------- | -------------------------------------------------- |
| `.github/workflows/ci.yml`      | Modified | Add triggers, job deps, macOS, caching, pnpm check |
| `.github/workflows/auto-pr.yml` | New      | Auto PR on Release v{version} commit               |
| `.github/workflows/release.yml` | Modified | Trigger on Release PR merge, remove changesets     |
| `AGENTS.md`                     | Modified | Document new workflow, remove changesets           |
| `package.json`                  | Check    | Ensure `pnpm check` script exists and is correct   |

## Risks

| Risk                                                   | Likelihood | Mitigation                                                       |
| ------------------------------------------------------ | ---------- | ---------------------------------------------------------------- |
| `gh` CLI not authenticated in auto-pr workflow         | Med        | Use `GITHUB_TOKEN` which is auto-available                       |
| Merge conflicts in auto PR                             | Low        | Only likely if dev has diverged significantly; manual resolution |
| Release v{version} commit without version bump in code | Low        | PR author must ensure package.json versions are correct          |
| Rate limits on gh CLI                                  | Low        | One PR per release, well within limits                           |

## Rollback Plan

1. Revert changes to `ci.yml`, `release.yml`
2. Delete `auto-pr.yml`
3. Restore changesets config and previous AGENTS.md
4. Restore previous release workflow

## Dependencies

- `gh` CLI (pre-installed on GitHub Actions runners)
- `GITHUB_TOKEN` with `contents: write` and `pull-requests: write` permissions

## Success Criteria

- [ ] `git commit -m "Release v1.4.0"` on dev creates PR dev→main with title "Release v1.4.0"
- [ ] Merging that PR triggers the release workflow and publishes to npm
- [ ] Integration tests pass on both ubuntu and macOS
- [ ] CI fails fast: lint failure → unit-tests skipped
