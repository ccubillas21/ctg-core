# CTG Core v1.0 — Internal Technical Reference

**Audience:** CTG (Charlie Cubillas / internal use only)
**Date:** 2026-03-19
**Status:** Living document — update as the stack evolves

---

## 1. Overview

CTG Core is a managed AI team product. Each client receives an isolated Docker stack running on their own hardware (Mac Mini / Mac Studio), managed remotely by Cubillas Technology Group. CTG retains full control of the control plane, API credentials, security pipeline, and agent provisioning.

### What the client gets

- 3 persistent AI agents: Aimee (orchestrator), CTO (technical specialist), Jr (admin/triage)
- Slack integration with 3 bot apps + group channels for agent collaboration
- Ephemeral subagent spawning for ad-hoc and dirty work
- Mission Control dashboard (monitoring only — no admin access)
- All LLM costs bundled into the service fee — client never touches API keys

### What stays with CTG

- API keys (Anthropic, OpenAI) — held by Gatekeeper, never exposed to client
- Hub control plane — usage visibility, health monitoring, remote update delivery
- Paperclip — shared instance, agent registry and task management for all clients
- Sanitization pipeline — Nemotron/LLM Guard on CTG's RTX 5080
- Skill and soul development — CTG develops and pushes updates remotely

### Business model

- **Base tier:** 3 agents (Aimee, CTO, Jr) + unlimited ephemeral subagents
- **Additional persistent agents:** paid upgrade — every new agent goes through CTG's full provisioning process
- Subagents are included: ephemeral, sandboxed, GPT-4o-mini

---

## 2. Architecture

### Client Stack (4 Docker services)

| Service | Purpose |
|---------|---------|
| **OpenClaw** | Agent runtime — runs 3 persistent agents + ephemeral subagent spawning |
| **Gatekeeper** | LLM proxy — routes API calls through CTG keys, meters usage, phones home to Hub |
| **n8n** | Workflow automation — email triggers, scheduled tasks, webhook integrations |
| **Mission Control** | Dashboard — agent status, usage monitoring, client/agent onboarding forms (CTG-only admin) |

### CTG Hub (on Charlie's WSL)

| Service | Purpose | Clients depend on it? |
|---------|---------|----------------------|
| **Paperclip** | Shared agent registry + task management for all clients | Yes |
| **Hub** | Usage reporting, health checks, license enforcement, remote commands | Yes |
| **Sanitization endpoint** | Content classification via Nemotron/LLM Guard | Yes |
| **Charlie's OpenClaw** | Dude, Walter, Bonny, and other CTG internal agents | No |

### ASCII Stack Diagram

```
┌─────────────────────────────────────────────┐
│  Client Mac (Docker)                        │
│                                             │
│  ┌───────────┐  ┌───────────┐  ┌─────────┐ │
│  │  OpenClaw  │  │Gatekeeper │  │   n8n   │ │
│  │ 3 agents  │  │ LLM proxy │  │workflows│ │
│  │ +subagents│  │  + meter  │  │         │ │
│  └─────┬─────┘  └─────┬─────┘  └────┬────┘ │
│        │              │              │      │
│  ──────┴──────────────┴──────────────┴───   │
│              internal-net (isolated)        │
│                                             │
│  ┌─────────────┐                            │
│  │Mission Ctrl  │                           │
│  │  dashboard   │                           │
│  └──────┬──────┘                            │
│         │                                   │
│  ───────┴─────────────────────────────────  │
│              gateway-net (internet)         │
└──────────────────┬──────────────────────────┘
                   │ Tailscale VPN
                   │
┌──────────────────┴──────────────────────────┐
│  CTG Hub (Charlie's WSL)                    │
│                                             │
│  ┌──────────┐  ┌─────┐  ┌───────────────┐  │
│  │Paperclip │  │ Hub │  │ Sanitization  │  │
│  │ (shared) │  │     │  │ Nemotron+Guard│  │
│  └──────────┘  └─────┘  └───────────────┘  │
└─────────────────────────────────────────────┘
```

