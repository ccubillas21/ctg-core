# CTG Core v1.0 — Client Deployment Checklist

## Pre-Deployment (on your WSL)

### 1. Register Client in Hub
```bash
HUB_TOKEN="1605f7b58a561491836af54b398189a24e1734879467e32b"
COMPANY_ID=$(openssl rand -hex 16)
MGMT_TOKEN=$(openssl rand -hex 24)

curl -sf -X POST http://localhost:9100/api/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HUB_TOKEN" \
  -d "{
    \"id\": \"$COMPANY_ID\",
    \"name\": \"<CLIENT_NAME>\",
    \"management_token\": \"$MGMT_TOKEN\",
    \"contact_email\": \"<EMAIL>\",
    \"tailscale_ip\": \"<TAILSCALE_IP>\"
  }"
```

Save the Company ID and Management Token — you'll need them during deployment.

### 2. Register 3 Agents
```bash
for agent in \
  '{"name":"Aimee","role":"orchestrator","model_tier":"gpt-5.4","job_description":"Primary agent — orchestrates team, client communication, delegation"}' \
  '{"name":"CTO","role":"technical","model_tier":"sonnet","job_description":"Technical specialist — coding, architecture, system analysis"}' \
  '{"name":"Jr","role":"admin","model_tier":"gpt-4o-mini","job_description":"Admin and triage — email, web research, data gathering via quarantined subagents"}'; do
  curl -sf -X POST "http://localhost:9100/api/tenants/$COMPANY_ID/agents" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $HUB_TOKEN" \
    -d "$agent"
  echo ""
done
```

### 3. Create 3 Slack Bot Apps
For each agent (Aimee, CTO, Jr), create a Slack app at https://api.slack.com/apps:

**Per app:**
- Create New App → From Scratch → name it (e.g., "Aimee") → select client workspace
- **OAuth & Permissions** → Bot Token Scopes:
  - `chat:write`, `channels:read`, `channels:history`
  - `groups:read`, `groups:history`
  - `im:read`, `im:write`, `im:history`
  - `users:read`
- **Socket Mode** → Enable → generate App Token (name: "socket")
- **Event Subscriptions** → Enable → Subscribe to bot events:
  - `message.im`, `message.channels`, `message.groups`, `app_mention`
- **Install App** → Install to Workspace → copy Bot Token

**Collect per app:**
- Bot Token (`xoxb-...`)
- App Token (`xapp-...`)

### 4. Invite Client to Tailscale
- Go to https://login.tailscale.com/admin/invite
- Send invite to client's email
- They install Tailscale on their Mac and join your tailnet
- Note their Tailscale IP (100.x.x.x)

---

## Client Mac Setup

### 5. Prerequisites (client runs these)
- Install Docker Desktop
- Install Tailscale, join your tailnet
- Verify connectivity: `curl -sf http://<YOUR_WSL_TAILSCALE_IP>:9100/health`

### 6. Deploy (client runs this)
```bash
curl -sfLO https://raw.githubusercontent.com/ccubillas21/ctg-core/master/deploy.sh && bash deploy.sh
```

When prompted:
- **CTG Hub IP**: `100.96.180.83` (your WSL Tailscale IP)
- **Company ID**: (from step 1)
- **Hub Tenant Token**: (management token from step 1)

### 7. Add API Keys to .env
```bash
cd ~/.ctg-core
echo 'OPENAI_API_KEY=<your-openai-key>' >> .env
echo 'ANTHROPIC_API_KEY=<your-anthropic-key>' >> .env
docker compose up -d --force-recreate gatekeeper
```

**IMPORTANT:** `docker compose restart` does NOT reload .env changes. Must use `--force-recreate`.

