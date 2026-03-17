#!/bin/bash
# CTG Core — Bot Deployment Script
# Creates agent workspace, registers in Paperclip, updates OpenClaw config
#
# Usage: ./deploy-bot.sh <agent-name> "<agent-title>" <model-tier> "<purpose>"

set -euo pipefail

AGENT_NAME="${1:?Usage: $0 <agent-name> <agent-title> <model-tier> <purpose>}"
AGENT_TITLE="${2:?Usage: $0 <agent-name> <agent-title> <model-tier> <purpose>}"
MODEL_TIER="${3:?Usage: $0 <agent-name> <agent-title> <model-tier> <purpose>}"
PURPOSE="${4:?Usage: $0 <agent-name> <agent-title> <model-tier> <purpose>}"

CONFIG="${OPENCLAW_CONFIG:-/home/ctg/.openclaw/openclaw.json}"
AGENT_DIR="/home/ctg/.openclaw/agents/$AGENT_NAME"
PAPERCLIP_URL="${PAPERCLIP_API_URL:-http://paperclip:3100}"
COMPANY_ID="${PAPERCLIP_COMPANY_ID:-${COMPANY_ID:-}}"

echo "=== CTG Core: Bot Deployment ==="
echo "Agent:   $AGENT_NAME"
echo "Title:   $AGENT_TITLE"
echo "Model:   $MODEL_TIER"
echo "Purpose: $PURPOSE"
echo ""

# Validate model tier
case "$MODEL_TIER" in
  sonnet) MODEL="anthropic/claude-sonnet-4-6" ;;
  opus)   MODEL="anthropic/claude-opus-4-6" ;;
  haiku)  MODEL="anthropic/claude-haiku-4-5" ;;
  *) echo "ERROR: model-tier must be sonnet, opus, or haiku"; exit 1 ;;
esac

# Check agent doesn't already exist
if [ -d "$AGENT_DIR" ]; then
  echo "ERROR: Agent directory already exists: $AGENT_DIR"
  exit 1
fi

# Create workspace
echo "Creating workspace..."
mkdir -p "$AGENT_DIR/memory"

AGENT_UUID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 16 | sed 's/\(.\{8\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)\(.\{12\}\)/\1-\2-\3-\4-\5/')

cat > "$AGENT_DIR/SOUL.md" << EOF
# SOUL.md — $AGENT_NAME

**Name:** $AGENT_NAME
**Title:** $AGENT_TITLE
**Department:** Operations

## Your Purpose

$PURPOSE

## Your Constraints

- Follow all SOPs in the corporate knowledge base
- Escalate per escalation SOP when uncertain
- Never share credentials or API keys
EOF

cat > "$AGENT_DIR/AGENTS.md" << EOF
# AGENTS.md — $AGENT_NAME Workspace

**Agent:** $AGENT_NAME ($AGENT_TITLE)
**Model:** $MODEL_TIER

## QMD Collections
- \`/sops/\` — Standard operating procedures
- \`/lobster/\` — Workflow definitions
EOF

cat > "$AGENT_DIR/IDENTITY.md" << EOF
# IDENTITY.md — $AGENT_NAME

**Name:** $AGENT_NAME
**Title:** $AGENT_TITLE
**Role:** General Agent
**Agent ID:** \`$AGENT_UUID\`
EOF

echo "Workspace created: $AGENT_DIR"

# Register in Paperclip
if [ -n "$COMPANY_ID" ]; then
  echo "Registering in Paperclip..."
  RESPONSE=$(wget -qO- \
    --header="Content-Type: application/json" \
    --post-data="{\"name\":\"$AGENT_NAME\",\"title\":\"$AGENT_TITLE\",\"role\":\"general\",\"capabilities\":\"$PURPOSE\",\"adapterType\":\"openclaw_gateway\"}" \
    "$PAPERCLIP_URL/api/companies/$COMPANY_ID/agents" 2>/dev/null) || true

  if [ -n "$RESPONSE" ]; then
    PAPERCLIP_ID=$(echo "$RESPONSE" | jq -r '.id // empty')
    echo "Paperclip agent ID: $PAPERCLIP_ID"
  else
    echo "WARNING: Paperclip registration failed (service may be unavailable)"
  fi
fi

# Update OpenClaw config
if [ -f "$CONFIG" ]; then
  echo "Updating OpenClaw config..."
  jq --arg id "$AGENT_NAME" \
     --arg model "$MODEL" \
     --arg dir "$AGENT_DIR" \
     '.agents.list += [{
        "id": $id,
        "name": $id,
        "workspace": $dir,
        "agentDir": $dir,
        "model": {"primary": $model},
        "tools": {"allow": ["lobster", "qmd", "paperclip"], "fs": {"workspaceOnly": true}}
      }]' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
  echo "Config updated"
fi

echo ""
echo "=== Deployment complete ==="
echo ""
echo "Agent:       $AGENT_NAME"
echo "UUID:        $AGENT_UUID"
echo "Model:       $MODEL"
echo "Workspace:   $AGENT_DIR"
echo ""
echo "Next steps:"
echo "  1. Connect a channel: lobster run slack-setup.lobster --var agent_id=$AGENT_NAME ..."
echo "  2. Restart OpenClaw: docker compose restart openclaw"