### Network Rules

- **internal-net:** Docker-isolated, no internet. OpenClaw, Gatekeeper, and n8n communicate here.
- **gateway-net:** Internet access. Gatekeeper reaches OpenAI/Anthropic APIs. Mission Control is accessible.
- **Gatekeeper bridges both networks** — the only legitimate path from agents to external APIs.
- **n8n risk:** n8n sits on gateway-net only. Agents on internal-net reach n8n through Gatekeeper. This prevents n8n from becoming an unlogged internet bypass. Verify this constraint is enforced during v1.0 implementation.
- **Tailscale** connects client Macs to CTG Hub for Paperclip, Hub check-ins, sanitization, and Gateway RPC.

### Connectivity Matrix

| Path | Protocol | Purpose |
|------|----------|---------|
| Client OpenClaw → CTG Paperclip | HTTP over Tailscale | Agent registry, task state |
| Client Gatekeeper → CTG Hub | HTTP over Tailscale | Usage reporting, health, update checks (every 5 min) |
| Client subagent → CTG sanitization | HTTP over Tailscale | Content classification (Rule of Two) |
| Client Aimee → CTG Dude | `sessions_send` over Tailscale | Agent escalation, new capability requests |
| CTG → Client OpenClaw gateway | Gateway RPC over Tailscale | Diagnostics, commands, remote updates |

---

## 3. Services Reference

### OpenClaw

- **What it does:** Agent runtime. Hosts Aimee, CTO, and Jr as persistent agents. Manages ephemeral subagent lifecycle. Connects to CTG Paperclip for task state. Exposes gateway port for RPC.
- **Image:** `ghcr.io/ccubillas21/ctg-openclaw:latest`
- **Internal port:** 18789
- **Host port:** `GW_PORT` (default: 28789)
- **Networks:** internal-net
- **Key env vars:**
  - `ANTHROPIC_API_KEY`: placeholder value only — real calls go through Gatekeeper
  - `PAPERCLIP_API_URL`: points to CTG Paperclip via Tailscale (not local)
  - `COMPANY_ID`: client-specific UUID
  - `GATEKEEPER_INTERNAL_TOKEN`: auth token for Gatekeeper
  - `OPENCLAW_AUTH_TOKEN`: auth token for gateway RPC
- **Healthcheck:** `GET /health` (wget)
- **Volumes:** `openclaw-data` (workspace), `openclaw-config` (config including soul.md, skills)

### Gatekeeper

- **What it does:** LLM proxy, usage ledger, Hub phone-home, content sanitization router. The only service that holds live API keys and bridges internal-net to the internet.
- **Image:** `ghcr.io/ccubillas21/ctg-gatekeeper:latest`
- **Internal port:** 9090
- **Host port:** `GATEKEEPER_HOST_PORT` (default: 19090)
- **Networks:** internal-net + gateway-net
- **Key env vars:**
  - `ANTHROPIC_API_KEY`: live key for Anthropic API calls
  - `OPENAI_API_KEY`: live key for OpenAI API calls
  - `GATEKEEPER_INTERNAL_TOKEN`: internal auth (agents present this)
  - `PARENT_HUB_URL`: CTG Hub URL over Tailscale
  - `PARENT_HUB_TOKEN`: token for Hub check-ins
  - `CHECKIN_INTERVAL_MS`: default 300000 (5 minutes)
  - `CTG_SANITIZATION_URL`: CTG sanitization endpoint over Tailscale
  - `GATEKEEPER_DB_PATH`: SQLite ledger path (`/data/gatekeeper.db`)
  - `LICENSE_GRACE_HOURS`: LLM calls continue this many hours if Hub is unreachable (default: 72)
- **Healthcheck:** `GET /health` (wget)
- **Volumes:** `gatekeeper-data` (/data — SQLite ledger + pricing config)

