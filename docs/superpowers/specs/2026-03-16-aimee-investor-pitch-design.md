# AIMEE — Investor Pitch Design

**Date:** 2026-03-16
**Author:** Charlie Cubillas (CEO, Cubillas Technology Group)
**Status:** Approved
**Context:** Angel investor meeting, 2026-03-17

---

## Product Name

**AIMEE** — Artificial Intelligence Management Environment for Everyone

Named after Charlie's wife. Personal, memorable, and the acronym describes the product. Clients remember the name — you're not selling "enterprise AI infrastructure," you're giving them AIMEE.

---

## One-Liner

"AIMEE deploys and manages AI agent teams for small businesses — like managed IT, but for AI."

---

## Why Us

Charlie Cubillas has spent his career in IT infrastructure and managed services — he knows what it takes to deploy, monitor, and support technology for businesses that don't have engineering teams. He built the entire AIMEE stack himself: the container orchestration, the agent framework, the management hub, the relay system. This isn't a pitch deck — it's a working product built by someone who understands both the tech and the service delivery model.

---

## Problem (30 seconds)

Every SMB knows they need AI. None of them want to:

- Figure out which models to use
- Build and maintain agent infrastructure
- Write SOPs and workflows
- Manage Slack integrations
- Keep it all secure and updated

They want it to just work. The big consultancies charge $200K+ for this. The DIY tools assume you have an engineer on staff. There's nothing in the middle.

---

## Solution (60 seconds)

AIMEE is a turnkey AI agent stack. We deploy a team of specialized agents into the client's existing tools — starting with Slack. Each client gets:

- **3 starter agents** — a front-door communicator (Sonnet), a deep-work engineer (Opus), and an ops monitor (Haiku)
- **Managed SOPs** — we write and update the playbooks agents follow
- **Workflow automation** — pipelines with human approval gates for anything with side effects
- **A management relay** — we monitor health, push updates, and deploy new bots remotely. The client never touches infrastructure.

The client owns their data and API keys. We manage the brains.

---

## Why Now

- Model quality just crossed the threshold where agents can reliably handle real business tasks
- Anthropic's Claude lineup gives us three cost tiers (Haiku/Sonnet/Opus) that map perfectly to agent roles
- SMBs are actively looking for this — they see what AI can do but can't build it themselves

---

## Business Model

| Offering | Price |
|---|---|
| **AIMEE Starter** | $500/month — 3 agents, Slack, managed SOPs, monitoring |
| **Additional Agents** | $200/month each — vertical-specific (recruiting, sales, etc.) |
| **Custom Work** | $150/hour — bespoke workflows, integrations, training |

**Unit economics per client:**

| Item | Monthly Cost |
|---|---|
| API usage (Claude) | $50–150 |
| Infrastructure (hosting share) | ~$20 |
| Ops time (~2 hrs/month at scale) | ~$50 internal cost |
| **Total cost** | **~$120–220** |
| **Revenue** | **$500+** |
| **Gross margin** | **~55–75%** |

Early clients require more hands-on time (~5 hrs/month). Margins improve as templates and SOPs mature and get reused across clients.

---

## Vertical Templates (Roadmap)

| Template | Agents Do |
|---|---|
| **AIMEE for Recruiting** | Screen resumes, schedule interviews, candidate comms |
| **AIMEE for Sales** | Lead qualification, CRM updates, follow-up drafts |
| **AIMEE for Trading** | Market monitoring, alert routing, research summaries |
| **AIMEE for Ops** | IT helpdesk, onboarding, internal knowledge base |

