# CTG Core Gatekeeper — Design Spec

**Date:** 2026-03-18
**Author:** Charlie Cubillas + Claude Code
**Status:** Draft
**Scope:** CTG Core client deployment package

---

## Problem

The current CTG Core deployment has three security and operational gaps:

1. **No trust boundary.** Trusted agents can reach the internet directly. A prompt injection in an email or web page could cause an agent to exfiltrate data or call arbitrary APIs.
2. **No usage visibility.** Charlie has no way to see how much each client is consuming — which agents are active, how many tokens they're burning, what it's costing.
3. **No credential isolation.** API keys live in OpenClaw's config file. Anyone with container access can read them.

The Parent Relay exists but only reports basic health status. It doesn't track usage, enforce licensing, or provide any security boundary.

## Solution

Replace the Parent Relay with a **Gatekeeper** — a unified service that acts as the container's single bridge to the internet. It combines four functions:

1. **LLM reverse proxy** — routes all model calls to Anthropic/OpenAI, injects API keys, logs usage
2. **Content sanitizer** — fetches, scans, and sanitizes all external content (web pages, emails, files)
3. **Usage ledger** — tracks every call, token, and dollar per agent per day in SQLite
4. **Hub reporter** — replaces Parent Relay, sends rich usage/spending data to Charlie's hub, handles license enforcement and bot deployment commands

Enforcement is at the Docker network level: all trusted services run on an `internal: true` network with no internet access. Gatekeeper is the only bridge out.

---

## Architecture

### Docker Network Topology

```
┌──────────────────────────────────────────────┐
│                 INTERNET                      │
└─────────────┬──────────────┬─────────────────┘
              │              │
     ┌────────┴────┐  ┌──────┴─────┐
     │ Gatekeeper  │  │    n8n     │
     │ :9090       │  │  :5678     │
     └────────┬────┘  └──────┬─────┘
              │              │
┌─────────────┴──────────────┴─────────────────┐
│          internal-net (internal: true)         │
│                                                │
│  ┌──────────┐ ┌────────┐ ┌────────┐           │
│  │ OpenClaw │ │Paperclp│ │Postgres│           │
│  │ :18789   │ │ :3100  │ │ :5432  │           │
│  └──────────┘ └────────┘ └────────┘           │
│  ┌────────────────┐                            │
│  │Mission Control │                            │
│  │ :4000          │                            │
│  └────────────────┘                            │
└────────────────────────────────────────────────┘
```

**Two networks:**
- **`internal-net`** — Docker bridge with `internal: true`. No outbound internet. OpenClaw, Paperclip, PostgreSQL, and Mission Control live here exclusively.
- **`gateway-net`** — Standard Docker bridge with internet access. Only Gatekeeper and n8n connect to this network.

**Gatekeeper and n8n** connect to both networks. They are the only two services that can reach the internet. All other services are physically unable to make outbound connections — this is enforced by Docker networking, not application configuration.

If an agent attempts to call `api.anthropic.com` directly, the connection times out. There is no route. The only path to the internet is through Gatekeeper (for LLM calls and content) or n8n (for credentialed API calls).

**n8n as a second bridge — accepted risk for v1:** n8n has direct internet access and is not monitored by Gatekeeper's usage ledger. This is an accepted trade-off: n8n workflows are admin-configured only (agents cannot create or modify workflows — they can only call pre-defined webhook URLs), n8n has its own authentication, and n8n's outbound traffic is limited to the specific API integrations configured by CTG during setup. Agents cannot use n8n as an arbitrary exfiltration path because they can only call known webhook endpoints that return structured responses. Routing n8n through Gatekeeper is a v2 consideration.

### Gatekeeper Internal Architecture

The Gatekeeper is a single Node.js service with four subsystems:

#### 1. LLM Reverse Proxy

Routes all LLM API calls from OpenClaw to the correct provider.

**Endpoints:**
- `POST /llm/anthropic/*` → proxied to `https://api.anthropic.com/*`
- `POST /llm/openai/*` → proxied to `https://api.openai.com/*`
- All other outbound domains → `403 Forbidden`