### Mission Control

- **What it does:** Dashboard UI for CTG operator view and (future) client status visibility. Connects to Paperclip API for agent/task data. Only service on both networks — accessible from outside.
- **Image:** `node:22-alpine` running `npx openclaw-mission-control`
- **Internal port:** 4000
- **Host port:** `MC_PORT` (default: 14000)
- **Networks:** internal-net + gateway-net
- **Key env vars:**
  - `PAPERCLIP_URL`: Paperclip service URL (internal-net)
- **Healthcheck:** `GET /api/status` (wget)
- **Tabs (current):** Dashboard, Memory
- **Tabs (planned):** Clients, Agents, Usage

### n8n

- **What it does:** Workflow automation. Handles email triggers, scheduled tasks, webhook integrations. Holds external credentials in isolation so agents never see them directly.
- **Image:** `n8nio/n8n:1.76.1`
- **Internal port:** 5678
- **Host port:** `N8N_PORT` (default: 5678)
- **Networks:** gateway-net only
- **Key env vars:**
  - `N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD`: UI authentication
  - `N8N_ENCRYPTION_KEY`: workflow credential encryption
- **Healthcheck:** `GET /healthz` (wget)
- **Volumes:** `n8n-data` (/home/node/.n8n)

---

## 4. LLM Routing

### Agent Model Assignments

| Agent | Primary Model | Fallback | Provider |
|-------|--------------|----------|----------|
| **Aimee** | GPT-5.4 | — | OpenAI |
| **CTO** | Claude Sonnet 4.6 | Claude Opus 4.6 | Anthropic |
| **Jr** | GPT-4o-mini | — | OpenAI |
| **Subagents** | GPT-4o-mini | — | OpenAI |

Note: The spec uses standard API keys (not Codex OAuth). Keys are held by Gatekeeper only.

### Gatekeeper Routing URLs

| URL Path | Provider | Model | Used By |
|----------|----------|-------|---------|
| `/llm/openai/agents/primary/...` | OpenAI | GPT-5.4 | Aimee |
| `/llm/anthropic/agents/cto/...` | Anthropic | Sonnet 4.6 | CTO |
| `/llm/openai/agents/jr/...` | OpenAI | GPT-4o-mini | Jr |
| `/llm/openai/agents/*/...` | OpenAI | GPT-4o-mini | Any subagent (wildcard) |

### Gatekeeper Auth

Agents authenticate to Gatekeeper using:
- `Authorization: Bearer <GATEKEEPER_INTERNAL_TOKEN>` header, or
- `x-api-key: <GATEKEEPER_INTERNAL_TOKEN>` header

Gatekeeper strips this header before forwarding to the upstream provider and injects the real API key.

### Content Sanitization Flow

1. Jr receives a task involving external content (email body, web scrape, uploaded file)
2. Jr spawns a quarantined subagent to handle the raw content
3. Subagent sends raw content to CTG sanitization endpoint over Tailscale
4. CTG pipeline (Nemotron / LLM Guard on RTX 5080) classifies and sanitizes
5. Clean, schema-validated result returned to subagent
6. Subagent passes sanitized summary to Jr
7. Jr passes clean output to Aimee

No local LLM is required on the client Mac. If the sanitization endpoint is unreachable, Jr blocks dirty-content processing — it does not bypass the pipeline.

---

## 5. Security Model

### Core Principles

- **Only CTG provisions persistent agents.** Every agent goes through: job description → role definition → Slack channel → SOPs → skills → tool access → cron routines → training → risk assessment → deployment.
- **Mission Control is the only door.** All company and agent creation goes through MC forms. No API backdoors. No direct Paperclip writes from client side.
- **Agents are self-aware of their scope.** When work falls outside their lane, they suggest "this could benefit from a specialized agent" and route the client to contact CTG.
- **Subagents are the escape valve.** Ephemeral, sandboxed, quarantined, monitored. Handle ad-hoc work without compromising the security perimeter.

