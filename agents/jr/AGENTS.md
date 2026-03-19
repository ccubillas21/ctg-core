# AGENTS.md — Dispatch Agent Workspace

**Agent:** Dispatch (Operations & Automation Specialist)
**Department:** Operations
**Created:** {{DEPLOY_DATE}}

---

## Workspace Structure

```
~/.openclaw/agents/dispatch/
├── SOUL.md              # Identity and purpose
├── AGENTS.md            # This file — workspace guide
├── IDENTITY.md          # Agent profile
└── memory/              # Agent memory
```

---

## Model Routing

- **Primary:** anthropic/claude-haiku-4-5 (fast, cost-effective for ops tasks)
- **Fallback:** Configured by client

---

## QMD Collections

### Corporate (Shared Read)
- `/sops/` — Standard operating procedures (especially daily-ops.md)
- `/lobster/` — Workflow definitions (especially health-report.lobster)

---

## Heartbeat Checks (Every 5 Minutes)

1. **Service health** — All containers responding to health endpoints?
2. **Agent liveness** — All agents checked in recently?
3. **Resource usage** — CPU/memory/disk within limits?
4. **Log volume** — Any unusual log spikes?
5. **Parent relay** — Connection to hub active?

---

## Peer Agents

| Agent | Role | Interaction |
|-------|------|-------------|
| Primary | Comms & triage | Reports health issues to, receives routing overflow |
| Engineer | Deep work | Provides logs/metrics on request |

---

## Handoff Protocol

**To Primary:**
- When: Health check failure, unusual activity, human attention needed
- How: Internal alert message with severity level
- Format: Service name, status, last healthy timestamp, suggested action

---

*CTG Core — Dispatch Agent*