**Behavior:**
- Extracts agent ID from the request URL path. OpenClaw's `baseUrl` is configured per-agent as `http://gatekeeper:9090/llm/anthropic/agents/{agent_id}`, so the agent ID is embedded in the routing — no custom headers needed, no OpenClaw code changes required. Gatekeeper strips the `/agents/{agent_id}` segment before forwarding to the provider.
- Extracts model name from the request body (`model` field, present in both Anthropic and OpenAI request formats)
- Strips any existing `Authorization`, `x-api-key`, or `api-key` headers from the inbound request (prevents key leakage if OpenClaw sends a stale or dummy key)
- Injects the correct API key from Gatekeeper's environment variables
- Forwards the request to the provider using plain `http.request` with body buffering (not a streaming proxy — we need to read the response body to extract token usage)
- Reads the provider's response body to extract: actual input tokens, output tokens, provider-reported usage (Anthropic returns `usage` in response body; OpenAI returns `usage` in response body)
- Logs the call to the usage ledger
- Returns the response to OpenClaw unmodified

**API keys** live exclusively in Gatekeeper's environment variables. OpenClaw's config sets a dummy placeholder key (`sk-ant-placeholder-routed-through-gatekeeper`) to prevent startup validation failures — the key is never sent to any provider because Gatekeeper strips it. Even if someone gains access to the OpenClaw container, the real API credentials are not present.

**Allowlist** is hardcoded to Anthropic and OpenAI API domains only. No configuration needed — if we add a provider later, we update the allowlist in code.

**Internal authentication:** Gatekeeper validates a shared secret (`GATEKEEPER_INTERNAL_TOKEN` env var) on all inbound requests via the `Authorization: Bearer <token>` header. OpenClaw, n8n, and any service that calls Gatekeeper must include this token. Requests without a valid token receive `401 Unauthorized`. This prevents a compromised container on `internal-net` from using Gatekeeper as an open proxy.

#### 2. Content Sanitizer

Handles all external content fetching on behalf of trusted agents.

**Endpoints (v1):**
- `POST /fetch` — fetch a URL, sanitize, return structured JSON

**Deferred to v2:** `/email` (requires email credential model design) and `/download` (requires file type restrictions and malware scanning strategy). For v1, email and file content flows through existing channels (Mailroom agent for email, agent workspace for files).

**Request format:**
```json
{
  "agent_id": "primary",
  "url": "https://example.com/article",
  "extract": ["title", "body", "date"]
}
```

**Response format:**
```json
{
  "status": "ok",
  "data": {
    "title": "Article Title",
    "body": "Sanitized content...",
    "date": "2026-03-18"
  },
  "metadata": {
    "source_domain": "example.com",
    "original_size_bytes": 42000,
    "sanitized_size_bytes": 3200,
    "fetch_time_ms": 340
  }
}
```

**Sanitization rules:**
- Strip all HTML tags and scripts, return plain text (v1 approach — simple and reliable)
- The `extract` field is best-effort: for v1, Gatekeeper returns the full stripped plain text as `body`, the `<title>` tag content as `title`, and any `<time>`/`<meta>` date hints as `date`. Complex field extraction is a v2 feature — v1 gives agents clean text to work with.
- Maximum response size: 50KB
- Rate limit: 30 requests per agent per hour
- Domain allowlist: configurable per deployment (default: permissive for v1)
- Returns structured JSON only — raw HTML/content never reaches trusted agents

**Error response format** (consistent across all endpoints):
```json
{
  "status": "error",
  "error": "rate_limit_exceeded",
  "message": "Agent 'primary' exceeded 30 requests/hour limit",
  "retry_after_seconds": 1800
}
```

HTTP status codes: `400` (bad request), `401` (missing/invalid internal token), `403` (domain blocked or license suspended), `429` (rate limited), `502` (upstream provider error), `504` (upstream timeout).

#### 3. Usage Ledger

SQLite database tracking every outbound request.

**LLM call log:**
```sql
CREATE TABLE llm_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  agent_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  provider_cost_cents INTEGER NOT NULL DEFAULT 0,
  billed_cost_cents INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_llm_calls_agent_date ON llm_calls(agent_id, timestamp);
```

