#!/bin/bash
# CTG Core — Channel Bridge Script
# Adds a binding between an agent and a communication channel
#
# Usage: ./bridge-channel.sh <agent-id> <channel-type> <account-id>

set -euo pipefail

AGENT_ID="${1:?Usage: $0 <agent-id> <channel-type> <account-id>}"
CHANNEL_TYPE="${2:?Usage: $0 <agent-id> <channel-type> <account-id>}"
ACCOUNT_ID="${3:?Usage: $0 <agent-id> <channel-type> <account-id>}"

CONFIG="${OPENCLAW_CONFIG:-/home/ctg/.openclaw/openclaw.json}"

echo "=== CTG Core: Channel Bridge ==="
echo "Agent:   $AGENT_ID"
echo "Channel: $CHANNEL_TYPE"
echo "Account: $ACCOUNT_ID"
echo ""

# Validate channel type
case "$CHANNEL_TYPE" in
  slack|msteams|telegram) ;;
  *) echo "ERROR: channel-type must be slack, msteams, or telegram"; exit 1 ;;
esac

# Check config exists
if [ ! -f "$CONFIG" ]; then
  echo "ERROR: Config not found at $CONFIG"
  exit 1
fi

# Check agent exists in config
AGENT_EXISTS=$(jq -e --arg id "$AGENT_ID" '.agents.list[] | select(.id == $id)' "$CONFIG" 2>/dev/null) || true
if [ -z "$AGENT_EXISTS" ]; then
  echo "ERROR: Agent '$AGENT_ID' not found in config"
  exit 1
fi

# Check for duplicate binding
DUPE=$(jq -e --arg agent "$AGENT_ID" --arg channel "$CHANNEL_TYPE" --arg account "$ACCOUNT_ID" \
  '.bindings[] | select(.agentId == $agent and .match.channel == $channel and .match.accountId == $account)' \
  "$CONFIG" 2>/dev/null) || true
if [ -n "$DUPE" ]; then
  echo "WARNING: Binding already exists, skipping"
  exit 0
fi

# Add binding
jq --arg agent "$AGENT_ID" \
   --arg channel "$CHANNEL_TYPE" \
   --arg account "$ACCOUNT_ID" \
   '.bindings += [{"agentId": $agent, "match": {"channel": $channel, "accountId": $account}}]' \
   "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"

echo "Binding added successfully"
echo ""
echo "Next steps:"
echo "  1. Restart OpenClaw: docker compose restart openclaw"
echo "  2. Test by sending a message via $CHANNEL_TYPE"
