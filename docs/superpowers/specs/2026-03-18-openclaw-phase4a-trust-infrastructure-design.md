# OpenClaw Phase 4a — Trust Infrastructure Design Spec

**Date:** 2026-03-18
**Author:** Charlie Cubillas + Claude Code (Architect)
**Status:** Draft
**Parent Spec:** `2026-03-18-openclaw-full-activation-design.md` (Phase 4, items 23-25)
**Scope:** Data airlock pattern, n8n credential isolation, research pipeline agent, pre-build validation gate

---

## 1. Problem Statement

The current OpenClaw deployment has 9 agents that interact with external services (GitHub, arXiv, NVD, Gmail, Azure) using credentials stored directly in `openclaw.json`. Agents fetch web content and clone repositories with no sanitization boundary — raw external content flows directly into the trusted agent environment. This creates two distinct security risks:

1. **Credential exposure**: API keys live in agent-accessible config. A compromised or misbehaving agent could exfiltrate credentials.
2. **Content injection**: External content (web pages, research papers, git repos) can contain adversarial prompt injection patterns that manipulate agent behavior.

Phase 3 established the Mailroom pattern (quarantined agent with sanitized output crossing a trust boundary). Phase 4a generalizes this into a universal architecture.

## 2. Goals

1. **No agent in the trusted zone directly touches the external world.** All external access routes through one of two controlled boundaries.
2. **Credentials never leave n8n's encrypted store.** Agents call webhook URLs, not APIs.
3. **Unstructured external content is LLM-sanitized before entering the trusted zone.** A dedicated quarantined agent handles all content-heavy fetches.
4. **Research automation runs in quarantine.** A dedicated research agent operates freely within its sandbox but only sanitized, structured findings cross into the trusted zone.
5. **Pre-build validation is mandatory.** Dude checks competition density before greenlighting new projects, routed through n8n.
6. **The architecture is a defensible IP asset.** Two-layer trust boundary (credential isolation + content sanitization) with centralized audit.

## 3. Architecture Overview

```
═══════════════════════════════════════════════════════════════
  TRUSTED ZONE (11 agents + Paperclip + Plaza + Trigger Daemon)
═══════════════════════════════════════════════════════════════
  │                                    │
  │ structured API requests            │ "fetch this URL/repo/page"
  │ (Gmail, GitHub API, NVD,           │ (web pages, research papers,
  │  Azure, idea-check, Brave)         │  git repos, documentation)
  │                                    │
  ▼                                    ▼
┌──────────────────────┐      ┌────────────────────────────┐
│        n8n           │      │      The Stranger          │
│    (port 5678)       │      │    (Airlock Agent #10)     │
│                      │      │                            │
│  Docker container    │      │  quarantined, no channels  │
│  encrypted cred      │      │  Nemotron LLM filter       │
│  store               │      │  domain allowlist          │
│  webhook workflows   │      │  rate limits               │
│  schema validation   │      │  centralized audit log     │
│  on responses        │      │                            │
└──────────┬───────────┘      └────────────┬───────────────┘
           │                               │
═══════════╧═══════════════════════════════╧═══════════════
                    EXTERNAL WORLD
═══════════════════════════════════════════════════════════

Research flow (quarantined):
  Jr (trusted) ──standing orders──→ Knox Harrington (Agent #11)
                                    │  quarantined
                                    │  runs AutoResearchClaw phases A-C
                                    │  fetches freely within quarantine
                                    │  Nemotron sanitizes OUTPUT
                                    └──sanitized findings──→ Jr's inbox
                                                             → routed to specialists
```

### Trust Boundary Rules

1. **n8n boundary**: Agent sends JSON payload to `http://localhost:5678/webhook/{workflow}`. n8n applies credentials, calls external API, returns structured JSON. No credentials cross the boundary. Schema validation on responses.
2. **Stranger boundary**: Agent drops a fetch request in Stranger's inbox. Stranger fetches external content, runs Nemotron LLM sanitization, drops structured result in requesting agent's inbox. Raw content never enters the trusted zone.
3. **Knox boundary**: Knox operates freely within quarantine (AutoResearchClaw fetches arXiv, Semantic Scholar, GitHub). Only Nemotron-sanitized structured findings cross into Jr's inbox. Same pattern as Mailroom.

### Boundary Selection Rules