**Content request log:**
```sql
CREATE TABLE content_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  agent_id TEXT NOT NULL,
  request_type TEXT NOT NULL,  -- fetch, email, download
  domain TEXT,
  size_bytes INTEGER DEFAULT 0,
  blocked INTEGER DEFAULT 0,
  block_reason TEXT
);
```

**Daily rollup table** (computed periodically for efficient hub reporting):
```sql
CREATE TABLE usage_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  model TEXT NOT NULL,
  llm_calls INTEGER DEFAULT 0,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  provider_cost_cents INTEGER DEFAULT 0,
  billed_cost_cents INTEGER DEFAULT 0,
  content_requests INTEGER DEFAULT 0,
  content_blocked INTEGER DEFAULT 0,
  UNIQUE(date, agent_id, model)
);
```

**Pricing table** (`pricing.json`):
```json
{
  "anthropic/claude-opus-4-6": {
    "input_per_mtok": 15.00,
    "output_per_mtok": 75.00,
    "billing_input_per_mtok": 18.00,
    "billing_output_per_mtok": 90.00
  },
  "anthropic/claude-sonnet-4-6": {
    "input_per_mtok": 3.00,
    "output_per_mtok": 15.00,
    "billing_input_per_mtok": 3.60,
    "billing_output_per_mtok": 18.00
  },
  "anthropic/claude-haiku-4-5": {
    "input_per_mtok": 0.25,
    "output_per_mtok": 1.25,
    "billing_input_per_mtok": 0.30,
    "billing_output_per_mtok": 1.50
  },
  "openai/gpt-4o-mini": {
    "input_per_mtok": 0.15,
    "output_per_mtok": 0.60,
    "billing_input_per_mtok": 0.18,
    "billing_output_per_mtok": 0.72
  }
}
```

Two cost tracks: `provider_cost` is what the API actually charges (for truth). `billed_cost` applies your markup (for invoicing clients). Both are logged on every call.

**Pricing table updates:** `pricing.json` is mounted as a Docker volume (not baked into the image). The hub can push updated pricing via a new `pricing-update` command type, which Gatekeeper writes to the mounted file and reloads. This allows rate changes without redeployment.

**Local API endpoints:**
- `GET /health` — Gatekeeper status, uptime, last check-in, license state (used by Docker healthcheck)
- `GET /status` — full collected health of all services (same as old relay `/status`)
- `GET /usage` — today's usage summary across all agents
- `GET /usage/:agent` — per-agent breakdown
- `GET /usage/history` — last 30 days, daily rollups
- `POST /checkin` — force immediate hub check-in

#### 4. Hub Reporter

Replaces the Parent Relay entirely. Same check-in cadence (every 5 minutes), richer payload.

**Note on field naming:** The existing Parent Relay uses `companyId` (camelCase). The new check-in payload uses `company_id` (snake_case) for consistency with the hub's SQL schema. The hub stores check-in payloads as opaque JSON, so this is not a breaking change — but any scripts parsing stored payloads should be aware of the convention change.

**Check-in payload:**
```json
{
  "company_id": "uuid",
  "timestamp": "2026-03-18T14:30:00Z",
  "gatekeeper_version": "1.0.0",
  "uptime_seconds": 86400,
  "services": {
    "openclaw": "healthy",
    "paperclip": "healthy",
    "postgresql": "healthy",
    "mission_control": "healthy",
    "n8n": "healthy"
  },
  "agents": [
    { "name": "primary", "status": "active", "last_activity": "2026-03-18T14:28:00Z" },
    { "name": "engineer", "status": "active", "last_activity": "2026-03-18T13:45:00Z" },
    { "name": "dispatch", "status": "active", "last_activity": "2026-03-18T14:30:00Z" }
  ],
  "usage_today": {
    "primary": {
      "anthropic/claude-sonnet-4-6": { "calls": 47, "tokens_in": 52000, "tokens_out": 31200, "provider_cents": 82, "billed_cents": 98 }
    },
    "engineer": {
      "anthropic/claude-opus-4-6": { "calls": 12, "tokens_in": 28000, "tokens_out": 89400, "provider_cents": 712, "billed_cents": 854 }
    },
    "dispatch": {
      "anthropic/claude-haiku-4-5": { "calls": 38, "tokens_in": 8000, "tokens_out": 4100, "provider_cents": 7, "billed_cents": 8 }
    }
  },
  "content_today": {
    "requests": 23,
    "sanitized": 22,
    "blocked": 1
  },
  "spending_mtd": {
    "provider_total_cents": 1505,
    "billed_total_cents": 1806
  },
  "bot_requests": []
}
```

