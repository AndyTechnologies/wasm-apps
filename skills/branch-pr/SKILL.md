---
name: wasm-apps-branch-pr
description: 'Create pull requests for wasm-apps. Trigger: creating, opening, or preparing PRs for review.'
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: '2.0'
---

# wasm-apps — Branch & PR Skill

## When to Use

Load this skill whenever you need to:

- Create a branch for a new fix or feature
- Open a pull request on [AndyTechnologies/wasm-apps](https://github.com/AndyTechnologies/wasm-apps)
- Prepare changes for review

## Critical Rules

1. **Branch from `dev`, PR to `main`** — `dev` is the daily work branch. `main` is stable.
2. **Every PR must pass `pnpm check`** — format + build + unit tests must pass before opening.
3. **400-line review budget** — keep PRs within 400 changed lines (`additions + deletions`) or justify a `size:exception`.
4. **No `Co-Authored-By` trailers** — never add AI attribution to commits.
5. **No force-push to `main`** — protected branch.
6. **Conventional commits** — `tipo(scope): mensaje en español`

## Workflow

```
1. Create a branch from dev using the naming convention below
2. Implement changes following specs and design
3. Run checks: pnpm -r build && pnpm check
4. Commit using Conventional Commits format
5. Open a PR to main
6. CI checks must pass before merge
```

---

## Branch Naming

Branch names must match:

```
^(feat|fix|chore|docs|refactor)\/[a-z0-9._-]+$
```

| Type        | Example                            |
| ----------- | ---------------------------------- |
| `feat/`     | `feat/add-zig-codegen`             |
| `fix/`      | `fix/cache-hash-collision`         |
| `docs/`     | `docs/update-api-reference`        |
| `refactor/` | `refactor/extract-pipeline-stages` |
| `chore/`    | `chore/bump-wasmtime-version`      |

**Rules:**

- All lowercase
- Use hyphens, dots, or underscores as separators
- Description must be short and descriptive

---

## PR Body Format

```markdown
## Resumen

<!-- Clear description of what this PR does and why. -->

## Cambios

| Archivo / Área | Qué cambió  |
| -------------- | ----------- |
| `path/to/file` | Descripción |

## Verificación

- [ ] `pnpm -r build` pasa
- [ ] `pnpm check` pasa (format + build + unit tests)
- [ ] Tests de integración pasan (`pnpm test:integration`)
- [ ] Probado manualmente

## Notas

<!-- Breaking changes, dependencias externas, etc. -->
```

---

## Automated Checks

| Check                 | What It Verifies                             |
| --------------------- | -------------------------------------------- |
| **lint**              | Prettier format                              |
| **unit-tests**        | `vitest run` passes (ubuntu, macos, windows) |
| **integration-tests** | Build + run examples (ubuntu, macOS)         |
| **pnpm -r build**     | TypeScript compilation                       |

---

## Conventional Commits

```
tipo(scope): mensaje en español
```

**Types:** `feat | fix | chore | docs | refactor`
**Scopes:** `compiler | linker | cli | types | root`

Examples:

```
feat(compiler): agregar soporte para sourcemaps en modo debug
fix(linker): corregir orden topológico con dependencias circulares
docs(root): actualizar README con ejemplos de cross-compilación
```

---

## Commands

### Setup

```bash
git checkout dev && git pull
git checkout -b feat/<short-description>
```

### Testing

```bash
pnpm -r build
pnpm check
pnpm test:integration
```

### Open a PR

```bash
gh pr create \
  --repo AndyTechnologies/wasm-apps \
  --base main \
  --title "feat(scope): descripción corta" \
  --body "## Resumen\n\n..."
```
