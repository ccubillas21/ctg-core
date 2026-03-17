#!/bin/bash
# CTG Core — Slack Bot Provisioning Script
# Configures OpenClaw for a new Slack bot (after manual Slack app creation)
#
# Usage: ./provision-slack-bot.sh <agent-id> "<display-name>" <account-name>
#
# Prerequisites: Slack app already created, tokens available

set -euo pipefail

AGENT_ID="${1:?Usage: $0 <agent-id> <display-name> <account-name>}"
DISPLAY_NAME="${2:?Usage: $0 <agent-id> <display-name> <account-name>}"
ACCOUNT_NAME="${3:?Usage: $0 <agent-id> <display-name> <account-name>}"

CONFIG="${OPENCLAW_CONFIG:-/home/ctg/.openclaw/openclaw.json}"
ACCOUNT_UPPER=$(echo "$ACCOUNT_NAME" | tr '[:lower:]' '[:upper:]')

echo "=== CTG Core: Slack Bot Provisioning ==="
echo "Agent:   $AGENT_ID"
echo "Name:    $DISPLAY_NAME"
echo "Account: $ACCOUNT_NAME"
echo ""

# Check config exists
if [ ! -f "$CONFIG" ]; then
  echo "ERROR: Config not found at $CONFIG"
  exit 1
fi

# Check jq available
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not installed"
  exit 1
fi

# Prompt for tokens
echo "Enter Bot Token (xoxb-...):"
read -r BOT_TOKEN
if [[ ! "$BOT_TOKEN" =~ ^xoxb- ]]; then
  echo "ERROR: Bot token must start with xoxb-"
  exit 1
fi

echo "Enter App Token (xapp-...):"
read -r APP_TOKEN
if [[ ! "$APP_TOKEN" =~ ^xapp- ]]; then
  echo "ERROR: App token must start with xapp-"
  exit 1
fi

# Update config: add Slack account
echo ""
echo "Updating openclaw.json..."

jq --arg name "$ACCOUNT_NAME" \
   --arg display "$DISPLAY_NAME" \
   --arg botVar "\${SLACK_BOT_TOKEN_${ACCOUNT_UPPER}}" \
   --arg appVar "\${SLACK_APP_TOKEN_${ACCOUNT_UPPER}}" \
   '.channels.slack.enabled = true |
    .channels.slack.mode = "socket" |
    .channels.slack.defaultAccount = (if .channels.slack.defaultAccount == "" then $name else .channels.slack.defaultAccount end) |
    .channels.slack.accounts[$name] = {
      "name": $display,
      "botToken": $botVar,
      "appToken": $appVar,
      "dmPolicy": "open",
      "allowFrom": ["*"],
      "groupPolicy": "open",
      "nativeStreaming": true,
      "streaming": "partial"
    }' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"

# Add binding
jq --arg agent "$AGENT_ID" \
   --arg account "$ACCOUNT_NAME" \
   '.bindings += [{"agentId": $agent, "match": {"channel": "slack", "accountId": $account}}]' \
   "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"

# Add tokens to .env
ENV_FILE="$(dirname "$CONFIG")/../../.env"
if [ -f "$ENV_FILE" ]; then
  echo "" >> "$ENV_FILE"
  echo "# Slack: $DISPLAY_NAME ($ACCOUNT_NAME)" >> "$ENV_FILE"
  echo "SLACK_BOT_TOKEN_${ACCOUNT_UPPER}=$BOT_TOKEN" >> "$ENV_FILE"
  echo "SLACK_APP_TOKEN_${ACCOUNT_UPPER}=$APP_TOKEN" >> "$ENV_FILE"
  echo "Tokens added to .env"
else
  echo ""
  echo "Add these to your .env file:"
  echo "  SLACK_BOT_TOKEN_${ACCOUNT_UPPER}=$BOT_TOKEN"
  echo "  SLACK_APP_TOKEN_${ACCOUNT_UPPER}=$APP_TOKEN"
fi

echo ""
echo "=== Provisioning complete ==="
echo ""
echo "Next steps:"
echo "  1. Restart OpenClaw: docker compose restart openclaw"
echo "  2. Test: Send a DM to '$DISPLAY_NAME' in Slack"