**Check-in response from hub:**
```json
{
  "received": true,
  "license": {
    "status": "active",
    "expires": "2026-12-31"
  },
  "commands": []
}
```

**License enforcement — graceful degradation (Option B):**

Gatekeeper tracks `last_successful_checkin` timestamp. Degradation triggers when:
- Hub returns `license.status` of `"suspended"` or `"expired"`, OR
- Hub has been unreachable for 72 consecutive hours (`LICENSE_GRACE_HOURS` env var)

When degraded:
- In-flight LLM requests complete normally
- New LLM requests receive: `{"error": "license_suspended", "message": "Service suspended. Contact CTG to restore.", "contact": "support@cubillastech.com"}`
- Content requests blocked with same error
- Dashboard (Mission Control) remains accessible in read-only mode
- Gatekeeper continues attempting hub check-ins (so it recovers automatically when license is restored)

**Inbound commands from hub** — same three types as current Parent Relay:
- `config-update` → triggers OpenClaw reload
- `sop-update` → writes SOP file (with path sanitization)
- `deploy-bot` → triggers Lobster `new-bot` workflow

---

## Bot Request Flow

When a client requests a new bot through their agents, the following flow executes:

### Client Side

1. Client tells Primary: "I need a bot that handles invoicing"
2. Primary creates a Paperclip task with type `bot-request`, including the description and desired capabilities
3. Gatekeeper scans Paperclip for `bot-request` tasks on each check-in cycle
4. New bot requests are included in the check-in payload to the hub

### Hub Side

5. Hub receives the bot request in the check-in payload
6. Hub checks the GitHub template repo (`ctg-templates/agent-templates`) for a matching template by name/tag
7. **If template exists:** Hub auto-queues a `deploy-bot` command with the template reference
8. **If no template:** Hub flags it for Charlie's team (stored as a pending request, visible on the hub dashboard). Notification sent via Slack.

### Design & Deploy (no template case)

9. Charlie's team designs the bot — soul.md, skills, triggers, model selection
10. Team pushes the template to the GitHub repo under `templates/{bot-type}/`
11. Team triggers deploy from the hub dashboard (or CLI): `POST /api/tenants/:id/deploy-bot`
12. Hub queues the `deploy-bot` command

### Back to Client Side

13. Gatekeeper picks up the `deploy-bot` command on next check-in
14. Gatekeeper pulls the template from GitHub (it has internet access via `gateway-net`)
15. Gatekeeper passes the template files to OpenClaw via the Lobster `new-bot` workflow
16. New agent is deployed, registered in Paperclip
17. Primary notifies the client: "Your invoicing bot is ready"

### GitHub Template Repo Structure

```
ctg-templates/agent-templates/
├── invoicing/
│   ├── template.json          ← model, tools, autonomy defaults
│   ├── soul.md                ← agent personality and instructions
│   ├── triggers.json          ← default triggers
│   └── skills/
│       └── invoice-processing/
├── support/
│   ├── template.json
│   ├── soul.md
│   ├── triggers.json
│   └── skills/
├── research/
├── content/
├── hr/
└── ...
```

Each template directory contains everything needed to deploy a functional agent. `template.json` specifies:

```json
{
  "name": "Invoicing",
  "model": "anthropic/claude-haiku-4-5",
  "tools": ["lobster", "paperclip", "qmd"],
  "autonomy": "L2",
  "quarantined": false,
  "description": "Processes invoices, tracks payments, flags discrepancies"
}
```

---

## OpenClaw LLM Routing

OpenClaw's model provider configuration is overridden to route through Gatekeeper:

