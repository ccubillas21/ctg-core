# SKILL: Channel Bridge

**Purpose:** Connect a communication channel (Slack, Teams, Telegram) to an existing agent.
**Owner:** Primary Agent
**Trigger:** Manual or via Lobster workflow

---

## Overview

This skill adds a binding between an agent and a communication channel account. The channel must already be configured in OpenClaw (tokens set up). This skill just creates the routing.

## Usage

```bash
# Via Lobster workflow (preferred — includes approval gate)
lobster run channel-bridge.lobster \
  --var agent_id="primary" \
  --var channel_type="slack" \
  --var account_id="assistant"

# Via script (direct)
./scripts/bridge-channel.sh <agent-id> <channel-type> <account-id>
```

## Supported Channels

| Channel | Type Key | Prerequisites |
|---------|----------|---------------|
| Slack | `slack` | Slack app created, tokens in .env, account in openclaw.json |
| Teams | `msteams` | Azure bot provisioned, credentials configured |
| Telegram | `telegram` | Bot token from @BotFather, configured in openclaw.json |

## What Gets Created

A binding entry in openclaw.json:
```json
{
  "agentId": "<agent-id>",
  "match": {
    "channel": "<channel-type>",
    "accountId": "<account-id>"
  }
}
```

## Procedure

### For Slack
1. Ensure Slack app is set up (use `slack-provision` skill if not)
2. Run bridge script or workflow
3. Restart OpenClaw
4. Test with a DM

### For Teams
1. Ensure Azure bot is provisioned
2. Run bridge script with `channel_type=msteams`
3. Restart OpenClaw
4. Test with a Teams message

### For Telegram
1. Create bot via @BotFather
2. Add bot token to openclaw.json telegram channel config
3. Run bridge script with `channel_type=telegram`
4. Restart OpenClaw
5. Test with `/start` in Telegram
