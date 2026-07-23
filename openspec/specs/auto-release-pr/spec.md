# Auto Release PR Specification

## Purpose

Define the behavior for automatically creating a Pull Request from `dev` to `main` when a Release commit lands on `dev`, and triggering the CD pipeline when that PR is merged.

## Requirements

### Requirement: Release Commit Detection

A push to `dev` whose first commit message line matches `^Release v\d+\.\d+\.\d+$` MUST trigger the auto-PR workflow.

#### Scenario: Valid release commit

- GIVEN a commit pushed to `dev` with message `Release v1.4.0`
- WHEN the CI workflow processes the push event
- THEN a pull request MUST be created from `dev` to `main`
- AND the PR title MUST be `Release v1.4.0`

#### Scenario: Invalid commit format

- GIVEN a commit pushed to `dev` with message `fix: update readme`
- WHEN the CI workflow processes the push event
- THEN no pull request MUST be created

#### Scenario: Semver validation

- GIVEN a commit pushed to `dev` with message `Release v1.4`
- WHEN the CI workflow processes the push event
- THEN no pull request MUST be created
- AND the workflow SHOULD log a warning about invalid version format

### Requirement: Auto PR Creation

The auto PR MUST use the GitHub CLI (`gh`) to create a pull request from `dev` to `main` with the release version as title and the commit message body as description.

#### Scenario: Successful PR creation

- GIVEN a valid `Release v{version}` commit on `dev`
- WHEN `gh pr create` executes successfully
- THEN the PR MUST be created with base `main`, head `dev`, and title `Release v{version}`
- AND the workflow MUST complete with success

#### Scenario: Duplicate PR detection

- GIVEN an existing open PR from `dev` to `main` with title `Release v{version}`
- WHEN a new `Release v{version}` commit is pushed
- THEN the workflow SHOULD skip creating a new PR
- AND it SHOULD log a message that the PR already exists

#### Scenario: gh CLI failure

- GIVEN a valid `Release v{version}` commit on `dev`
- WHEN `gh pr create` fails (network error, auth failure)
- THEN the workflow MUST fail
- AND the error MUST be logged

### Requirement: CI Hardening

The CI workflow MUST enforce job ordering and cross-platform coverage.

#### Scenario: Lint gates unit tests

- GIVEN a push to `dev` or `main`, or a PR to `main`
- WHEN the CI workflow runs
- THEN the `unit-tests` job MUST depend on `lint` completing successfully
- AND `integration-tests` MUST depend on `unit-tests`

#### Scenario: Cross-platform integration tests

- GIVEN a CI run for a push to `dev` or PR to `main`
- WHEN the `integration-tests` job runs
- THEN it MUST execute on both `ubuntu-latest` and `macos-latest`

#### Scenario: pnpm check consistency

- GIVEN any CI run
- WHEN the lint job runs
- THEN it MUST use `pnpm check` as the validation command
- AND `pnpm check` MUST include format checking, TypeScript build, and unit tests

### Requirement: CD Trigger on Release PR Merge

When a pull request whose title contains `Release v{version}` is merged, the CD pipeline MUST publish the packages to npm.

#### Scenario: Release PR merged

- GIVEN a Release PR (title containing `Release v{version}`) that was merged into `main`
- WHEN the merge event triggers `release.yml`
- THEN the workflow MUST publish all 4 packages to npm
- AND it MUST create a GitHub Release with the changelog

#### Scenario: Non-release PR merged

- GIVEN a PR with title `fix: resolve memory leak` that was merged into `main`
- WHEN the merge event triggers
- THEN the release workflow MUST NOT execute