The `baseUrl` override is set **per-agent** in the agent's model config (not at the provider level), so each agent's requests are tagged with their ID in the URL path:

```json
{
  "agents": {
    "list": [
      {
        "id": "primary",
        "model": {
          "primary": "anthropic/claude-sonnet-4-6",
          "baseUrl": "http://gatekeeper:9090/llm/anthropic/agents/primary"
        }
      },
      {
        "id": "engineer",
        "model": {
          "primary": "anthropic/claude-opus-4-6",
          "baseUrl": "http://gatekeeper:9090/llm/anthropic/agents/engineer"
        }
      },
      {
        "id": "dispatch",
        "model": {
          "primary": "anthropic/claude-haiku-4-5",
          "baseUrl": "http://gatekeeper:9090/llm/anthropic/agents/dispatch"
        }
      }
    ]
  }
}
```

Gatekeeper extracts the agent ID from the URL path (`/llm/{provider}/agents/{agent_id}/...`), strips the `/agents/{id}` segment, and forwards to the real provider API.

API keys are removed from OpenClaw's environment. A dummy placeholder key is set (`sk-ant-placeholder-routed-through-gatekeeper`) to satisfy any startup validation that checks for key presence. Gatekeeper strips this placeholder and injects the real key on outbound requests.

From OpenClaw's perspective, it's talking to Anthropic and OpenAI — same API contract, same request/response format. No code changes to OpenClaw required.

---

## Changes to CTG Core

### Modified Files

| File | Change |
|---|---|
| `docker-compose.yml` | Split `ctg-core-net` into `internal-net` + `gateway-net`. Add Gatekeeper service. Add n8n service (new — not currently in compose). Move all existing services to `internal-net` only. Gatekeeper + n8n on both networks. Remove `parent-relay` service. Add `gatekeeper-data` volume for SQLite ledger. Add `gatekeeper-pricing` volume for pricing.json. |
| `openclaw.seed.json` | Remove API keys from `env`. Add provider `baseUrl` overrides pointing at `http://gatekeeper:9090/llm/*`. |
| `.env.template` | Move `ANTHROPIC_API_KEY` to Gatekeeper section. Add `OPENAI_API_KEY` to Gatekeeper section. Add `LICENSE_GRACE_HOURS=72`. Add `GATEKEEPER_INTERNAL_TOKEN` (auto-generated by setup.sh). Set OpenClaw's `ANTHROPIC_API_KEY` to dummy placeholder value. |
| `deploy.sh` | Update port checks (add 5678 for n8n). API key prompt stays but value goes to Gatekeeper env. |
| `setup.sh` | Same changes as deploy.sh for API key placement. |
| `hub/index.js` | Add `usage_daily` table. Add `GET /api/tenants/:id/usage` endpoint. Add `GET /api/dashboard` endpoint. Add `license` field in check-in response. Add bot-request handler with GitHub template check. |
| `hub/tenants.sql` | Add `usage_daily` table schema. Add `license_status` and `license_expires` columns to `tenants` table. |

### New Files

| File | Purpose |
|---|---|
| `Dockerfile.gatekeeper` | Node 22 Alpine, installs better-sqlite3, copies gatekeeper source. Non-root user (uid 1000). |
| `gatekeeper/index.js` | Main server — HTTP listener on :9090, routes to subsystems |
| `gatekeeper/proxy.js` | LLM reverse proxy — domain allowlist, key injection, request/response logging |
| `gatekeeper/sanitizer.js` | Content fetcher — URL fetch, scan, sanitize, return structured JSON |
| `gatekeeper/ledger.js` | SQLite usage database — log calls, compute rollups, serve local API |
| `gatekeeper/hub.js` | Hub reporter — check-in, license enforcement, command handler (absorbs parent-relay logic) |
| `gatekeeper/pricing.json` | Model cost table — provider rates + billing rates |
| `gatekeeper/package.json` | Dependencies: better-sqlite3 |

### Deleted Files

| File | Reason |
|---|---|
| `parent-relay/` (entire directory) | Fully absorbed into Gatekeeper hub.js |

### Unchanged

