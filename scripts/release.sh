#!/usr/bin/env bash
set -euo pipefail

# release.sh — Create a release tag and push it
# Usage: ./scripts/release.sh 1.6.0

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "❌ Uso: ./scripts/release.sh <semver>"
  echo "   Ej:  ./scripts/release.sh 1.6.0"
  exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ La versión '$VERSION' no cumple X.Y.Z"
  exit 1
fi

TAG="v$VERSION"

# --- Validaciones ---

# El tag no debe existir
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "❌ El tag $TAG ya existe localmente"
  exit 1
fi

# Asegurar que estamos en main
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "⚠️  Estás en '$BRANCH', no en 'main'."
  echo "   El tag se creará en este branch igual, pero lo recomendado es main."
  echo ""
  read -rp "¿Crear tag en $BRANCH igual? (s/N): " CONFIRM
  if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
    echo "❌ Cancelado"
    exit 1
  fi
fi

# Fetch latest
echo "📡 Fetching origin..."
git fetch origin

COMMIT=$(git rev-parse HEAD)

echo ""
echo "📦 Release: $TAG"
echo "   Branch:  $BRANCH"
echo "   Commit:  ${COMMIT:0:10}"
echo ""

# --- Crear tag ---
git tag "$TAG"
echo "✅ Tag $TAG creado localmente"

# --- Push ---
echo ""
echo "📤 Pusheando tag..."
git push origin "$TAG"
echo "✅ Tag $TAG pusheado — release en progreso"
echo ""
echo "🔗 https://github.com/AndyTechnologies/wasm-apps/actions/workflows/release.yml"
echo ""
echo "Podés monitorear con:"
echo "  gh run list --workflow 'Release' --limit 3"