Each vertical is a template: pre-built agents + SOPs + workflows. Deploy in under an hour.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Client's AIMEE Stack (Docker Compose)               │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │PostgreSQL│  │Paperclip │  │ Mission Control    │ │
│  │  (DB)    │←─│(Tasks/AI)│──│   (Dashboard)      │ │
│  └──────────┘  └──────────┘  └────────────────────┘ │
│                      ↑                               │
│  ┌──────────────────────────────────────────────┐   │
│  │              AIMEE Gateway                    │   │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐    │   │
│  │  │ Primary │ │ Engineer │ │  Dispatch   │    │   │
│  │  │ Sonnet  │ │  Opus    │ │   Haiku     │    │   │
│  │  └─────────┘ └──────────┘ └────────────┘    │   │
│  └──────────────────────────────────────────────┘   │
│                      ↑                               │
│  ┌──────────────────────────────────────────────┐   │
│  │         Parent Relay (Sidecar)                │   │
│  │   Health check-ins → ← Config pushes          │   │
│  └──────────────────────┬───────────────────────┘   │
└─────────────────────────┼───────────────────────────┘
                          │ HTTPS (metadata only)
                          ▼
              ┌──────────────────────┐
              │     CTG Hub          │
              │  (Remote Management) │
              └──────────────────────┘
```

**Key design principles:**
- Client owns their data and API keys (tenant isolation)
- Parent hub manages via relay (metadata only, not data plane)
- Clients can self-serve new bots using baked-in skills
- All workflows have approval gates for side effects

---

## Competitive Landscape

- **Big consultancies (Accenture, Deloitte)** — charge $200K+ for AI deployments. Priced out of SMB market entirely.
- **DIY platforms (CrewAI, Relevance AI, Lindy)** — give you tools to build your own agents. SMBs without engineers can't use them.
- **AIMEE's lane** — white-glove managed service at SMB prices. We don't sell tools, we sell a working team of agents that we manage for you.

---

## Defensibility

- **Operational moat** — the value isn't the code, it's the SOPs, agent training, and managed service layer. Competitors can copy the stack but not the operational playbooks.
- **Switching cost** — once agents are embedded in a client's Slack and workflows, ripping them out is painful.
- **Network effect** — every AIMEE deployment phones home. Health data across all clients makes us better at managing the next one.

---

## Demo Plan (Meeting Day)

Pre-deploy AIMEE on Charlie's Mac before the meeting. Walk the investor through:

1. **Dashboard** — "Here's AIMEE running live right now"
2. **Slack** — Send a message, show Primary responding and triaging
3. **Hub** — "Here's how I manage your AIMEE deployment remotely from mine"
4. **Deploy a new bot** — Run the Lobster workflow live, show it appear

---

## The Ask

**$10,000** via simple SAFE (uncapped, or terms to discuss) for:
- First 3 AIMEE deployments (including investor as pilot #1)
- First vertical template (recruiting or sales — investor's choice)
- 3 months to prove recurring revenue

### 3-Month Milestones

| Month | Milestone |
|---|---|
| **Month 1** | Investor deployment live + first vertical template built |
| **Month 2** | 2 additional paying clients onboarded via investor's network |
| **Month 3** | 3 clients generating $1,500+/month MRR, first vertical proven |

### What Comes Next

If we hit 3 paying clients by month 3, we either bootstrap from revenue or raise a small seed ($50-100K) to hire a sales person and build 2 more verticals. The $10K proves the model — it's not meant to fund the company long-term.

---

## Investor's Angle

He's not just writing a check — he's AIMEE's first client. He gets to experience the product from the inside while his investment funds the next two deployments. A managed services guy running managed AI services — he'll get it immediately.

**Go-to-market for clients 2-3:** His network. A managed services professional knows other SMB owners who need this. We're not cold-calling — we're leveraging his warm introductions as the distribution channel for the first 90 days.

---

## Risks (Be Honest)

- **Model provider dependency** — currently Anthropic-only. Mitigation: the architecture supports any OpenAI-compatible provider. We can swap models without touching the client's deployment.
- **Client acquisition speed** — 3 clients in 3 months requires the investor's active referrals. If his network doesn't convert, timeline slips.
- **Founder bandwidth** — Charlie is the entire team right now. Each client takes hands-on time. This is why we start with 3, not 10.

---

## Current State of the Tech

- **Built:** Full AIMEE package (40 source files) — Dockerfile, docker-compose, 3 agent configs, 5 SOPs, 4 Lobster workflows, 3 skills, parent relay, hub API
- **Working:** Hub API live and tested (tenant CRUD, health check-ins, command relay)
- **Next:** Local test deployment on Mac, then first client deployment
- **Slack:** Fully supported (Socket Mode, multi-account)
- **Teams:** In progress (Azure Bot provisioned, integration needs polish)