### Quarantine — Rule of Two

- **Docker network isolation:** internal-net has no internet. Agents cannot reach the outside world directly.
- **Gatekeeper as chokepoint:** the only path to external APIs. All traffic logged and metered.
- **Subagent sandboxing:** `workspaceOnly: true`, limited tool access, no Slack channel, no persistent state.
- **Content sanitization:** all dirty content (emails, web scrapes, uploaded files) must pass through CTG pipeline before touching trusted agents. Sanitization failure = block, not bypass.

### Paperclip Access Control

| Role | Key type | Permissions |
|------|---------|-------------|
| CTG admin | Admin key | Full read/write — create companies, agents, modify config |
| Client OpenClaw | Read-only key | Query their own agents and tasks only |
| Edge agents | No direct key | Access Paperclip via OpenClaw service only |

**Important:** Paperclip uses company-scoped API paths (`/api/companies/{companyId}/...`). Verify that Paperclip enforces tenant isolation at the API key level, not just URL level. If URL-only, add a proxy layer in Gatekeeper that locks company ID per client token.

### Why Clients Cannot Create Agents

Clients interacting only through Slack is the product's security model. Untrained agents with unvetted tool access can become vectors for prompt injection, data exfiltration, or supply chain compromise. CTG's provisioning process — job description, tool access curation, SOP behavioral boundaries, risk assessment — is what makes the team safe. Bypassing it breaks the product's security guarantee.

---

## 6. Agent Definitions

### Agent Roster

| | Aimee | CTO | Jr |
|---|---|---|---|
| **Role** | Orchestrator, primary client contact | Technical specialist | Admin, triage, dirty work |
| **Model** | OpenAI GPT-5.4 | Anthropic Sonnet 4.6 (Opus fallback) | OpenAI GPT-4o-mini |
| **Slack bot** | Own app | Own app | Own app |
| **Spawns subagents** | Yes — delegates to CTO and Jr | Yes — technical deep-dives | Yes — email, web, quarantined tasks |
| **Tools** | Lobster, sessions, agent-to-agent, Paperclip, QMD | Filesystem, exec (sandboxed), Lobster, Paperclip, QMD, subagents | Lobster, web search, web fetch, sessions, Paperclip, QMD |
| **fs access** | workspaceOnly | workspaceOnly | workspaceOnly |
| **CTG equivalent** | Dude | Walter | Bonny |

### Soul.md Locations

Soul.md files for the client template agents are stored in the OpenClaw image at provisioning time. Per the OpenClaw SOUL.md convention, they are loaded from the **workspace directory** (uppercase filename), not the agentDir.

- Aimee: `agents/primary/SOUL.md` (in `ctg-core` repo, baked into image)
- CTO: `agents/cto/SOUL.md`
- Jr: `agents/jr/SOUL.md`

### Soul.md Core Guidance (all agents)

