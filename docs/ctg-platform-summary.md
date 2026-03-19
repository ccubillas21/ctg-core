# CTG Platform — Technical Summary

**Cubillas Technology Group**
*Version 1.0 — March 18, 2026*

---

## What Is This?

CTG deploys AI agent teams for businesses. Instead of one chatbot answering questions, we install a coordinated team of AI agents — each with a specific role, personality, and chain of command — that work together to handle operations, communication, and decision-making.

The platform is called **OpenClaw**. Everything runs locally on the client's hardware. No data leaves the building unless the client explicitly connects external services.

---

## The Stack at a Glance

| Layer | What It Does | Technology |
|---|---|---|
| **Agents** | AI workers with roles and skills | OpenClaw (Node.js) |
| **Task Engine** | Assigns and tracks work | Paperclip |
| **Workflows** | Multi-step automations | Lobster |
| **Knowledge** | Searchable document memory | QMD |
| **Orchestration** | Scheduling, triggers, health | Trigger Daemon (Python) |
| **Credentials** | Secure API key isolation | n8n |
| **Dashboard** | Real-time monitoring | AIMEE Mission Control |
| **Deployment** | One-command client setup | Docker Compose |
| **Management** | Remote multi-tenant ops | Parent Hub + Relay |

---

## The Agent Team

Every deployment starts with three agents. Our internal system runs twelve.

### Starter Agents (Client Deployment)

| Agent | Role | AI Model | What They Do |
|---|---|---|---|
| **Primary** | Communications Lead | Claude Sonnet 4.6 | Handles incoming messages, triages requests, runs SOPs |
| **Engineer** | Technical Specialist | Claude Opus 4.6 | Deep technical work, code analysis, complex problem-solving |
| **Dispatch** | Operations | Claude Haiku 4.5 | Automation, health checks, scheduling, log management |

### Our Internal Team (Big Lebowski Theme)

| Agent | Character | Role | Model | Cost |
|---|---|---|---|---|
| The Dude | Worker | Chief of Staff | GPT-5.4 (Codex) | $20/mo flat |
| Walter | CTO | Architecture & infra | Claude Sonnet 4.6 | ~$5-10/mo |
| Bonny (Jr) | Junior | Triage & relay | GPT-4o-mini | ~$1/mo |
| Maude | Platform Eng | Internal tooling | GPT-4o-mini | ~$1/mo |
| Brandt | Containers | Docker, VMs | GPT-4o-mini | ~$1/mo |
| Smokey | SRE | Monitoring, ops | GPT-4o-mini | ~$1/mo |
| Da Fino | Security | ClawSec scanning | GPT-4o-mini | ~$1/mo |
| Donny | Dashboards | Data & visualization | GPT-4o-mini | ~$1/mo |
| Mailroom | Email Triage | Quarantined scanner | Nemotron (local) | $0 |
| The Stranger | Data Airlock | Content sanitizer | Nemotron (local) | $0 |
| Knox | Research | Literature review | GPT-4o-mini | ~$1/mo |

**Total operating cost: ~$40-60/month** for a 12-agent team.

---

## How Agents Work Together

### Chain of Command

```
Charlie (Human)
  └── Jr (Bonny) — Triage & relay
        └── The Dude — Chief of Staff
              └── Walter — CTO
                    └── Specialists (Maude, Brandt, Smokey, Da Fino, Donny)
```

### Autonomy Levels

Agents don't just wait for orders. They operate within defined autonomy boundaries:

- **L1 — Auto + Log**: Heartbeats, health checks, routine scans. No human needed.
- **L2 — Auto + Notify**: Research, SOP execution, dashboard updates. Human gets a Slack message.
- **L3 — Block + Approve**: Config changes, deployments, external communications, security actions. Human must click Approve/Deny in Slack within 4 hours.

### Morning Briefing Chain

Every workday:

1. **8:00 AM** — Jr reviews overnight activity: Knox research, Mailroom triage, pending tasks
2. **9:00 AM** — Dude reviews Jr's brief + Plaza feed + Paperclip queue + agent health
3. **9:30 AM** — Walter audits infrastructure: gateway, daemon, services, n8n
4. **10:00 AM** — Donny scans dashboard data and proposes improvements

Each agent sends their findings to the next agent's inbox as a markdown file.

### Communication

Agents communicate through markdown files dropped in each other's `inbox/` directories with YAML frontmatter (sender, subject, priority, timestamp). Files move to `inbox/archive/` after processing.

---

## Services & Infrastructure

### Core Services

| Service | Port | Purpose |
|---|---|---|
| OpenClaw Gateway | 18789 | WebSocket daemon, agent execution, config hot-reload |
| Paperclip | 3101 | Task management, agent registry, budget enforcement |
| Trigger Daemon | 18800 | Scheduling, webhooks, file watchers, Slack integration |
| n8n | 5678 | Credential isolation, webhook workflows |
| AIMEE Mission Control | 4001 | Real-time dashboard (Azure Static Web Apps) |
| CTG Showcase | 8090 | Client-facing pitch site |

### Trigger Daemon

The brain of the scheduling system. A standalone Python service that replaced 16 legacy cron jobs with a unified engine:

- **30-second poll loop** for cron, interval, and poll triggers
- **Async HTTP server** for webhooks and inbox file watchers
- **Self-adaptive**: agents can modify their own triggers
- **Focus-trigger binding**: completed goals auto-cancel related triggers
- **Watchdog**: independent cron job alerts via Slack if daemon goes down
- **27 triggers across 12 agents**, 55 tests

### Security Model

Two layers prevent agents from accessing credentials or unfiltered external content:

1. **n8n (Credential Isolation)**: Agents call webhook URLs. n8n makes the actual API call with stored credentials. Agents never see API keys. If n8n is down, calls fail — no silent fallback.

