#!/bin/bash
# CTG Core — First-Run Setup Script
# Interactive setup for new corporate deployment
#
# Usage: ./setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

echo "============================================"
echo "  CTG Core — Corporate Deployment Setup"
echo "============================================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is required but not installed"
  echo "Install: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! command -v docker compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
  echo "ERROR: Docker Compose v2 is required"
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "WARNING: jq not found — some skills may not work"
  echo "Install: sudo apt install jq"
fi

echo "Prerequisites OK"
echo ""

# Generate .env from template
if [ -f "$ENV_FILE" ]; then
  echo "WARNING: .env already exists"
  read -rp "Overwrite? (y/N): " OVERWRITE
  if [[ "$OVERWRITE" != "y" && "$OVERWRITE" != "Y" ]]; then
    echo "Keeping existing .env"
  else
    cp "$SCRIPT_DIR/.env.template" "$ENV_FILE"
  fi
else
  cp "$SCRIPT_DIR/.env.template" "$ENV_FILE"
fi

# Generate secure values
echo "Generating secure credentials..."

PG_PASSWORD=$(openssl rand -hex 24)
AUTH_TOKEN=$(openssl rand -hex 24)
COMPANY_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 16 | sed 's/\(.\{8\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)\(.\{12\}\)/\1-\2-\3-\4-\5/')

sed -i "s/PG_PASSWORD=CHANGE_ME_GENERATE_WITH_OPENSSL/PG_PASSWORD=$PG_PASSWORD/" "$ENV_FILE"
sed -i "s/OPENCLAW_AUTH_TOKEN=CHANGE_ME_GENERATE_WITH_OPENSSL/OPENCLAW_AUTH_TOKEN=$AUTH_TOKEN/" "$ENV_FILE"
sed -i "s/COMPANY_ID=CHANGE_ME_UUID/COMPANY_ID=$COMPANY_ID/" "$ENV_FILE"

echo "  PG Password:    generated"
echo "  Auth Token:     generated"
echo "  Company ID:     $COMPANY_ID"
echo ""

# Prompt for API key
echo "--- API Configuration ---"
read -rp "Anthropic API Key (sk-ant-...): " ANTHROPIC_KEY
if [ -n "$ANTHROPIC_KEY" ]; then
  sed -i "s|ANTHROPIC_API_KEY=sk-ant-CHANGE_ME|ANTHROPIC_API_KEY=$ANTHROPIC_KEY|" "$ENV_FILE"
  echo "  API Key:        set"
else
  echo "  WARNING: No API key provided. Agents will not work without it."
  echo "  Set ANTHROPIC_API_KEY in .env before starting."
fi
echo ""

# Prompt for parent hub
echo "--- Parent Hub Configuration ---"
read -rp "Parent Hub URL (press Enter for default): " HUB_URL
if [ -n "$HUB_URL" ]; then
  sed -i "s|PARENT_HUB_URL=https://hub.cubillastech.com|PARENT_HUB_URL=$HUB_URL|" "$ENV_FILE"
fi

read -rp "Parent Hub Management Token: " HUB_TOKEN
if [ -n "$HUB_TOKEN" ]; then
  sed -i "s|PARENT_HUB_TOKEN=CHANGE_ME_PROVIDED_BY_CTG|PARENT_HUB_TOKEN=$HUB_TOKEN|" "$ENV_FILE"
fi
echo ""

# Build and start
echo "--- Building & Starting Stack ---"
echo ""

cd "$SCRIPT_DIR"

echo "Building OpenClaw image..."
docker compose build openclaw

echo ""
echo "Starting services..."
docker compose up -d

echo ""
echo "Waiting for services to become healthy..."

# Wait for health checks (max 120 seconds)
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  HEALTHY=$(docker compose ps --format json 2>/dev/null | jq -r 'select(.Health == "healthy") | .Name' 2>/dev/null | wc -l || echo "0")
  TOTAL=$(docker compose ps --format json 2>/dev/null | jq -r '.Name' 2>/dev/null | wc -l || echo "0")

  if [ "$HEALTHY" -ge 4 ]; then
    echo "  All core services healthy ($HEALTHY/$TOTAL)"
    break
  fi

  echo "  Waiting... ($HEALTHY/$TOTAL healthy, ${ELAPSED}s elapsed)"
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo ""
  echo "WARNING: Some services may not be healthy yet."
  echo "Check status: docker compose ps"
  echo "Check logs:   docker compose logs"
fi

echo ""

# Seed Paperclip with company and agents
echo "--- Seeding Paperclip ---"
PAPERCLIP_URL="http://localhost:${PAPERCLIP_PORT:-13100}"

# Wait for Paperclip API
for i in $(seq 1 10); do
  if wget -qO- "$PAPERCLIP_URL/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# Create company
echo "Creating company..."
wget -qO- \
  --header="Content-Type: application/json" \
  --post-data="{\"id\":\"$COMPANY_ID\",\"name\":\"CTG Core Deployment\"}" \
  "$PAPERCLIP_URL/api/companies" 2>/dev/null || echo "  (company may already exist)"

# Register agents
for AGENT in primary engineer dispatch; do
  case $AGENT in
    primary)  TITLE="Communications & Triage Lead" ;;
    engineer) TITLE="Technical Specialist" ;;
    dispatch) TITLE="Operations & Automation Specialist" ;;
  esac

  echo "Registering agent: $AGENT ($TITLE)"
  wget -qO- \
    --header="Content-Type: application/json" \
    --post-data="{\"name\":\"$AGENT\",\"title\":\"$TITLE\",\"role\":\"general\",\"adapterType\":\"openclaw_gateway\"}" \
    "$PAPERCLIP_URL/api/companies/$COMPANY_ID/agents" 2>/dev/null || echo "  (agent may already exist)"
done

echo ""

# Index SOPs
echo "--- Indexing SOPs ---"
# QMD indexing happens automatically via the OpenClaw container entrypoint
echo "SOPs will be indexed by QMD on container startup"

echo ""
echo "============================================"
echo "  CTG Core — Setup Complete!"
echo "============================================"
echo ""
echo "Company ID: $COMPANY_ID"
echo ""
echo "Services:"
echo "  Paperclip:        http://localhost:${PAPERCLIP_PORT:-13100}"
echo "  Mission Control:  http://localhost:${MC_PORT:-14000}"
echo "  Gateway:          http://localhost:${GW_PORT:-28789}"
echo "  Parent Relay:     http://localhost:${RELAY_PORT:-19090}"
echo ""
echo "Next Steps:"
echo "  1. Connect Slack:  lobster run lobster/slack-setup.lobster --var agent_id=primary ..."
echo "  2. View dashboard: http://localhost:${MC_PORT:-14000}"
echo "  3. Check health:   curl http://localhost:${RELAY_PORT:-19090}/status"
echo ""
echo "Management:"
echo "  View logs:    docker compose logs -f"
echo "  Stop stack:   docker compose down"
echo "  Restart:      docker compose restart"
echo ""
