# CTG Core v1.0 — Client Deployment Product Design

**Date:** 2026-03-19
**Status:** Draft
**Author:** Charlie Cubillas + Claude (external architect)

---

## 1. Product Definition

### What is CTG Core?

CTG Core is a managed AI team deployment. Each client gets an isolated Docker stack running on their hardware (Mac Mini / Mac Studio), managed remotely by Cubillas Technology Group (CTG).

### What the client gets

- **3 persistent agents**: Aimee (orchestrator), CTO (technical specialist), Jr (admin/triage)
- Each agent can spawn and kill **ephemeral subagents** for specific tasks
- **Slack integration**: 3 bot apps + shared group channels for agent collaboration and client interaction
- Email triage, web research, document processing — through quarantined subagents
- Usage dashboard (Mission Control)
- All LLM costs bundled into the service fee — client never touches API keys

### What stays with CTG (not deployed to client)

- API keys (Anthropic, OpenAI) — Gatekeeper holds them, clients never see them
- Hub control plane — usage visibility, health monitoring, remote updates
- Paperclip — shared instance, agent registry and task management for all clients
- Sanitization pipeline — content classification via Nemotron/LLM Guard on CTG infrastructure
- Skill and soul development — CTG develops and pushes updates to clients remotely

### What the client never touches

- Config files, Docker internals, API credentials
- Agent provisioning — only CTG can create persistent agents
- They interact with their AI team through Slack only

### Business model

- **Base tier**: 3 agents included (Aimee, CTO, Jr) + ephemeral subagents
- **Additional persistent agents**: paid upgrade — each requires CTG provisioning (job description, role, Slack channel, SOPs, skills, tool access, cron routines, training, risk assessment)
- Subagents are included — temporary, sandboxed, cheap (GPT-4o-mini)

---

## 2. Architecture

### Client Stack (4 Docker services on client Mac)

| Service | Purpose |
|---------|---------|
| **OpenClaw** | Agent runtime — runs 3 persistent agents + subagent spawning |
| **Gatekeeper** | LLM proxy — routes API calls through CTG's keys, meters usage, phones home to Hub |
| **n8n** | Workflow automation — email triggers, scheduled tasks, webhook integrations |
| **Mission Control** | Dashboard — monitoring, client/agent onboarding forms |

### CTG Hub (on Charlie's WSL)

| Service | Purpose | Clients depend on it? |
|---------|---------|----------------------|
| **Paperclip** | Shared agent registry + task management for all clients | Yes |
| **Hub** | Usage reporting, health checks, license enforcement, remote commands | Yes |
| **Sanitization endpoint** | Content classification via Nemotron/LLM Guard | Yes |
| **Charlie's OpenClaw** | Dude, Walter, Bonny, and other internal agents | No |

### Network Architecture

```
┌─────────────────────────────────────────────┐
│  Client Mac (Docker)                        │
│                                             │
│  ┌───────────┐  ┌───────────┐  ┌─────────┐ │
│  │  OpenClaw  │  │Gatekeeper │  │   n8n   │ │
│  │ 3 agents  │  │ LLM proxy │  │workflows│ │
│  │ +subagents│  │  + meter   │  │         │ │
│  └─────┬─────┘  └─────┬─────┘  └────┬────┘ │
│        │              │              │      │
│  ──────┴──────────────┴──────────────┴───  │
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
│  CTG Hub (Charlie's WSL)                     │
│                                              │
│  ┌──────────┐ ┌─────┐ ┌──────────────────┐  │
│  │Paperclip │ │ Hub │ │ Sanitization     │  │
│  │ (shared) │ │     │ │ Nemotron+Guard   │  │
│  └──────────┘ └─────┘ └──────────────────┘  │
└──────────────────────────────────────────────┘
```

### Network rules

- **internal-net**: Isolated, no internet. OpenClaw, Gatekeeper, n8n communicate here.
- **gateway-net**: Internet access. Gatekeeper reaches OpenAI/Anthropic APIs. Mission Control is accessible.
- **Gatekeeper bridges both networks** — the only path from agents to the outside world.
- **Tailscale** connects client Macs to CTG Hub — Paperclip, Hub, sanitization, gateway RPC.

### Connectivity Matrix