### 8. Add Slack Tokens to OpenClaw Config
```bash
cd ~/.ctg-core

# Extract current config
docker exec ctg-openclaw cat /home/node/.openclaw/openclaw.json > /tmp/oc.json

# Edit /tmp/oc.json — add to channels.slack:
# {
#   "enabled": true,
#   "mode": "socket",
#   "streaming": "partial",
#   "nativeStreaming": true,
#   "defaultAccount": "aimee",
#   "accounts": {
#     "aimee": {
#       "name": "Aimee",
#       "botToken": "xoxb-...",
#       "appToken": "xapp-...",
#       "dmPolicy": "open",
#       "groupPolicy": "open",
#       "allowFrom": ["*"],
#       "allowBots": true
#     },
#     "cto": {
#       "name": "CTO",
#       "botToken": "xoxb-...",
#       "appToken": "xapp-...",
#       "dmPolicy": "open",
#       "groupPolicy": "open",
#       "allowFrom": ["*"],
#       "allowBots": true
#     },
#     "jr": {
#       "name": "Jr",
#       "botToken": "xoxb-...",
#       "appToken": "xapp-...",
#       "dmPolicy": "open",
#       "groupPolicy": "open",
#       "allowFrom": ["*"],
#       "allowBots": true
#     }
#   }
# }
#
# Add to bindings:
# {"agentId": "primary", "match": {"channel": "slack", "accountId": "aimee"}}
# {"agentId": "cto", "match": {"channel": "slack", "accountId": "cto"}}
# {"agentId": "jr", "match": {"channel": "slack", "accountId": "jr"}}

# Push config back and restart
docker cp /tmp/oc.json ctg-openclaw:/home/node/.openclaw/openclaw.json
docker restart ctg-openclaw
```

---

## Post-Deployment Verification

### 9. Check Services
```bash
docker compose ps
# All 4 should be running:
# ctg-openclaw    — healthy
# ctg-gatekeeper  — healthy
# ctg-mc          — running (healthcheck may show unhealthy — cosmetic)
# ctg-n8n         — running
```

### 10. Check Slack Connection
```bash
docker logs ctg-openclaw --tail 20 2>&1 | grep slack
# Should see: [slack] socket mode connected
```

### 11. Check Hub Phone-Home (from your WSL)
```bash
curl -sf http://localhost:9100/api/tenants/<COMPANY_ID> \
  -H "Authorization: Bearer 1605f7b58a561491836af54b398189a24e1734879467e32b"
# updated_at should be recent
```

### 12. Test LLM Routing
```bash
curl -s http://localhost:19090/health
# Should show: status: active, parentHub: configured
```

### 13. DM Each Agent in Slack
- DM Aimee → should respond
- DM CTO → should respond
- DM Jr → should respond

---

## Known Gotchas

1. **`docker compose restart` doesn't reload .env** — use `docker compose up -d --force-recreate <service>`
2. **Provider baseUrls must end with `/v1`** — e.g., `http://gatekeeper:9090/llm/openai/agents/primary/v1`
3. **OpenClaw needs `gateway-net`** — for Slack Socket Mode (needs internet to reach slack.com)
4. **Mission Control healthcheck** — uses `curl` not `wget` (nginx image)
5. **n8n first boot** — runs migrations, may show unhealthy for 60s
6. **Stale Docker volumes** — if redeploying, wipe with `docker compose down -v` first
7. **Slack app Event Subscriptions** — must subscribe to `message.im`, `message.channels`, `message.groups`, `app_mention`
8. **SSH over Tailscale** — didn't work in testing. Use LAN IP or have client run commands directly.

---

## Credentials Reference

| Item | Where to find |
|------|---------------|
| Hub Admin Token | systemd service: `ctg-hub.service` |
| Client Company ID | Generated during step 1 |
| Client Mgmt Token | Generated during step 1 |
| OpenAI API Key | Your OpenAI platform account |
| Anthropic API Key | Your Anthropic console |
| Slack Bot Tokens | api.slack.com → each app → OAuth & Permissions |
| Slack App Tokens | api.slack.com → each app → Basic Information → App-Level Tokens |

---

## Service Ports

| Service | Container Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| OpenClaw | 18789 | 28789 | Gateway (WebSocket) |
| Gatekeeper | 9090 | 19090 | LLM proxy + hub phone-home |
| Mission Control | 8080 | 14000 | Dashboard |
| n8n | 5678 | 5678 | Workflow automation |

## Hub Services (your WSL — 100.96.180.83)

| Service | Port | Purpose |
|---------|------|---------|
| Paperclip | 3101 | Shared agent registry |
| Hub API | 9100 | Tenant management, health, usage |
| Sanitizer | 9200 | Content classification (Nemotron) |