All three agents' souls include:
- Role boundaries and lane definitions
- "This type of work could benefit from a specialized agent — CTG can set that up" — for out-of-scope requests
- Escalation path via `sessions_send` to CTG's team for platform issues or capability requests
- Rule of Two understanding (Jr: mandatory; Aimee: trust Jr's sanitized pipeline; CTO: security-first defaults)
- Collaboration patterns — how to work with the other two agents through Slack

### Subagent Rules

- All subagents use GPT-4o-mini
- Quarantined: `workspaceOnly: true`, limited tools, no Slack, no persistent state
- Spawned and killed by parent agent (Aimee, CTO, or Jr)
- Dirty content routed through CTG sanitization pipeline before reaching parent
- Cannot spawn additional persistent agents

---

## 7. Hub Phone-Home

### Check-In Protocol

1. Client Gatekeeper initiates check-in every 5 minutes (`CHECKIN_INTERVAL_MS: 300000`)
2. Request sent to `PARENT_HUB_URL` over Tailscale, authenticated with `PARENT_HUB_TOKEN`
3. Payload includes: agent status, usage since last check-in, service health metrics, client company ID
4. Hub responds with: acknowledgment + any pending commands (skill updates, config changes, restart orders)
5. Gatekeeper applies commands locally

### What Is Reported

- Per-agent model usage (tokens, cost) since last check-in
- Service health (OpenClaw up/down, n8n up/down, Mission Control up/down)
- License status (grace period countdown if Hub was previously unreachable)

### Remote Commands

| Command | Description |
|---------|-------------|
| **skill push** | CTG pushes new skills to client OpenClaw via Hub |
| **soul/config update** | Update agent personality, model routing, or behavioral rules |
| **update check** | Client asks "is there a new image version?" — Hub responds with update instructions |
| **Gateway RPC** | CTG connects directly to client's OpenClaw gateway over Tailscale for diagnostics, session monitoring, command execution |

### Hub Downtime Behavior

| Service | Impact | Behavior |
|---------|--------|---------|
| LLM calls | Continue | 72-hour license grace period built into Gatekeeper |
| Paperclip (tasks) | Degraded | Gatekeeper caches last-known agent roster; agents degrade to stateless mode |
| Sanitization | Blocked | Dirty-content processing halted — agents queue work, do not bypass pipeline |

---

## 8. Mission Control

### Current State

Vanilla HTML/CSS/JS app, no build step, no framework. Tab system implemented. Adding a tab is ~5–10 lines HTML + one JS file.

### Tabs

| Tab | Content | Data Source |
|-----|---------|-------------|
| **Dashboard** | Service health, active agents, recent activity | Paperclip API + Gatekeeper |
| **Memory** | Agent memory state, QMD index | OpenClaw / QMD |
| **Clients** | Client list, onboarding form, per-client health/status tracker | Hub API |
| **Agents** | Agent roster (all clients), onboarding form, role/soul editor | Paperclip API |
| **Usage** | Per-client and per-agent spending, trends, breakdowns | Gatekeeper SQLite ledger via Hub |

Note: Clients and Agents tabs are planned for v1.0 implementation. Usage tab follows.

### Client Onboarding Form (Clients tab)

Fields: company name, contact info, Slack workspace, number of agents (starts at 3), Tailscale IP
Output: company ID, credentials, compose config, status tracker entry (provisioned → configured → deployed → live)

### Agent Onboarding Form (Agents tab)

Fields: client dropdown, agent name, role, model tier, job description, tool access checkboxes, SOP template selection
On submit: triggers `bot-deploy` skill + `slack-provision` workflow
Status: drafted → approved → provisioned → deployed → live

### Access Control

- **Mission Control is the ONLY way to create companies or agents.** No direct API calls, no Paperclip writes from the client stack.
- MC forms use Hub/Paperclip API with CTG admin credentials
- Client-side OpenClaw has read-only Paperclip access
- Edge agents cannot reach Mission Control (wrong network)
- CTG's internal agents (Dude/Bonny) can fill out MC forms programmatically via API for agent-initiated onboarding

### Agent-Initiated Onboarding Flow

1. Client asks Aimee for something beyond scope
2. Aimee suggests a specialist agent, sends `sessions_send` request to CTG's Dude
3. Dude/Bonny opens Mission Control, fills agent onboarding form
4. Charlie reviews and approves
5. `bot-deploy` + `slack-provision` runs
6. New agent config pushed to client via Hub
7. Agent goes live in client's Slack

---

## 9. Onboarding Process

### Pre-Deployment (CTG Side)

1. Register client company in Paperclip via MC Clients form
2. Register 3 agents (Aimee, CTO, Jr) via MC Agents form
3. Generate credentials: Gatekeeper token, OpenClaw auth token, company ID
4. Create 3 Slack bot apps in client's Slack workspace — CTG owns the apps and holds the tokens
5. Write agent soul.md, SOPs, and skills (using client template, customized per client)
6. Assign Tailscale IP for the client Mac

### On the Client Mac

1. Install Tailscale, join CTG tailnet
2. Install Docker Desktop
3. Run deploy script: `curl -sfL https://raw.githubusercontent.com/ccubillas21/ctg-core/master/deploy.sh | bash`
4. Script prompts for Hub token, generates local credentials, pulls images, starts 4-service stack
5. First boot: OpenClaw connects to CTG Paperclip via Tailscale, Gatekeeper phones home, agents come online
6. Verify all 3 agents respond in Slack

### Post-Install Verification (CTG Side)

1. Verify via Gateway RPC over Tailscale — session status, agent health
2. Hub dashboard shows client healthy, check-ins arriving every 5 minutes
3. Paperclip shows all 3 agents registered and active
4. Run test conversation through each agent in Slack
5. Walk client through their Slack channels and group channels

---

## 10. Deployment

### Build and Push Images

Images are multi-arch (amd64 + arm64) and pushed to GitHub Container Registry.

```bash
# From ctg-core repo root
./push.sh                 # push as :latest
./push.sh --tag v1.0.0    # push with version tag
```

`push.sh` uses `docker buildx` with the `multiarch` builder. It builds and pushes:
- `ghcr.io/ccubillas21/ctg-gatekeeper:latest` (from `Dockerfile.gatekeeper`)
- `ghcr.io/ccubillas21/ctg-openclaw:latest` (from `Dockerfile.openclaw`)

### Deploy to Client Mac

```bash
curl -sfL https://raw.githubusercontent.com/ccubillas21/ctg-core/master/deploy.sh | bash
```

The script:
1. Assesses system (OS, RAM, disk, Docker, Tailscale, Git, curl, jq, openssl)
2. Offers to install missing prerequisites via Homebrew (macOS) or apt/dnf (Linux)
3. Creates `~/.ctg-core/` and downloads compose files
4. Generates credentials: `PG_PASSWORD`, `OPENCLAW_AUTH_TOKEN`, `COMPANY_ID`, `GATEKEEPER_INTERNAL_TOKEN`, `N8N_BASIC_AUTH_PASSWORD`, `N8N_ENCRYPTION_KEY`
5. Prompts for Hub token (provided by CTG)
6. Pulls images from GHCR and starts all 4 services
7. Seeds Paperclip with Aimee, Engineer, and Dispatch agent entries

**Required ports (must be free):** 13100 (Paperclip), 14000 (Mission Control), 28789 (Gateway), 19090 (Gatekeeper), 5678 (n8n)

### Deploy Script Updates Needed for v1.0

- Remove Postgres and Paperclip from client compose (move to CTG Hub)
- Point OpenClaw at CTG Paperclip via Tailscale IP
- Point Gatekeeper Hub check-in at CTG Hub via Tailscale IP
- Add `CTG_SANITIZATION_URL` env var (Tailscale endpoint)
- Expose OpenClaw gateway port for Tailscale RPC access
- Inject Tailscale IP as env var during deployment

### Manual Rollback

No automated rollback in v1.0. Steps:
1. `docker compose down` on client Mac
2. Edit `CTG_VERSION` in `~/.ctg-core/.env` to previous image tag
3. `docker compose up -d`

Agent configs are versioned in the `ctg-core` git repo — restore soul.md, skills, and SOPs from git history if needed.

---

## 11. Tailscale Networking

### What Ports Are Exposed via Tailscale

| Port | Service | Purpose |
|------|---------|---------|
| 28789 | OpenClaw Gateway | CTG remote diagnostics, RPC, session access |
| 19090 | Gatekeeper | Hub check-ins, sanitization routing (Gatekeeper calls out, not in) |
| 14000 | Mission Control | CTG operator dashboard access |

Client Macs are on the CTG tailnet. Only CTG devices can connect to these ports over Tailscale.

### Connectivity Matrix

| From | To | Port | Purpose |
|------|----|------|---------|
| Client OpenClaw | CTG Paperclip (Tailscale IP) | 3101 | Agent registry, task state |
| Client Gatekeeper | CTG Hub (Tailscale IP) | Hub port | Usage check-ins (5 min) |
| Client subagent | CTG Sanitization (Tailscale IP) | Sanitization port | Content classification |
| Client Aimee | CTG Dude (sessions_send) | OpenClaw Gateway | Agent escalation |
| CTG → Client | Client OpenClaw Gateway (Tailscale IP) | 28789 | Diagnostics, remote commands |

---

## 12. Troubleshooting

### Hub Unreachable

**Symptoms:** Gatekeeper logs show check-in failures. Hub dashboard shows client offline.

**Check:**
1. Is Tailscale running on the client Mac? `tailscale status`
2. Is the CTG Hub reachable? `ping <CTG_TAILSCALE_IP>` from client Mac
3. Is `PARENT_HUB_URL` set correctly in `~/.ctg-core/.env`?
4. Is `PARENT_HUB_TOKEN` valid?

**Impact while Hub is down:** LLM calls continue (72-hour grace). Sanitization blocked. Paperclip task state unavailable. Agents degrade to stateless mode.

**Recovery:** Once Hub is back, Gatekeeper resumes check-ins automatically on next interval.

---

### Agent Not Starting

**Symptoms:** Agent does not appear online in Slack. OpenClaw logs show error.

**Check:**
1. `docker compose ps` — is `ctg-core-openclaw` healthy?
2. `docker compose logs ctg-core-openclaw` — look for auth errors, Paperclip connectivity errors
3. Is `PAPERCLIP_API_URL` pointing to CTG Hub Tailscale IP (not localhost)?
4. Is `COMPANY_ID` set and matching the registered company in Paperclip?
5. Is the Slack bot token valid? Check soul.md or agent config for the Slack integration block.

---

### Gatekeeper Auth Failures

**Symptoms:** Agents get 401/403 from Gatekeeper. LLM calls fail.

**Check:**
1. Is `GATEKEEPER_INTERNAL_TOKEN` consistent between OpenClaw and Gatekeeper env vars?
2. Is the agent sending the token as `Authorization: Bearer <token>` or `x-api-key: <token>`?
3. `docker compose logs ctg-core-gatekeeper` — look for "unauthorized" entries
4. If token mismatch: update `~/.ctg-core/.env` with consistent token, then `docker compose restart`

---

### Paperclip Connectivity

**Symptoms:** Agents can't read or write task state. Paperclip API calls time out.

**Check:**
1. Is CTG Hub running? Check Paperclip health at `http://<CTG_TAILSCALE_IP>:3101/api/health`
2. Is Tailscale connected on the client Mac?
3. Is `PAPERCLIP_API_URL` in the OpenClaw env set to the Tailscale IP, not localhost?
4. Is the `PAPERCLIP_API_KEY` valid and scoped to the correct company?

**Degraded mode:** If Paperclip is unreachable, agents fall back to stateless operation (no persistent task state). Work continues but tasks are not tracked.

---

### Sanitization Pipeline Down

**Symptoms:** Jr refuses to process emails or web content. Logs show sanitization endpoint unreachable.

**Check:**
1. Is CTG Hub running? Is the sanitization service healthy?
2. Is `CTG_SANITIZATION_URL` set correctly in Gatekeeper env?
3. Is Tailscale connected?

**By design:** Jr does NOT bypass the sanitization pipeline when it's down. It queues dirty-content tasks and waits. Do not instruct Jr to bypass — this is intentional security behavior. Restore the Hub and tasks will resume.

---

*CTG Core v1.0 — Internal Technical Reference*
*Repo: `ccubillas21/ctg-core` (master branch)*