| Path | Protocol | Purpose |
|------|----------|---------|
| Client OpenClaw → CTG Paperclip | HTTP over Tailscale | Agent registry, task state |
| Client Gatekeeper → CTG Hub | HTTP over Tailscale | Usage reporting, health, update checks |
| Client subagent → CTG sanitization | HTTP over Tailscale | Content classification (Rule of Two) |
| Client Aimee → CTG Dude | `sessions_send` over Tailscale | Agent escalation requests |
| CTG → Client OpenClaw gateway | Gateway RPC over Tailscale | Diagnostics, commands, remote updates |

---

## 3. LLM Routing & Gatekeeper

### Agent model assignments

| Agent | Primary Model | Fallback | Provider |
|-------|--------------|----------|----------|
| **Aimee** | GPT-5.4 | — | OpenAI |
| **CTO** | Claude Sonnet 4.6 | Claude Opus 4.6 | Anthropic |
| **Jr** | GPT-4o-mini | — | OpenAI |
| **Subagents** | GPT-4o-mini | — | OpenAI |

All models use standard API keys (no Codex OAuth). Keys are stored in CTG's Gatekeeper environment variables. Clients never see them.

### Gatekeeper routing

| URL path | Provider | Model | Used by |
|----------|----------|-------|---------|
| `/llm/openai/agents/primary/...` | OpenAI | GPT-5.4 | Aimee |
| `/llm/anthropic/agents/cto/...` | Anthropic | Sonnet 4.6 | CTO |
| `/llm/openai/agents/jr/...` | OpenAI | GPT-4o-mini | Jr |
| `/llm/openai/agents/*/...` | OpenAI | GPT-4o-mini | Any subagent |

### Gatekeeper responsibilities

- **LLM proxy**: Routes requests to OpenAI/Anthropic, injects API keys, strips client auth
- **Usage metering**: Logs per-agent model usage to SQLite ledger
- **Hub phone-home**: Reports usage, health to CTG Hub every 5 minutes
- **Content sanitization routing**: Forwards dirty content to CTG sanitization endpoint over Tailscale
- **Auth**: Accepts `Authorization: Bearer` or `x-api-key` header with internal token

### Content sanitization flow

1. Jr spawns a quarantined subagent for dirty work (email body, web scrape)
2. Subagent sends raw content to CTG sanitization endpoint (Tailscale)
3. CTG pipeline (Nemotron / LLM Guard) classifies and sanitizes
4. Clean text returned to subagent
5. Subagent passes sanitized result to Jr
6. Jr passes to Aimee

No local LLM needed on client Mac. CTG's GPU (RTX 5080) handles all sanitization.

---

## 4. Security Model

### Managed Agent Security

The restrictions ARE the product. CTG Core is safe BECAUSE CTG controls who joins the team.

**Core principles:**

- **Only CTG provisions persistent agents** — every agent goes through: job description → role definition → Slack channel → SOPs → skills → tool access → cron routines → training → risk assessment → deployment
- **Mission Control is the only door** — all company and agent creation goes through MC forms. No API backdoors, no direct Paperclip writes from client side.
- **Agents are self-aware of their scope** — when work falls outside their lane, they naturally suggest "this could benefit from a specialized agent" and guide the client to contact CTG
- **Subagents are the escape valve** — ephemeral, sandboxed, quarantined, monitored. They handle ad-hoc work without compromising the security perimeter.

### Quarantine (Rule of Two)

- **Docker network isolation**: internal-net has no internet access. Agents can't reach the outside world directly.
- **Gatekeeper as chokepoint**: the only path to external APIs. All traffic logged and metered.
- **Subagent sandboxing**: `workspaceOnly: true`, limited tool access, no Slack channel, no persistent state.
- **Content sanitization**: dirty content (emails, web scrapes) routed to CTG pipeline before touching trusted agents.

### Paperclip access control

- **CTG admin key**: full read/write — create companies, agents, modify config. Only on CTG Hub.
- **Client read-only key**: query their own agents and tasks. Cannot create agents or companies.
- **Edge agents**: connect to Paperclip for task state only. No provisioning capability.

### Why clients can't create agents

If a client creates agents with untrained skills, sends them to research sketchy sources, or gives them unrestricted access — the system can get compromised. Under CTG's managed service model:

