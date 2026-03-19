#!/bin/bash
set -e

CONFIG="/home/node/.openclaw/openclaw.json"
SEED="/home/node/.openclaw/openclaw.seed.json"

# First boot: seed config if none exists
if [ ! -f "$CONFIG" ]; then
  echo "[ctg-core] First boot — seeding config from template..."
  cp "$SEED" "$CONFIG"

  # Substitute environment variables into config
  for var in ANTHROPIC_API_KEY PAPERCLIP_API_KEY PAPERCLIP_API_URL \
             OPENCLAW_AUTH_TOKEN COMPANY_ID PARENT_HUB_URL PARENT_HUB_TOKEN \
             GATEKEEPER_INTERNAL_TOKEN CTG_HUB_IP; do
    val="${!var}"
    if [ -n "$val" ]; then
      sed -i "s|\${${var}}|${val}|g" "$CONFIG"
    fi
  done
  echo "[ctg-core] Config seeded."
fi

# Index SOPs into QMD
if command -v qmd &>/dev/null; then
  echo "[ctg-core] Indexing SOPs into QMD..."
  qmd index /home/node/.openclaw/sops --collection corporate-sops 2>/dev/null || true
fi

echo "[ctg-core] Starting OpenClaw gateway..."
exec openclaw gateway --port "${OPENCLAW_PORT:-18789}"
