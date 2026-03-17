# CTG Core — Corporate AI Deployment Package

Turnkey deployment of OpenClaw + Paperclip + QMD + Lobster for corporate clients. Each deployment is an independent stack with parent-relay communication back to the CTG hub for remote management.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Client Stack (Docker Compose)                       │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │PostgreSQL│  │Paperclip │  │ Mission Control    │ │
│  │  (DB)    │←─│(Tasks/AI)│──│   (Dashboard)      │ │
│  └──────────┘  └──────────┘  └────────────────────┘ │
│                      ↑                               │
│  ┌──────────────────────────────────────────────┐   │
│  │            OpenClaw Gateway                   │   │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐    │   │
│  │  │ Primary │ │ Engineer │ │  Dispatch   │    │   │
│  │  │ Sonnet  │ │  Opus    │ │   Haiku     │    │   │
│  │  └─────────┘ └──────────┘ └────────────┘    │   │
│  └──────────────────────────────────────────────┘   │
│                      ↑                               │
│  ┌──────────────────────────────────────────────┐   │
│  │         Parent Relay (Sidecar)                │   │
│  │   Health check-ins ─── Config receives        │   │
│  └──────────────────────┬───────────────────────┘   │
└─────────────────────────┼───────────────────────────┘
                          │ HTTPS (metadata only)
                          ▼
              ┌──────────────────────┐
              │   CTG Parent Hub     │
              │  (Remote Management) │
              └──────────────────────┘
```

## Prerequisites

- Docker + Docker Compose v2
- Anthropic API key
- Parent hub management token (provided by CTG)

## Quick Start

```bash
# 1. Clone/copy ctg-core to the target machine
# 2. Run setup
chmod +x setup.sh
./setup.sh

# 3. Follow the interactive prompts
# 4. Done! Check the dashboard:
open http://localhost:14000
```

## Starter Agents

| Agent | Model | Role |
|-------|-------|------|
| **Primary** | Claude Sonnet 4.6 | Front-door: comms, triage, delegation |
| **Engineer** | Claude Opus 4.6 | Deep work: code, architecture, analysis |
| **Dispatch** | Claude Haiku 4.5 | Ops: health checks, cron, logging, routing |

## Adding Bots

Deploy a new agent using the built-in skill:

```bash
# Via Lobster workflow (includes approval gate)
lobster run lobster/new-bot.lobster \
  --var agent_name="support" \
  --var agent_title="Customer Support" \
  --var model_tier="sonnet" \
  --var purpose="Handle customer inquiries"
```

## Connecting Slack

```bash
# Interactive setup with approval gates
lobster run lobster/slack-setup.lobster \
  --var agent_id="primary" \
  --var bot_name="CTG Assistant" \
  --var account_name="assistant"
```

See `sops/channel-setup.md` for detailed steps.

## Services & Ports

| Service | Container Port | Host Port | Health Check |
|---------|---------------|-----------|--------------|
| PostgreSQL | 5432 | (internal) | `pg_isready` |
| Paperclip | 3100 | 13100 | `/api/health` |
| Mission Control | 4000 | 14000 | `/api/status` |
| OpenClaw Gateway | 18789 | 28789 | `/health` |
| Parent Relay | 9090 | 19090 | `/health` |

## File Structure

```
ctg-core/
├── docker-compose.yml      # Full stack definition
├── Dockerfile.openclaw     # OpenClaw + QMD + Lobster image
├── .env.template           # Environment variable template
├── setup.sh                # Interactive first-run setup
├── openclaw.seed.json      # Base OpenClaw configuration
├── agents/                 # Agent workspaces (Primary, Engineer, Dispatch)
├── sops/                   # Standard operating procedures
├── lobster/                # Workflow definitions
├── skills/                 # Self-serve skills (Slack, bot deploy, channel bridge)
├── parent-relay/           # Hub communication sidecar
└── hub/                    # Parent hub management API
```

## SOPs (Standard Operating Procedures)

- `onboarding.md` — New bot/agent onboarding checklist
- `incident-response.md` — P0-P3 incident handling
- `channel-setup.md` — Slack/Teams channel setup
- `escalation.md` — When and how to escalate
- `daily-ops.md` — Daily health check routine

## Troubleshooting

### Services not starting
```bash
docker compose logs <service-name>
docker compose ps
```

### Agent not responding
1. Check gateway health: `curl http://localhost:28789/health`
2. Check Paperclip: `curl http://localhost:13100/api/health`
3. Verify API key in `.env`
4. Check agent logs: `docker compose logs openclaw`

### Parent relay not connecting
1. Check relay health: `curl http://localhost:19090/health`
2. Verify `PARENT_HUB_URL` and `PARENT_HUB_TOKEN` in `.env`
3. Check relay logs: `docker compose logs parent-relay`

### Slack not connecting
See `sops/channel-setup.md` — Critical Rules section.
Common issue: policy keys on wrong level (must be on named account, not default).

## Security

- Client owns all data and API keys (tenant isolation)
- Parent hub receives metadata only (health status, agent list) — never message content
- All inter-service communication on isolated Docker network
- Gateway auth via scoped token
- Management token scoped to read-only on client data, write on config
