# Cómo publicar una release

Guía paso a paso para publicar una nueva versión de `wasm-apps` a npm y GitHub.

## Requisitos

- Tener permisos de escritura en el repo
- Tener `gh` CLI autenticado (para monitorear)
- El PR con los cambios ya debe estar mergeado a `main`

## Flujo estándar (recomendado)

Las releases se disparan con **tags**, no con commits especiales ni PRs automáticos.

### 1. Determiná la versión

```bash
pnpm view @wasm-apps/cli version
```

Incrementá según semver: patch para bugfixes, minor para features, major para breaking.

### 2. Asegurate de estar en el commit correcto

El tag debe apuntar al merge commit más reciente de `main`:

```bash
git fetch origin main
git log origin/main --oneline -3
```

### 3. Creá y pusheá el tag

```bash
git tag v1.6.0
git push origin v1.6.0
```

Eso es todo. El workflow de Release hace el resto automáticamente.

### 4. Monitoreá

```bash
gh run list --workflow "Release" --limit 3
```

Si todo sale bien, en 2–3 minutos los packages están publicados en npm y la GitHub Release creada en:

```
https://github.com/AndyTechnologies/wasm-apps/releases/tag/v1.6.0
```

## Release manual (solo con autorización explícita)

Si por alguna razón excepcional no se puede usar un tag (rama alternativa, debug,
etc.), se puede disparar el release manualmente. Esto **solo debe hacerse con
autorización explícita del maintainer**.

```bash
gh workflow run "Release" --ref main -f version=1.6.0
```

El flag `-f version=1.6.0` es obligatorio (sin la "v").

## Solución de problemas

| Problema             | Solución                                                         |
| -------------------- | ---------------------------------------------------------------- |
| CI no pasó           | Arreglar, PR → merge a main, crear tag nuevo                     |
| Tag ya existe        | `git tag -d v1.6.0 && git push --delete origin v1.6.0` y recrear |
| Package ya publicado | npm no permite republicar misma versión; incrementar             |
| Workflow falló       | Revisar logs con `gh run view --log <run-id>`                    |

## Referencias

- [Workflow de Release](https://github.com/AndyTechnologies/wasm-apps/blob/main/.github/workflows/release.yml)
- [npm @wasm-apps/cli](https://www.npmjs.com/package/@wasm-apps/cli)
- [GitHub Releases](https://github.com/AndyTechnologies/wasm-apps/releases)
