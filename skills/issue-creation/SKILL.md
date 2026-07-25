---
name: wasm-apps-issue-creation
description: 'Create issues for wasm-apps. Trigger: creating GitHub issues, bug reports, or feature requests.'
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: '1.0'
---

# wasm-apps — Issue Creation Skill

## When to Use

Load this skill whenever you need to:

- Report a bug in wasm-apps
- Request a new feature or enhancement
- Open any GitHub issue on the [AndyTechnologies/wasm-apps](https://github.com/AndyTechnologies/wasm-apps) repository

## Critical Rules

1. **Search first** — confirm the issue doesn't already exist.
2. **Use the GitHub tracker** — report bugs or suggest improvements via the GitHub issue tracker.
3. **Bug reports need repro steps** — include code, commands, and expected vs actual behavior.
4. **Feature requests need a problem statement** — describe the problem before the solution.

## Workflow

```
1. Search existing issues → confirm it's not a duplicate
2. Open a new issue with clear description
3. For bugs: include repro steps, environment, and expected vs actual behavior
4. For features: describe the problem, proposed solution, and alternatives considered
```

---

## Bug Report

### Required Fields

| Field              | Description                              |
| ------------------ | ---------------------------------------- |
| Bug Description    | Clear description of what the bug is     |
| Steps to Reproduce | Numbered steps to reproduce the behavior |
| Expected Behavior  | What should happen                       |
| Actual Behavior    | What actually happens                    |
| Environment        | OS, Node version, wasm-apps version      |
| Commands Log       | Full output of the failed command        |

### Example

```bash
gh issue create \
  --repo AndyTechnologies/wasm-apps \
  --title "fix(linker): cross-compilation fails on aarch64-linux" \
  --body "## Bug Description\n...\n## Steps to Reproduce\n...\n## Environment\n..."
```

---

## Feature Request

### Required Fields

| Field                   | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| Problem Statement       | What problem does this feature solve?                       |
| Proposed Solution       | Specific description — include example commands if relevant |
| Alternatives Considered | (optional) Other approaches you thought about               |

### Example

```bash
gh issue create \
  --repo AndyTechnologies/wasm-apps \
  --title "feat(compiler): add Rust strategy" \
  --body "## Problem\n...\n## Proposed Solution\n...\n## Alternatives\n..."
```

---

## Commands

### Search for Existing Issues

```bash
gh issue list --repo AndyTechnologies/wasm-apps --state open --search "your keywords"
```

### Create a Bug Report

```bash
gh issue create \
  --repo AndyTechnologies/wasm-apps \
  --title "fix(<scope>): <short description>" \
  --body "## Bug Description\n...\n## Steps to Reproduce\n...\n## Expected Behavior\n...\n## Actual Behavior\n..."
```

### Create a Feature Request

```bash
gh issue create \
  --repo AndyTechnologies/wasm-apps \
  --title "feat(<scope>): <short description>" \
  --body "## Problem Statement\n...\n## Proposed Solution\n...\n## Alternatives Considered\n..."
```