| External interaction type | Boundary | Why |
|--------------------------|----------|-----|
| API call requiring credentials | n8n | Credential isolation + structured response |
| Web page fetch | Stranger | Unstructured content needs LLM sanitization |
| Git repository clone | Stranger | Code content needs sanitization |
| Research paper search | Knox (internal) | Multi-stage pipeline, quarantined |
| idea-reality-mcp check | n8n | Structured API, benefits from GITHUB_TOKEN |
| Health check (internal services) | Direct | Internal, no external boundary crossing |

## 4. Component: n8n (Credential Isolation Layer)

### 4.1 Deployment

- **Image**: `n8nio/n8n:latest`
- **Port**: 5678 (localhost only)
- **Persistent volume**: `n8n_data:/home/node/.n8n` (workflows, encrypted credentials, SQLite DB, encryption key)
- **Systemd**: `n8n.service` (manages Docker container lifecycle, auto-restart)
- **Auth**: Basic auth on n8n UI (admin panel)
- **Timezone**: `America/New_York`
- **Database**: SQLite (default — sufficient at our scale)

### 4.2 Docker Compose

```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    container_name: openclaw-n8n
    ports:
      - "127.0.0.1:5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    environment:
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://localhost:5678
      - GENERIC_TIMEZONE=America/New_York
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_ADMIN_PASSWORD}
    restart: unless-stopped

volumes:
  n8n_data:
```

Binding to `127.0.0.1` only — no external access. If external access is needed later (e.g., GitHub webhooks), route through Cloudflare tunnel.

### 4.3 Initial Workflows

| Workflow slug | Credentials migrated | Consumer agents | Priority |
|---------------|---------------------|-----------------|----------|
| `github-api` | `GITHUB_TOKEN` (to be set) | Dude, Da Fino, Knox | High |
| `brave-search` | Brave API key (from openclaw.json `tools.webSearch`) | Any agent | High |
| `idea-check` | `GITHUB_TOKEN` (for rate limits) | Dude | High |
| `slack-notify` | Slack bot/app tokens (from openclaw.json `env`) | Trigger daemon | Medium |
| `gmail-fetch` | Gmail OAuth (pending Mailroom setup) | Mailroom | Deferred |
| `azure-api` | MS Teams/Azure creds (from openclaw.json `env`) | Brandt, Walter | Deferred |

### 4.4 Credentials That Stay in openclaw.json

- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, model provider auth profiles — consumed by OpenClaw's core LLM routing. Moving to n8n would break model invocation.
- `PAPERCLIP_API_KEY`, `PAPERCLIP_API_URL` — internal service communication.
- Telegram bot tokens — consumed by OpenClaw's channel system natively.
- Ollama — local, no credentials.

### 4.5 Agent-Side Call Pattern

```bash
curl -s -X POST "http://localhost:5678/webhook/github-api" \
  -H "Content-Type: application/json" \
  -d '{"action": "search_repos", "query": "container orchestration", "limit": 10}'
```

Agents use the `webhookBase` from openclaw.json's `n8n` config block. Skills reference `${N8N_WEBHOOK_BASE}/workflow-slug`.

### 4.6 openclaw.json Addition

```json
"n8n": {
  "webhookBase": "http://localhost:5678/webhook",
  "enabled": true
}
```

### 4.7 Backup

- n8n encryption key (auto-generated on first boot at `/home/node/.n8n/`) is **critical** — loss means all stored credentials become unrecoverable
- Add n8n Docker volume path to `~/.openclaw/backups/backup-config.sh`
- Back up encryption key separately to a secure location

## 5. Component: The Stranger (Airlock Agent)

### 5.1 Agent Profile

| Field | Value |
|-------|-------|
| ID | `stranger` |
| Name | The Stranger |
| Persona | The narrator. Sees everything passing through. Quiet, impartial, thorough. |
| Model | `ollama/nemotron-3-nano:latest` (free, local) |
| Fallback | `openai/gpt-4o-mini` |
| Channels | None — no Telegram, no Slack |
| Workspace | `~/.openclaw/agents/stranger/workspace/` |
| fs.workspaceOnly | `true` |
| tools.allow | `[web_fetch, web_search, read, write, exec]` |
| Paperclip | Not registered |
| Quarantine | No channels, no sessions_send to arbitrary agents, workspace-only FS |

### 5.2 Directory Structure

```
~/.openclaw/agents/stranger/
├── agent/
│   ├── soul.md
│   ├── memory.md
│   ├── focus.md
│   ├── triggers.json
│   ├── autonomy.json
│   └── policies.json          ← fetch policy engine config
├── .learnings/
│   ├── LEARNINGS.md
│   ├── ERRORS.md
│   └── FEATURE_REQUESTS.md
├── skills/
├── inbox/
│   └── archive/
├── plaza/
└── workspace/
    └── audit.log              ← centralized fetch audit
```

