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

echo "Building and pushing CTG Core images to $REGISTRY..."
echo ""

# Build Gatekeeper
echo "→ Building gatekeeper..."
docker build -f Dockerfile.gatekeeper -t "$REGISTRY/ctg-gatekeeper:$TAG" .
echo "→ Pushing gatekeeper..."
docker push "$REGISTRY/ctg-gatekeeper:$TAG"
echo "✓ gatekeeper:$TAG pushed"
echo ""

# Build OpenClaw
echo "→ Building openclaw..."
docker build -f Dockerfile.openclaw -t "$REGISTRY/ctg-openclaw:$TAG" .
echo "→ Pushing openclaw..."
docker push "$REGISTRY/ctg-openclaw:$TAG"
echo "✓ openclaw:$TAG pushed"
echo ""

echo "Done. Clients can deploy with:"
echo "  curl -sL https://raw.githubusercontent.com/ccubillas21/ctg-core/main/deploy.sh | bash"
