#!/bin/bash
# CTG Core — Build and Push Images to GitHub Container Registry
# Run this from your dev machine after changes. Clients pull the latest.
#
# Usage: ./push.sh [--tag v1.0.0]

set -euo pipefail

REGISTRY="ghcr.io/ccubillas21"
TAG="${1:-latest}"
[[ "$TAG" == "--tag" ]] && TAG="${2:-latest}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PLATFORMS="linux/amd64,linux/arm64"
BUILDER="multiarch"

# Ensure buildx builder exists
if ! docker buildx inspect "$BUILDER" &>/dev/null; then
  echo "Creating buildx builder '$BUILDER'..."
  docker buildx create --name "$BUILDER" --use
else
  docker buildx use "$BUILDER"
fi

echo "Building and pushing CTG Core images to $REGISTRY (platforms: $PLATFORMS)..."
echo ""

# Build + push Gatekeeper
echo "→ Building + pushing gatekeeper..."
docker buildx build --platform "$PLATFORMS" \
  -f Dockerfile.gatekeeper \
  -t "$REGISTRY/ctg-gatekeeper:$TAG" \
  --push .
echo "✓ gatekeeper:$TAG pushed"
echo ""

# Build + push OpenClaw
echo "→ Building + pushing openclaw..."
docker buildx build --platform "$PLATFORMS" \
  -f Dockerfile.openclaw \
  -t "$REGISTRY/ctg-openclaw:$TAG" \
  --push .
echo "✓ openclaw:$TAG pushed"
echo ""

# Build + push Mission Control
echo "→ Building + pushing mission-control..."
docker buildx build --platform "$PLATFORMS" \
  -f Dockerfile.mission-control \
  -t "$REGISTRY/ctg-mission-control:$TAG" \
  --push .
echo "✓ mission-control:$TAG pushed"
echo ""

echo "Done. Clients can deploy with:"
echo "  curl -sfL https://raw.githubusercontent.com/ccubillas21/ctg-core/master/deploy.sh | bash"
