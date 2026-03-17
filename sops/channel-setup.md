# SOP: Channel Setup (Slack / Teams)

**Owner:** Primary Agent
**Last Updated:** {{DEPLOY_DATE}}
**Approval Required:** Yes (channel credentials require human)

---

## Slack Setup

### Prerequisites
- Slack workspace admin access (human)
- Bot name and purpose decided

### Procedure

1. **Create Slack App** — Run `slack-provision` skill or follow manual steps:
   - Go to https://api.slack.com/apps → Create New App → From Scratch
   - Name the app, select workspace

2. **Configure Scopes** — Under OAuth & Permissions, add Bot Token Scopes:
   - `app_mentions:read`, `channels:history`, `channels:join`, `channels:read`
   - `chat:write`, `commands`, `emoji:read`, `files:read`, `files:write`
   - `groups:history`, `im:history`, `im:read`, `im:write`
   - `mpim:history`, `mpim:read`, `mpim:write`
   - `pins:read`, `pins:write`, `reactions:read`, `reactions:write`
   - `users:read`, `assistant:write`

3. **Enable Socket Mode** — Under Socket Mode → Enable
   - Generate App-Level Token with `connections:write` scope

4. **Enable Events** — Under Event Subscriptions → Enable
   - Subscribe to: `message.im`, `message.channels`, `message.groups`, `message.mpim`, `app_mention`

5. **Install to Workspace** — Install and copy Bot Token (`xoxb-...`) and App Token (`xapp-...`)

6. **Configure OpenClaw** — Add to openclaw.json:
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

7. **Add Binding** — Map agent to Slack account in bindings array

8. **Test** — Send a DM to the bot in Slack, verify response

### Critical Rules
- All policy keys go on the named account, NOT inherited from default
- Never create a tokenless default account
- Only valid top-level keys: `enabled`, `mode`, `accounts`, `defaultAccount`

---

## Teams Setup

### Prerequisites
- Azure subscription with Bot Service access (human)
- Microsoft 365 admin access for app sideloading

### Procedure

1. Run `teams-bot-provision` skill equivalent, or provision manually via Azure Portal
2. Create Azure AD App Registration (single-tenant)
3. Create Azure Bot resource (F0 free tier)
4. Enable Teams channel on the bot
5. Generate client secret
6. Configure OpenClaw msteams channel with credentials
7. Create Teams app manifest and sideload

---

## Verification

After any channel setup:
1. Bot appears online in the platform
2. Bot responds to direct message
3. Bot responds to @mention in a channel
4. Health check confirms channel active