Agent directories, SOPs, skills, Lobster workflows, Mission Control, Paperclip configuration. The existing 3 starter agents are unaware Gatekeeper exists.

---

## Port Map

| Port | Service | Network |
|---|---|---|
| 19090 | Gatekeeper (host-mapped) | gateway-net + internal-net |
| 9090 | Gatekeeper (internal) | gateway-net + internal-net |
| 5678 | n8n (host-mapped) | gateway-net + internal-net |
| 13100 | Paperclip (host-mapped from 3100) | internal-net |
| 14000 | Mission Control (host-mapped from 4000) | internal-net |
| 28789 | OpenClaw Gateway (host-mapped from 18789) | internal-net |
| 18789 | OpenClaw Gateway (internal) | internal-net |
| 3100 | Paperclip (internal) | internal-net |
| 4000 | Mission Control (internal) | internal-net |
| 5432 | PostgreSQL (internal) | internal-net |

---

## Cost Impact

Gatekeeper adds negligible cost to the deployment:
- Container resources: ~50MB RAM, minimal CPU (reverse proxy + SQLite writes)
- No additional API costs — it proxies existing calls, doesn't generate new ones
- SQLite storage: ~1MB/month at typical client usage

The total client deployment cost remains ~$15-26/month depending on agent usage, plus whatever markup is configured in `pricing.json`.

---

## What's NOT in v1

The following are explicitly deferred:

- **Tamper detection** — no config checksums, no inotify watchers
- **IP protection** — no obfuscation, no binary compilation
- **Content AI scanning** — sanitizer strips HTML/scripts and returns plain text; LLM-based prompt injection detection is a v2 consideration
- **Email and file download endpoints** — `/email` and `/download` deferred until credential model and malware scanning strategy are designed
- **Multi-provider support** — only Anthropic and OpenAI. Additional providers added to the allowlist as needed.
- **Billing integration** — usage data is tracked and reported, but invoicing/payment is manual for v1
- **LLM rate limiting** — no per-agent call ceilings in v1 (usage is tracked and visible, but not capped)
- **GitHub template repo** — referenced in bot request flow but creation of `ctg-templates/agent-templates` repo is a prerequisite, not part of this implementation

---

## Dependencies

- `better-sqlite3` — SQLite driver for usage ledger (same as hub)
- Docker with Compose v2 — for `internal: true` network support (available since Docker 1.10)

Note: No `http-proxy` dependency. The LLM proxy uses plain `http.request`/`https.request` with body buffering (same pattern as the existing Parent Relay's `fetch` helper). This is simpler, avoids streaming proxy complexity, and makes response body inspection trivial.

---

## Testing Strategy

- **Network isolation:** Verify OpenClaw container cannot reach external domains directly (`docker exec ctg-core-openclaw wget https://api.anthropic.com` must fail)
- **LLM proxy:** Verify agent can complete a prompt through Gatekeeper (end-to-end)
- **Usage logging:** Verify every LLM call produces a ledger entry with correct token counts
- **Cost calculation:** Verify provider cost and billed cost match expected values from pricing table
- **Hub check-in:** Verify check-in payload includes usage data and hub stores it correctly
- **License enforcement:** Simulate hub unreachable for >72 hours, verify graceful degradation
- **License recovery:** Restore hub connectivity, verify automatic recovery
- **Content sanitizer:** Verify fetch request returns structured JSON, raw content blocked
- **Rate limiting:** Verify 31st request in an hour from same agent is rejected
- **Bot request flow:** Submit bot request through Primary, verify it appears in hub check-in
- **Internal auth:** Verify requests without `GATEKEEPER_INTERNAL_TOKEN` receive 401
- **Graceful shutdown:** Send SIGTERM during an in-flight LLM request, verify the request completes before process exits (10-second drain timeout)

---

## Rollback

If Gatekeeper causes issues:
1. Stop Gatekeeper container
2. Switch `docker-compose.yml` back to single `ctg-core-net` (remove `internal: true`)
3. Restore API keys to OpenClaw's environment
4. Restore provider baseUrls to direct API endpoints
5. Re-enable Parent Relay service

Pre-deployment backup of all configs taken automatically by `deploy.sh`.