2. **The Stranger (Content Airlock)**: When an agent needs external content (web pages, documents), The Stranger fetches and sanitizes it first. Raw external content never enters the trusted zone. Domain allowlist, rate limits (30/agent/hour), 50KB max response size.

### Visibility

- **Memory Vault**: Session transcripts converted to browsable markdown. SQLite index. 14-day rolling snapshot. Viewable in AIMEE MC or Obsidian.
- **Plaza**: Agent knowledge-sharing feed. Each agent posts findings, insights, and updates. Rate-limited to 1 post + 2 comments per cycle.
- **AIMEE Dashboard**: Live agent status, memory browser, team activity feed, cost tracking with calibrated correction factors.

---

## Client Deployment

### What Gets Installed

A single Docker Compose stack with five services:

| Container | Image | Purpose |
|---|---|---|
| `ctg-core-postgres` | PostgreSQL 16 Alpine | Database for Paperclip |
| `ctg-core-paperclip` | Paperclip (official image) | Task engine + agent registry |
| `ctg-core-openclaw` | Custom build (Node 22 Alpine) | Gateway + agents + QMD + Lobster |
| `ctg-core-mc` | Node 22 Alpine | Mission Control dashboard |
| `ctg-core-relay` | Custom build | Health check-ins to CTG hub |

### Deployment Scripts

**`deploy.sh`** — One command, full stack:
1. Detects OS (macOS/Linux), checks hardware (4GB RAM, 10GB disk minimum)
2. Checks and installs prerequisites (Docker, Tailscale, git, curl, jq, openssl)
3. Scans port availability (13100, 14000, 28789, 19090)
4. Generates secure credentials (Postgres password, auth token, company UUID)
5. Prompts for Anthropic API key
6. Builds Docker images, starts all services, waits for health checks
7. Seeds Paperclip with company and 3 starter agents
8. Prints all service URLs including Tailscale addresses

**`uninstall.sh`** — Clean removal across 11 categories:
Docker containers, images, volumes, networks, compose projects, config directories, npm packages, Homebrew packages, system services, cron jobs, shell profile references. Requires typing `UNINSTALL` to confirm. Supports `--dry-run`.

### Remote Management

The **Parent Relay** sidecar checks in with CTG's hub every 5 minutes, reporting health status and agent inventory. The hub can push:
- Config updates (triggers gateway reload)
- SOP documents (written to the client's SOP directory)
- Bot deployment commands (triggers Lobster workflows)

The hub never receives message content — only metadata and health status.

---

## Included Assets

### Standard Operating Procedures (5)

| SOP | Owner | Purpose |
|---|---|---|
| Onboarding | Primary | New agent setup: role, model, workspace, channels |
| Channel Setup | Primary | Slack (Socket Mode) and Teams (Azure Bot) configuration |
| Daily Ops | Dispatch | Health checks, daily summaries, log rotation, backups |
| Escalation | Primary | When and how to escalate: agent → engineer → human → hub |
| Incident Response | Dispatch | P0-P3 severity, detection → investigation → mitigation flow |

### Skills (3)
- **slack-provision** — Automated Slack app creation and configuration
- **bot-deploy** — New agent deployment workflow
- **channel-bridge** — Cross-platform message bridging

### Lobster Workflows (4)
- **slack-setup** — End-to-end Slack integration
- **new-bot** — Agent provisioning pipeline
- **health-report** — Comprehensive health check
- **channel-bridge** — Cross-channel message routing

---

## Messaging Integrations

OpenClaw connects to 13+ platforms. Currently active:

| Platform | Status | Method |
|---|---|---|
| **Slack** | Active | Socket Mode, multi-account, Block Kit approvals |
| **Microsoft Teams** | Provisioned | Azure Bot Framework, 6 bots registered |
| Telegram | Supported | Bot API |
| Discord | Supported | Bot API |
| WhatsApp | Supported | Business API |
| Email (Gmail) | Code complete | Gmail API (OAuth pending) |
| Email (Outlook) | Code complete | Microsoft Graph (OAuth pending) |

---

## Infrastructure

### Hosting
- **Production**: WSL2 on Windows with CUDA (RTX 5080)
- **Client deployments**: Docker on client hardware (Mac Mini, Linux servers)
- **Dashboard**: Azure Static Web Apps (AAD-authenticated)
- **Networking**: Tailscale mesh (no port forwarding needed)

### Backup & Recovery
- Config backup every 6 hours (30-day retention)
- Restore script supports `--latest`, `--before YYYY-MM-DD`, or direct path
- Pre-phase rollback configs maintained for every major change
- n8n encryption key and data volume included in backups

### Cost Structure

| Component | Monthly Cost |
|---|---|
| GPT-5.4 via Codex OAuth | $20 (flat) |
| Claude Sonnet/Opus (Walter) | ~$5-10 |
| GPT-4o-mini (6 specialists) | ~$6 |
| Nemotron local (3 agents) | $0 |
| Azure Static Web Apps | Free tier |
| Azure Bot Framework | Free tier (F0) |
| Tailscale | Free tier |
| **Total** | **~$40-60/month** |

---

## What's Next

| Item | Status | Blocker |
|---|---|---|
| Phase 4c: End-to-end validation | Blocked | 9 items (Slack env vars, API keys, OAuth setup) |
| Cloudflare tunnels | Blocked | DNS migration + cert.pem re-auth |
| Mailroom first run | Blocked | Gmail/Graph OAuth setup |
| memsearch (vector search) | Deferred | Milvus-lite WSL2 bug |
| CTG Core Docker build test | Ready | None |
| Client deployment #1 | Tomorrow | Clean Mac + deploy.sh |