- Every agent is vetted, trained, and restricted
- Tool access is curated per role
- SOPs define behavioral boundaries
- Risk is assessed before deployment
- The client gets security through expert management

---

## 5. Agent Definitions

### The 3 persistent agents

| | Aimee | CTO | Jr |
|---|---|---|---|
| **Role** | Orchestrator, primary client contact | Technical specialist | Admin, triage, dirty work |
| **Model** | OpenAI GPT-5.4 | Anthropic Sonnet (Opus fallback) | OpenAI GPT-4o-mini |
| **Slack** | Own bot app | Own bot app | Own bot app |
| **Spawns subagents** | Yes — delegates to CTO and Jr | Yes — technical deep-dives | Yes — email, web, quarantined tasks |
| **Tools** | Lobster, sessions, agent-to-agent | Lobster, coding, exec, sessions | Lobster, web search, web fetch, sessions |
| **fs access** | workspaceOnly | workspaceOnly | workspaceOnly |
| **CTG equivalent** | Dude | Walter | Bonny |

### Soul.md guidance (all agents)

- Role and boundaries clearly defined
- Awareness that additional capabilities require CTG provisioning: "This type of work could benefit from a specialized agent — CTG can set that up"
- Rule of Two understanding — Jr knows to quarantine and sanitize dirty content
- Collaboration patterns — how to work with the other two agents via shared Slack channels
- Escalation path — `sessions_send` to CTG's team for requests beyond scope

### Subagent rules

- All subagents use GPT-4o-mini (cheapest)
- Quarantined: workspaceOnly, limited tools, no Slack, no persistent state
- Spawned and killed by parent agent (Aimee, CTO, or Jr)
- Dirty content routed through CTG sanitization before reaching parent

---

## 6. Hub & Remote Management

### Hub phone-home flow

1. Client Gatekeeper checks in every 5 minutes via Tailscale
2. Reports: agent status, usage since last check-in, service health
3. Hub responds with: any pending commands (skill updates, config changes, restart orders)
4. Gatekeeper applies commands locally

### Remote capabilities

- **Skill push**: CTG develops new skills, pushes to client OpenClaw via Hub
- **Soul/config updates**: Update agent personality, model routing, behavioral rules
- **Update checks**: Client Gatekeeper asks "is there a new version?" — Hub responds with update instructions
- **Gateway RPC**: Direct access to client's OpenClaw gateway over Tailscale for diagnostics, session monitoring, command execution

### Spending monitoring

- Gatekeeper meters all LLM usage per agent to SQLite ledger
- Usage data reported to Hub on every check-in
- Hub dashboard shows per-client, per-agent spending
- Manual monitoring for now — no automated hard caps
- Data is available for future automated limits if needed

---

## 7. Mission Control Expansion

### Current state

Vanilla HTML/CSS/JS app with 2 tabs (Dashboard, Memory). Tab system already implemented. Adding tabs is ~5-10 lines HTML + a JS file per tab. No framework, no build step.

### New tabs

| Tab | Content | Data source |
|-----|---------|-------------|
| **Clients** | Client list, onboarding form, per-client health/status tracker | Hub API |
| **Agents** | Agent roster (all clients), onboarding form, role/soul editor | Paperclip API |
| **Usage** | Per-client and per-agent spending, trends, breakdowns | Gatekeeper ledger via Hub |

### Client onboarding form

- Company name, contact info, Slack workspace
- Number of agents (starts at 3)
- Tailscale IP (assigned during setup)
- Generates: company ID, credentials, compose config
- Status tracker: provisioned → configured → deployed → live

### Agent onboarding form

- Select client (dropdown)
- Agent name, role, model tier
- Job description, tool access, SOP templates
- Submitting triggers `bot-deploy` skill + `slack-provision` workflow
- Status: drafted → approved → provisioned → deployed → live

### Access control

- **Mission Control is the ONLY way to create companies or agents**
- MC forms hit Hub/Paperclip API with admin credentials
- Client-side OpenClaw has read-only Paperclip access
- Edge agents cannot reach Mission Control (wrong network)
- CTG's agents (Dude/Bonny) can fill out MC forms programmatically via API

### Agent-initiated onboarding flow