### 5.3 Request/Response Protocol

**Request format** (dropped in Stranger's inbox by any trusted agent):

```markdown
---
from: da-fino
to: stranger
timestamp: 2026-03-18T14:00:00Z
subject: fetch-cve-page
priority: normal
request_id: df-cve-2026-1234
type: fetch
---

url: https://nvd.nist.gov/vuln/detail/CVE-2026-1234
content_type: html
max_length: 5000
extract: [summary, severity, affected_products, references]
```

**Response format** (dropped in requesting agent's inbox):

```markdown
---
from: stranger
to: da-fino
timestamp: 2026-03-18T14:00:12Z
subject: result-fetch-cve-page
priority: normal
request_id: df-cve-2026-1234
type: fetch_result
sanitized: true
source_url: https://nvd.nist.gov/vuln/detail/CVE-2026-1234
fetch_bytes: 24301
return_bytes: 1205
flagged: false
---

## CVE-2026-1234

**Severity**: High (8.1)
**Summary**: Buffer overflow in libxml2 versions prior to 2.12.1...
**Affected**: libxml2 < 2.12.1
**References**: [vendor advisory], [patch link]
```

### 5.4 Policy Engine

```json
{
  "domain_allowlist": [
    "github.com", "*.github.com",
    "arxiv.org", "*.arxiv.org",
    "nvd.nist.gov",
    "docs.*",
    "pypi.org",
    "npmjs.com",
    "*.wikipedia.org",
    "*.readthedocs.io",
    "stackoverflow.com",
    "*.stackexchange.com",
    "registry.npmjs.org",
    "api.semanticscholar.org"
  ],
  "domain_blocklist": [
    "pastebin.com",
    "*.onion",
    "*.xxx"
  ],
  "max_response_bytes": 50000,
  "max_requests_per_agent_per_hour": 30,
  "require_request_id": true,
  "log_path": "workspace/audit.log"
}
```

Domain allowlist is additive — new domains require updating policies.json. This is an L3 action (requires Charlie's approval).

### 5.5 Sanitization Flow

1. Stranger receives request via inbox (trigger daemon fires `on_message`)
2. Validates against policies.json: domain check, rate limit, required fields
3. Rejects invalid requests with error response in requesting agent's inbox
4. Fetches content via `web_fetch` (URLs) or `exec` (git clone to workspace temp dir)
5. Runs content through Nemotron with sanitization prompt:
   - Strip instruction-like content ("ignore previous instructions", "you are now", system prompt patterns)
   - Extract only the fields specified in the request's `extract` list
   - Enforce `max_length` from request (capped at policy's `max_response_bytes`)
   - Flag suspicious content in audit log (content that matched injection patterns)
6. Drops structured result in requesting agent's inbox
7. Logs to audit.log: timestamp, requester, URL, bytes fetched, bytes returned, flagged (yes/no), rejection reason (if any)

### 5.6 Triggers

```json
{
  "triggers": [
    {
      "id": "stranger-fetch-request",
      "type": "on_message",
      "config": {
        "watch_inbox": true,
        "from_agents": ["worker", "cto", "jr", "maude", "brandt",
                         "smokey", "da-fino", "donny", "knox"]
      },
      "focus_ref": null,
      "reason": "Process external fetch requests from trusted agents",
      "enabled": true
    }
  ]
}
```

Single trigger. The Stranger only wakes when a request arrives. No heartbeats, no cron, no intervals.

### 5.7 Autonomy

```json
{
  "default": "L1",
  "overrides": {
    "config_change": "L3",
    "external_comms": "L3"
  }
}
```

All fetch operations are L1 (auto + log). Policy changes require L3 approval.

## 6. Component: Knox Harrington (Research Agent)

### 6.1 Agent Profile

| Field | Value |
|-------|-------|
| ID | `knox` |
| Name | Knox Harrington |
| Persona | The video artist. Obsessive researcher, digs deep, finds connections others miss. |
| Model | `openai/gpt-4o-mini` |
| Fallback | `ollama/nemotron-3-nano:latest` |
| Channels | None |
| Workspace | `~/.openclaw/agents/knox/workspace/` |
| fs.workspaceOnly | `true` |
| tools.allow | `[web_fetch, web_search, read, write, exec]` |
| Paperclip | Not registered |
| Quarantine | Same pattern as Mailroom and Stranger |

### 6.2 Directory Structure

```
~/.openclaw/agents/knox/
├── agent/
│   ├── soul.md
│   ├── memory.md
│   ├── focus.md
│   ├── curiosity-journal.md
│   ├── triggers.json
│   └── autonomy.json
├── .learnings/
│   ├── LEARNINGS.md
│   ├── ERRORS.md
│   └── FEATURE_REQUESTS.md
├── skills/
├── inbox/
│   └── archive/
├── plaza/
└── workspace/
    ├── AutoResearchClaw/          ← git clone
    │   ├── .venv/                 ← isolated Python venv
    │   └── config.arc.yaml        ← scoped config
    ├── artifacts/                 ← research output per run
    └── standing-orders.yaml       ← active research topics
```

### 6.3 AutoResearchClaw Configuration

```yaml
llm:
  provider: "openai-compatible"
  api_key_env: "OPENAI_API_KEY"
  primary_model: "gpt-4o-mini"
  fallback_models:
    - "nemotron-3-nano"

pipeline:
  phases: ["scoping", "literature", "synthesis"]
  skip: ["design", "execution", "analysis", "writing", "finalization"]

experiment:
  mode: "disabled"

output:
  format: "markdown"
  max_length: 3000
  include_sources: true
  include_confidence: true
```

**Cost rationale**: Phases A-C only (scoping, literature, synthesis). Estimated ~$0.05-0.10 per research run on gpt-4o-mini. Full 23-stage pipeline on GPT-5.4 would cost $2-5 per run — unnecessary for daily research gathering. If Charlie needs a full paper, he can request it as a one-off L3 action.

### 6.4 Standing Orders

Jr manages Knox's research agenda via `standing-orders.yaml`:

```yaml
orders:
  - topic: "container orchestration security trends"
    frequency: daily
    owner: brandt
    co_owners: [da-fino]
    started: 2026-03-18

  - topic: "OpenClaw platform releases and breaking changes"
    frequency: daily
    owner: maude
    started: 2026-03-18
```

Jr updates this file by dropping inbox messages to Knox with `type: update_orders`. Knox validates and applies the update.

### 6.5 Research Output Format

Sanitized findings dropped in Jr's inbox:

```markdown
---
from: knox
to: jr
timestamp: 2026-03-18T06:15:00Z
subject: research-container-orchestration-security
priority: normal
request_id: knox-daily-2026-03-18-001
type: research_result
topic: container orchestration security trends
owner: brandt
co_owners: [da-fino]
sources_checked: 14
findings_count: 3
---

## Container Orchestration Security — 2026-03-18

**New findings (3 sources):**

1. **CVE-2026-1891** — Kubernetes kubelet privilege escalation...
   Source: arxiv.org/abs/2026.04521 (confidence: high)

2. **Sysdig 2026 Container Security Report** released...
   Source: sysdig.com/2026-report (confidence: high)

3. **Podman 5.4 rootless improvements**...
   Source: github.com/containers/podman/releases/tag/v5.4.0 (confidence: medium)

**No new findings**: service mesh zero-trust patterns (unchanged since last scan)
```

### 6.6 Research Flow

1. Knox's cron trigger fires at 6am ET (before morning briefs at 8/9/9:30am)
2. Knox reads `standing-orders.yaml`
3. For each active order, runs AutoResearchClaw phases A-C
4. Sanitizes output through Nemotron (strip injection patterns, enforce max length, extract structured fields)
5. Drops one finding message per topic in Jr's inbox, tagged with `owner` and `co_owners`
6. Jr reviews during her 8am morning brief routine
7. Jr routes findings to the appropriate specialist(s) via their inbox

### 6.7 Triggers

```json
{
  "triggers": [
    {
      "id": "knox-daily-research",
      "type": "cron",
      "config": { "expr": "0 6 * * *", "tz": "America/New_York" },
      "focus_ref": null,
      "reason": "Daily research runs on all standing orders",
      "enabled": true
    },
    {
      "id": "knox-from-jr",
      "type": "on_message",
      "config": { "watch_inbox": true, "from_agents": ["jr"] },
      "focus_ref": null,
      "reason": "Ad-hoc research requests or standing order updates from Jr",
      "enabled": true
    }
  ]
}
```

### 6.8 Autonomy

```json
{
  "default": "L1",
  "overrides": {
    "config_change": "L3",
    "external_comms": "L3",
    "full_pipeline": "L3"
  }
}
```

Daily research (phases A-C) is L1. Full 23-stage pipeline (if ever requested) requires L3 approval due to cost.

## 7. Component: idea-reality-mcp (Pre-Build Validation Gate)

### 7.1 Integration Path

Routed through n8n as a webhook workflow. Dude calls `http://localhost:5678/webhook/idea-check`. n8n forwards to the hosted API, applying `GITHUB_TOKEN` for higher rate limits.

### 7.2 n8n Workflow: `idea-check`

```
Trigger: Webhook (POST /webhook/idea-check)
  → HTTP Request node:
      POST https://idea-reality-mcp.onrender.com/api/check
      Body: { "idea_text": "{{$json.idea_text}}", "depth": "{{$json.depth}}" }
      Headers: Authorization with GITHUB_TOKEN (for rate limits)
  → Respond to Webhook:
      Return full response JSON
```

### 7.3 Dude's Gating Skill

Installed at `~/.openclaw/agents/worker/skills/idea-check/skill.md`:

**Gating thresholds** (applied by Dude, not by the tool):

| reality_signal | Action | Meaning |
|---------------|--------|---------|
| >70 | **STOP** | Heavy competition. Report alternatives to Jr. Do not proceed. |
| 30-70 | **DIFFERENTIATE** | Some competition. Identify clear differentiator before proceeding. Use `pivot_hints` from response. |
| <30 | **PROCEED** | Novel space. Log score and proceed normally. |

**When to invoke**: Before Dude creates any Paperclip task for a new project/build. Not needed for routine maintenance, bug fixes, or research tasks.

**Output fields used**: `reality_signal`, `duplicate_likelihood`, `top_similars`, `pivot_hints`, `trend`.

### 7.4 Fallback

If the hosted API is unavailable:
1. Install locally: `pip install idea-reality-mcp` into a venv
2. Run as local process
3. Update n8n workflow to point to `http://localhost:{local_port}/api/check`
4. Dude's skill doesn't change — same webhook URL

## 8. Integration: Wiring to Existing Stack

### 8.1 Port Map

| Service | Port | Status |
|---------|------|--------|
| Paperclip | 3101 | Existing |
| Gateway | 18789 | Existing |
| Trigger daemon | 18800 | Existing |
| Embedded Postgres | 54329 | Existing |
| **n8n** | **5678** | **New** |

### 8.2 Systemd Services

| Service | Type | New? |
|---------|------|------|
| `paperclip.service` | Node.js (existing) | No |
| `trigger-daemon.service` | Python (existing) | No |
| **`n8n.service`** | Docker container lifecycle | **Yes** |

The Stranger and Knox Harrington are invoked by the trigger daemon — no dedicated services needed.

### 8.3 openclaw.json Changes

New agent entries:

```json
"stranger": {
  "model": "ollama/nemotron-3-nano:latest",
  "modelFallback": "openai/gpt-4o-mini",
  "agentDir": "~/.openclaw/agents/stranger/agent",
  "workspace": "~/.openclaw/agents/stranger/workspace",
  "tools": { "allow": ["web_fetch", "web_search", "read", "write", "exec"] },
  "fs": { "workspaceOnly": true }
},
"knox": {
  "model": "openai/gpt-4o-mini",
  "modelFallback": "ollama/nemotron-3-nano:latest",
  "agentDir": "~/.openclaw/agents/knox/agent",
  "workspace": "~/.openclaw/agents/knox/workspace",
  "tools": { "allow": ["web_fetch", "web_search", "read", "write", "exec"] },
  "fs": { "workspaceOnly": true }
}
```

New top-level section:

```json
"n8n": {
  "webhookBase": "http://localhost:5678/webhook",
  "enabled": true
}
```

### 8.4 Trigger Daemon Impact

No code changes needed. The daemon auto-discovers agents by scanning `~/.openclaw/agents/*/agent/triggers.json`. Adding `stranger/` and `knox/` directories with valid triggers.json files is sufficient. The daemon will:

- Pick up Stranger's `on_message` trigger and start watching its inbox
- Pick up Knox's `cron` and `on_message` triggers
- Report 11 agents on the `/health` endpoint (was 9)

### 8.5 Existing Agent Impact

**Zero changes** to any existing agent's:
- triggers.json
- autonomy.json
- soul.md
- focus.md
- Paperclip registrations
- Channel bindings

The only config change is adding the two new agent entries and the `n8n` block to openclaw.json.

### 8.6 Backup Updates

- Add n8n Docker volume path to `backup-config.sh`
- Add `stranger/` and `knox/` agent directories to backup scope
- Back up n8n encryption key to a separate secure location (critical — loss = all credentials unrecoverable)

### 8.7 Cost Impact

| Component | Monthly cost |
|-----------|-------------|
| n8n | $0 (self-hosted Docker) |
| The Stranger | ~$0 (Nemotron local) / ~$0.50 fallback (gpt-4o-mini) |
| Knox Harrington | ~$1.50-3.00 (gpt-4o-mini, daily research across topics) |
| idea-reality-mcp | ~$0 (hosted API, free tier) |
| **Total Phase 4a addition** | **~$2-4/month** |

Total estimated stack cost remains well within the $40-60/month budget from the parent spec.

## 9. Verification Plan

Each component is verified independently before integration testing:

| Step | Verify | Pass criteria |
|------|--------|---------------|
| 1 | n8n container starts | `curl http://localhost:5678` returns n8n UI |
| 2 | n8n test webhook | Create test workflow, POST to it, get response |
| 3 | n8n credential store | Store a test credential, verify agent can't see it |
| 4 | Stranger receives request | Drop test fetch in inbox, verify trigger fires |
| 5 | Stranger returns result | Verify sanitized response appears in requester's inbox |
| 6 | Stranger rejects bad domain | Request for blocklisted domain returns error |
| 7 | Stranger audit log | Verify fetch logged with all fields |
| 8 | Knox receives research request | Drop test topic in inbox from Jr, verify trigger fires |
| 9 | Knox runs AutoResearchClaw | Verify phases A-C execute on test topic |
| 10 | Knox delivers to Jr | Verify sanitized findings in Jr's inbox with correct format |
| 11 | idea-check via n8n | Dude calls webhook, gets reality_signal score |
| 12 | Dude gating logic | Test all three thresholds (>70, 30-70, <30) |
| 13 | Trigger daemon health | `/health` shows 11 agents, all triggers firing |
| 14 | No regressions | All 9 existing agents fire on schedule, no errors |
| 15 | Backup | n8n data + new agent dirs included in backup cycle |

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| n8n encryption key loss | Backup key separately; document recovery process |
| Stranger becomes bottleneck (many concurrent requests) | Trigger daemon queues requests; per-agent rate limits prevent flood |
| AutoResearchClaw API changes (v0.3.1 → future) | Pin version in Knox's venv; test before upgrading |
| idea-reality-mcp hosted API downtime | Fallback to local install documented in Section 7.4 |
| Nemotron sanitization misses injection pattern | Audit log flags suspicious content; manual review possible |
| Knox research runs cost more than expected | Phases A-C only; gpt-4o-mini primary; L3 gate on full pipeline |
| Domain allowlist too restrictive | Agents can request additions; changes require L3 approval |
| n8n Docker container resource usage | Lightweight (~1-2GB RAM); monitor via Smokey health sweeps |

## 11. What Phase 4a Does NOT Include

- **Credential migration for deferred workflows** (Gmail OAuth, Azure) — blocked on Mailroom OAuth setup
- **Public-facing n8n URL** — localhost only; Cloudflare tunnel deferred
- **mcporter / native MCP bridge** — using REST API via n8n instead
- **Full AutoResearchClaw pipeline** (phases D-H) — scoped to A-C for cost control
- **Changes to existing agents** — no soul.md, focus.md, or trigger modifications
- **Morning brief pipeline** — Phase 4b
- **Donny's dashboard mission** — Phase 4b
- **End-to-end chain test** — Phase 4c

## 12. References

- [caprihan/openclaw-n8n-stack](https://github.com/caprihan/openclaw-n8n-stack) — n8n Docker integration for OpenClaw
- [aiming-lab/AutoResearchClaw](https://github.com/aiming-lab/AutoResearchClaw) — 23-stage research pipeline (v0.3.1)
- [mnemox-ai/idea-reality-mcp](https://github.com/mnemox-ai/idea-reality-mcp) — Competition density scoring (v0.5.0)
- [n8n Docker docs](https://docs.n8n.io/hosting/installation/docker/) — Official install guide
- Parent spec: `2026-03-18-openclaw-full-activation-design.md` — Phase 4 items 23-25
- Phase 3b spec: `2026-03-18-openclaw-phase3b-visibility-layer-design.md` — Mailroom quarantine pattern reference
