# SKILL: Slack Provision

**Purpose:** Create and configure a Slack app for a new bot agent.
**Owner:** Primary Agent
**Trigger:** Manual (agent or human request)

---

## Overview

This skill guides the setup of a new Slack app and connects it to an OpenClaw agent. It covers app creation, scope configuration, Socket Mode, event subscriptions, and OpenClaw binding.

## Usage

```bash
# Via Lobster workflow (preferred)
lobster run slack-setup.lobster \
  --var agent_id="<agent>" \
  --var bot_name="<Display Name>" \
  --var account_name="<config-key>"

# Via script (basic automation)
./scripts/provision-slack-bot.sh <agent-id> "<Display Name>" <account-name>
```

## Prerequisites

- Slack workspace admin access (human required)
- Agent already created in OpenClaw config
- API key configured for the agent's model

## Step-by-Step Procedure

### 1. Create Slack App
- Go to https://api.slack.com/apps
- Click "Create New App" → "From Scratch"
- Enter app name and select workspace
- Note the App ID

### 2. Configure Bot Token Scopes
Under OAuth & Permissions → Bot Token Scopes, add all 22 required scopes:

```
app_mentions:read    channels:history    channels:join       channels:read
chat:write           commands            emoji:read          files:read
files:write          groups:history      im:history          im:read
im:write             mpim:history        mpim:read           mpim:write
pins:read            pins:write          reactions:read      reactions:write
users:read           assistant:write
```

### 3. Enable Socket Mode
- Go to Socket Mode → Enable Socket Mode
- Generate App-Level Token with `connections:write` scope
- Copy the token (`xapp-1-...`)

### 4. Enable Event Subscriptions
- Go to Event Subscriptions → Enable Events
- Subscribe to bot events:
  - `message.im`
  - `message.channels`
  - `message.groups`
  - `message.mpim`
  - `app_mention`

### 5. Install to Workspace
- Go to Install App → Install to Workspace
- Authorize the app
- Copy Bot User OAuth Token (`xoxb-...`)

### 6. Configure OpenClaw
Add tokens to `.env`:
```bash
SLACK_BOT_TOKEN_<NAME>=xoxb-...
SLACK_APP_TOKEN_<NAME>=xapp-...
```

Add to openclaw.json (or run the script):
```json
"slack": {
  "enabled": true,
  "mode": "socket",
  "accounts": {
    "<account-name>": {
      "name": "<Display Name>",
      "botToken": "${SLACK_BOT_TOKEN_<NAME>}",
      "appToken": "${SLACK_APP_TOKEN_<NAME>}",
      "dmPolicy": "open",
      "allowFrom": ["*"],
      "groupPolicy": "open",
      "nativeStreaming": true,
      "streaming": "partial"
    }
  },
  "defaultAccount": "<account-name>"
}
```

### 7. Add Binding
```json
{"agentId": "<agent-id>", "match": {"channel": "slack", "accountId": "<account-name>"}}
```

### 8. Restart & Test
```bash
docker compose restart openclaw
```
Send a DM to the bot in Slack to verify.

## Critical Rules

- **All policy keys on the named account** — NOT inherited from `default`
- **No ghost default account** — A tokenless default breaks everything
- **No top-level cruft keys** — Only: `enabled`, `mode`, `accounts`, `defaultAccount`
- **Never run `openclaw doctor --fix`** — Creates ghost accounts

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Bot online but no response | Missing event subscriptions | Add all 5 events |
| "invalid_auth" error | Wrong token type | Bot Token = xoxb, App Token = xapp |
| Socket disconnects | Missing connections:write scope | Regenerate app token with scope |
| Policy keys ignored | Keys on wrong level | Move to named account object |