1. Client asks Aimee for something beyond scope
2. Aimee suggests specialist agent, sends `sessions_send` request to CTG's Dude
3. Dude/Bonny opens MC, fills agent onboarding form
4. Charlie reviews and approves
5. `bot-deploy` + `slack-provision` runs
6. New agent config pushed to client via Hub
7. Agent goes live in client's Slack

---

## 8. Onboarding & Installation

### Target environment

- Apple Mac Mini or Mac Studio with M4 chip
- Docker Desktop installed
- Tailscale installed, joined to CTG tailnet
- 2 separate client deployments (independent companies)

### Pre-deployment (CTG side)

1. Register client company in Paperclip via MC Clients form
2. Register 3 agents (Aimee, CTO, Jr) via MC Agents form
3. Generate credentials: Gatekeeper token, OpenClaw auth token, company ID
4. Create 3 Slack bot apps in client's Slack workspace
5. Write agents' soul.md, SOPs, skills
6. Assign Tailscale IP

### On the client Mac

1. Install Tailscale, join CTG tailnet
2. Install Docker Desktop
3. Run deploy script — pulls 4-service compose, injects credentials
4. First boot: OpenClaw connects to CTG Paperclip, Gatekeeper phones home, agents come online
5. Verify all 3 agents respond in Slack

### Post-install verification (CTG side)

1. Verify via gateway RPC over Tailscale — sessions, agent status
2. Hub dashboard shows client healthy, check-ins arriving
3. Paperclip shows all 3 agents registered and active
4. Run test conversation through each agent in Slack
5. Walk client through their Slack channels and group channels

### Deploy script updates needed

- Remove Postgres and Paperclip services from compose
- Point OpenClaw at CTG Paperclip via Tailscale IP
- Point Gatekeeper hub check-in at CTG Hub via Tailscale IP
- Add sanitization endpoint URL (Tailscale)
- Expose OpenClaw gateway port for Tailscale RPC access
- Tailscale IP injected as env var during deployment

---

## 9. Documentation

### Internal Technical Reference (for CTG)

- Complete architecture: every service, how they connect, why
- CTG Hub: Paperclip, Hub, sanitization — what it hosts and exposes
- Client stack: 4 Docker services, network layout, Tailscale connectivity
- LLM routing: provider config, Gatekeeper flow, model costs
- Security model: Rule of Two, quarantine, network isolation, managed provisioning
- Agent definitions: internal agents + client 3-agent template
- Phase 1-4 changes: what was built, what it does, where it lives
- Hub phone-home: check-in protocol, remote updates, skill pushes
- Mission Control: tabs, forms, API endpoints, access control
- Onboarding process: client + agent provisioning steps
- Deployment: how to build, push, deploy to client Macs
- Troubleshooting: common issues, diagnostics

### Client-Facing Guide (for clients)

- What they're getting: "Your managed AI team"
- Meet the team: Aimee, CTO, Jr — what each does, how to interact
- Slack: channels, group channels, what to ask each agent
- Security: why it's safe, what managed means, why restrictions exist
- Adding capabilities: how to request new agents, what the process looks like
- What CTG handles: infrastructure, updates, monitoring, API costs, security
- What they don't need to worry about: everything technical

---

## 10. Implementation Scope

### A. Audit & Product Definition

- Inventory current CTG Core vs. what v1.0 needs to be
- Document delta from Phase 4 changes
- Define what's in the client package vs. what stays on CTG Hub

### B. Docker Stack Update

- Remove Postgres + Paperclip from client compose
- Update OpenClaw to connect to remote Paperclip via Tailscale
- Update Gatekeeper: hub phone-home, sanitization routing to CTG WSL
- Update seed config: 3 agents, correct LLM routing, OpenAI GPT-5.4/4o-mini
- Update deploy script for 4-service stack + Tailscale dependency

### C. Hub Infrastructure

- Expose Paperclip over Tailscale
- Expose sanitization endpoint over Tailscale
- Hub API: client CRUD, agent onboarding, remote skill push, update checks
- Gateway RPC access over Tailscale for client diagnostics

### D. Gatekeeper Updates

- OpenAI provider support for GPT-5.4 + GPT-4o-mini routing
- Subagent wildcard routing (dynamic agent IDs)
- Sanitization call to CTG WSL endpoint for dirty content
- x-api-key auth support (completed)

