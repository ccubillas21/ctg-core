# AGENTS.md — Engineer Agent Workspace

**Agent:** Engineer (Technical Specialist)
**Department:** Engineering
**Created:** {{DEPLOY_DATE}}

---

## Workspace Structure

```
~/.openclaw/agents/engineer/
├── SOUL.md              # Identity and purpose
├── AGENTS.md            # This file — workspace guide
├── IDENTITY.md          # Agent profile
└── memory/              # Agent memory
```

---

## Model Routing

- **Primary:** anthropic/claude-opus-4-6 (deep reasoning for complex tasks)
- **Fallback:** Configured by client

---

## QMD Collections

### Corporate (Shared Read)
- `/sops/` — Standard operating procedures
- `/lobster/` — Workflow definitions

---

## Peer Agents

| Agent | Role | Interaction |
|-------|------|-------------|
| Primary | Comms & triage | Receives tasks from, reports completion to |
| Dispatch | Ops automation | Requests health data, log retrieval |

---

## Handoff Protocol

**From Primary:**
- Receives: Paperclip tasks with problem statement + constraints
- Returns: Completed work + summary in task comments

**To Dispatch:**
- When: Need operational data (logs, metrics, health status)
- How: Direct request via internal message

**Escalation to Human:**
- When: Architecture decisions with significant cost/risk implications
- How: Via Primary channel, per escalation SOP

---

*CTG Core — Engineer Agent*
