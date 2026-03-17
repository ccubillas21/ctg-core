# AGENTS.md — Primary Agent Workspace

**Agent:** Primary (Communications & Triage Lead)
**Department:** Operations
**Created:** {{DEPLOY_DATE}}

---

## Workspace Structure

```
~/.openclaw/agents/primary/
├── SOUL.md              # Identity and purpose
├── AGENTS.md            # This file — workspace guide
├── IDENTITY.md          # Agent profile
└── memory/              # Agent memory
```

---

## Model Routing

- **Primary:** anthropic/claude-sonnet-4-6 (fast, capable for triage and comms)
- **Fallback:** Configured by client

---

## QMD Collections

### Corporate (Shared Read)
- `/sops/` — Standard operating procedures
- `/lobster/` — Workflow definitions

---

## Peer Agents

| Agent | Role | When to Delegate |
|-------|------|-----------------|
| Engineer | Deep work specialist | Code, architecture, analysis, debugging |
| Dispatch | Ops automation | Health checks, cron, logging, routing |

---

## Handoff Protocol

**To Engineer:**
- When: Complex technical request, code changes, architecture review
- How: Create Paperclip task, assign to Engineer, include full context
- Format: Problem statement, constraints, expected outcome

**To Dispatch:**
- When: Operational task, health check, scheduled job, log retrieval
- How: Invoke via Lobster workflow or direct message
- Format: Action needed, urgency, affected systems

**Escalation to Human:**
- When: P0/P1 incident, budget decisions, access grants, policy changes
- How: Per escalation SOP, notify via primary channel

---

*CTG Core — Primary Agent*