### E. Mission Control Expansion

- Clients tab with onboarding form + status tracker
- Agents tab with provisioning form + role editor
- Usage tab with per-client spending dashboard
- API endpoints backing the forms
- Access control: MC is the only way to create companies/agents

### F. Agent Definitions

- Soul.md for Aimee, CTO, Jr (client template versions)
- "Contact CTG for specialists" guidance baked into soul
- Subagent spawning rules and quarantine config
- SOPs for each agent role

### G. Documentation

- Internal technical reference
- Client-facing guide

### H. Deployment & Testing

- Build and push updated Docker images (multi-arch amd64 + arm64)
- Test full stack on Charlie's Mac first
- Deploy to 2 client Macs (M4)
- End-to-end validation: Slack conversations, agent collaboration, Paperclip connectivity, Hub check-ins, sanitization flow, subagent spawning

---

## 11. Known Risks & Mitigations

### Hub as single point of failure

CTG Hub (WSL) hosts Paperclip, Hub API, and sanitization. If it goes down:

| Service | Impact | Mitigation |
|---------|--------|------------|
| **LLM calls** | Continue working — 72-hour license grace period | Built into Gatekeeper |
| **Paperclip (tasks)** | Fails — agents can't read/write task state | Gatekeeper caches last-known agent roster locally; agents degrade to stateless mode |
| **Sanitization** | Fails — subagents can't classify dirty content | Block dirty-content processing until Hub returns; agents queue work rather than bypass sanitization |

**Future**: Move Hub services to a VPS or cloud instance for higher availability. For v1.0, CTG Hub uptime is Charlie's responsibility as part of the managed service.

### Paperclip multi-tenant isolation

Paperclip uses company-scoped API paths (`/api/companies/{companyId}/...`). For v1.0:

- Each client's OpenClaw is configured with ONLY their company ID
- Client read-only API key is scoped to their company (verify Paperclip supports this; if not, Gatekeeper proxies Paperclip requests and enforces company scoping)
- CTG admin key has cross-company access

**Must verify**: Does Paperclip enforce tenant isolation at the API key level, or only URL-level? If URL-only, add a Paperclip proxy layer in Gatekeeper that locks company ID per client token.

### n8n internet bypass

n8n sits on both `internal-net` and `gateway-net`. Agents on `internal-net` could potentially reach the internet through n8n, bypassing Gatekeeper. Mitigation:

- n8n only on `gateway-net` — agents reach n8n through Gatekeeper, which logs and controls the access
- OR: restrict n8n's internal-net access to webhook-only (no arbitrary HTTP from agents)
- Resolve during implementation — document the chosen approach

### Remote update integrity

Hub can push skill updates and SOP changes to client stacks. A compromised Hub could push malicious content. For v1.0:

- All pushes are manual (Charlie triggers them)
- Hub-to-client commands are authenticated via Gatekeeper internal token
- **Future**: Add content signing for pushed updates (hash verification before applying)

### Rollback

No automated rollback for v1.0. Mitigation:

- Docker images are tagged — can roll back to previous tag
- Agent configs are versioned in git (ctg-core repo)
- Manual rollback process documented in internal tech doc
- **Future**: Hub tracks config versions per client, supports rollback command

---

## 12. Open Decisions

These need answers before or during implementation:

1. **Slack app ownership**: CTG creates the apps, CTG holds the tokens. Client grants workspace access. CTG can maintain and update bots without client involvement. Document this in the client agreement.

2. **Billing**: Manual for v1.0. Usage data from Gatekeeper ledger feeds into invoicing. Hub dashboard shows spending. No automated billing integration yet.

3. **Exec permissions**: Current seed config has `exec.security: "full"` with `ask: "off"`. For client deployments, restrict to specific commands or require approval. Resolve per-agent during implementation.

4. **Client Mac remote access**: Gateway RPC over Tailscale for agent diagnostics. No SSH to client Macs unless client grants it. Sufficient for v1.0.

5. **Sanitization fallback**: When Hub is unreachable, agents BLOCK dirty-content processing (don't bypass). Queue work for when Hub returns. This is the safe default for a security-focused product.
