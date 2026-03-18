# OpenClaw Phase 3a — Trigger Daemon & Paperclip Activation

**Date:** 2026-03-18
**Author:** Charlie Cubillas + Claude Code (Architect)
**Status:** Approved
**Scope:** Aware-style trigger daemon, Paperclip activation, cron migration, Slack L3 approvals
**Parent spec:** `2026-03-18-openclaw-full-activation-design.md`

---

## 1. Problem Statement

Phase 1+2 established the agent roster, model stack, and directory structure. But agents can't do anything autonomously — there's no mechanism to wake them on schedule, on events, or on messages from each other. 13 legacy OpenClaw internal cron jobs handle heartbeats but lack focus-binding, autonomy gating, self-adaptation, and inter-agent messaging. Paperclip has 53 tasks but only 1 was ever auto-executed.

## 2. Goals

1. Replace all 13 legacy cron jobs with a standalone Aware-style trigger daemon
2. Enable agents to self-manage their awareness — create, adjust, and remove their own triggers
3. Activate Paperclip as a real task execution engine with budgets and specialist auto-checkout
4. Establish L3 approval flow via Slack for high-risk agent actions
5. Wire inter-agent messaging via inbox/ file system, replacing flaky `sessions_send`

## 3. Architecture

### 3.1 Overview

Single-process, modular Python package running as a systemd service. Four concurrent asyncio tasks: poll loop (30s), HTTP listener (:18800), inotify watcher on agent inbox/ directories, and Slack Socket Mode client for L3 approval callbacks.

Invokes agents via `openclaw agent --agent <id> --message "..." --deliver --channel slack` CLI command.

### 3.2 Module Layout

```
~/.openclaw/triggers/
├── daemon/
│   ├── __init__.py
│   ├── __main__.py        ← entry point, asyncio event loop
│   ├── poller.py          ← 30s poll cycle: evaluates cron/interval/poll/once triggers
│   ├── listener.py        ← aiohttp on :18800 (webhooks, health, metrics, Slack callbacks)
│   ├── watcher.py         ← inotify on all agent inbox/ dirs (on_message triggers)
│   ├── executor.py        ← invokes agents via openclaw CLI, groups by agent
│   ├── focus.py           ← reads focus.md, binds triggers to goals, auto-cancels on [x]
│   ├── autonomy.py        ← L1/L2/L3 gate: log, notify, or block+queue for approval
│   ├── approval.py        ← Slack Block Kit messages, callback handler, approval queue
│   ├── state.py           ← SQLite: dedup window, fire counts, trigger state, audit log
│   ├── config.py          ← reads/watches triggers.json per agent, hot-reload on changes
│   └── plaza.py           ← enforces posting limits (1 post + 2 comments per cycle)
├── daemon.db              ← SQLite state database
└── audit.log              ← human-readable audit trail
```

### 3.3 Runtime Flow

1. `__main__.py` starts asyncio loop with four concurrent tasks: poller, listener, watcher, slack_client
2. Poller runs every 30s — reads all agents' `triggers.json`, evaluates which are due, groups by agent
3. Listener serves `:18800` — receives webhooks at `/hook/{trigger-id}`, serves `/health`, `/metrics`, `/triggers/{agent}`, `/audit`
4. Watcher uses inotify on 9 `inbox/` directories — fires on_message triggers when files appear
5. Slack client connects via Socket Mode (using existing Dude bot) — sends L3 approval messages and receives interactive button callbacks
6. All three trigger sources feed into executor, which deduplicates (30s window) and invokes via CLI
7. Autonomy gate checks L1/L2/L3 before execution — L3 actions route to approval.py

**Note:** All agent directories reside on the native Linux filesystem (`~/.openclaw/agents/`), not `/mnt/c/`, so inotify functions reliably on WSL2.

### 3.4 Systemd Service

File: `~/.config/systemd/user/trigger-daemon.service`
- Auto-restart on failure
- `After=openclaw-gateway.service paperclip.service`
- Python 3.11+ in venv at `~/.openclaw/triggers/.venv/`
- Dependencies: `aiohttp>=3.9`, `inotify-simple>=1.3`, `croniter>=1.0`, `jsonpath-ng>=1.5`, `slack-sdk>=3.0` (for Socket Mode), `pyyaml>=6.0`

## 4. Trigger Types

Six trigger types, all defined in each agent's `triggers.json`:

| Type | Evaluation | Example |
|------|-----------|---------|
| `cron` | Cron expression match (tz-aware) | `0 9 * * *` — Dude morning brief |
| `interval` | N minutes since last fire | Every 30min — Paperclip queue check |
| `once` | Specific datetime, then auto-disables | One-shot reminder |
| `poll` | HTTP GET + JSON path assertion — fires when assertion **fails** (value != expect) or endpoint unreachable | Check gateway health every 5min |
| `on_message` | inotify on inbox/, filtered by `from_agents` | Jr → Dude relay |
| `webhook` | HTTP POST to `/hook/{id}`, HMAC validation | GitHub push events |

### 4.1 triggers.json Schema

```json
{
  "triggers": [
    {
      "id": "dude-morning-brief",
      "type": "cron",
      "config": { "expr": "0 9 * * *", "tz": "America/New_York" },
      "action_type": "research",
      "focus_ref": null,
      "reason": "Daily morning brief to team",
      "enabled": true,
      "max_fires": null,
      "cooldown_seconds": 300,
      "prompt": "Run morning brief: review Plaza feed, Paperclip queue, agent status. Post summary."
    },
    {
      "id": "dude-paperclip-check",
      "type": "interval",
      "config": { "minutes": 30 },
      "action_type": "heartbeat",
      "focus_ref": "task-execution",
      "reason": "Check Paperclip for new/stalled tasks",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Check Paperclip queue for assigned or stalled tasks. Execute or reassign as needed."
    },
    {
      "id": "dude-github-webhook",
      "type": "webhook",
      "config": { "path": "/hook/dude-github", "secret": "${GITHUB_WEBHOOK_SECRET}" },
      "action_type": "research",
      "focus_ref": null,
      "reason": "React to GitHub push/PR events",
      "enabled": true,
      "cooldown_seconds": 60,
      "prompt": "Review incoming GitHub event and determine if action is needed."
    },
    {
      "id": "dude-from-jr",
      "type": "on_message",
      "config": { "watch_inbox": true, "from_agents": ["jr"] },
      "action_type": "research",
      "focus_ref": null,
      "reason": "Receive goals and updates from Jr",
      "enabled": true,
      "cooldown_seconds": 0,
      "prompt": "Read and process the incoming message from Jr."
    },
    {
      "id": "walter-gateway-health",
      "type": "poll",
      "config": {
        "url": "http://localhost:18789/health",
        "json_path": "$.status",
        "expect": "ok",
        "interval_minutes": 5
      },
      "action_type": "heartbeat",
      "focus_ref": "infra-health",
      "reason": "Monitor gateway health, alert on change",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Gateway health check failed. Investigate and report status."
    }
  ]
}
```

### 4.2 Self-Adaptive Triggering

Agents can modify their own `triggers.json` during any session. The daemon's `config.py` watches for file changes and hot-reloads on the next poll cycle:

- Agent creates a new trigger (e.g., Dude sets a `once` trigger to follow up in 2 hours)
- Agent adjusts intervals (e.g., Smokey increases health check frequency during an incident)
- Agent disables triggers it no longer needs
- Focus-trigger binding handles the rest — `[x]` completion auto-disables associated triggers

**Guardrails:**
- Agents cannot create triggers for other agents (each writes only to its own triggers.json)
- Maximum 20 triggers per agent
- Minimum cooldown of 60 seconds on any trigger (except `on_message` triggers, which are exempt — urgent messages should not be delayed)
- All changes logged in audit.log with before/after diff (ADAPT entry)

**Environment variable expansion:** `config.py` expands `${VAR}` references in trigger configs using process environment variables. Missing variables cause the trigger to be disabled with an audit warning.

### 4.3 Deduplication

If multiple triggers fire for the same agent within the same 30s cycle, executor groups them into a single invocation with a combined prompt. Prevents the agent from being woken multiple times per cycle.

### 4.4 Error Handling & Retries

Failed agent invocations (non-zero exit, timeout, crash) are logged and retried on the next matching cycle. After 5 consecutive failures for a trigger, it is auto-disabled and an L2 alert is sent to Slack. Agents or Charlie can re-enable manually by setting `"enabled": true` in triggers.json.

CLI timeout: 300 seconds default per invocation, configurable per trigger via `timeout_seconds` field.

### 4.5 SQLite Schema (daemon.db)

```sql
CREATE TABLE trigger_state (
    trigger_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    last_fire_at TEXT,          -- ISO 8601
    next_fire_at TEXT,          -- for cron/interval/once
    fire_count INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    config_hash TEXT,           -- detect changes for ADAPT logging
    PRIMARY KEY (agent_id, trigger_id)
);

CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,    -- ISO 8601
    event_type TEXT NOT NULL,   -- FIRE, MESSAGE, BLOCKED, APPROVE, DENY, EXPIRE, ADAPT
    agent_id TEXT NOT NULL,
    trigger_id TEXT,
    trigger_type TEXT,
    detail TEXT,                -- focus ref, from agent, before/after, etc.
    autonomy_level TEXT,        -- L1, L2, L3
    status TEXT,                -- ok, error, pending, timeout
    duration_ms INTEGER
);

CREATE TABLE approvals (
    id TEXT PRIMARY KEY,        -- {agent}-{action-id}
    agent_id TEXT NOT NULL,
    trigger_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, approved, denied, expired
    decided_at TEXT,
    decided_by TEXT,
    slack_message_ts TEXT       -- for updating the Slack message after decision
);

CREATE TABLE plaza_counts (
    agent_id TEXT NOT NULL,
    cycle_id TEXT NOT NULL,     -- timestamp of cycle start
    posts INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    PRIMARY KEY (agent_id, cycle_id)
);
```

## 5. Autonomy Matrix

### 5.1 autonomy.json Schema

Each agent has its own `autonomy.json` at `~/.openclaw/agents/{name}/agent/autonomy.json`. The schema below is the default; agents may have different levels for the same action_type based on their specialization (e.g., Da Fino gets L2 for `security_scan` while others would get L3).

```json
{
  "autonomy": {
    "heartbeat":            "L1",
    "research":             "L2",
    "sop_writing":          "L2",
    "config_change":        "L3",
    "deployment":           "L3",
    "external_comms":       "L3",
    "security_scan":        "L2",
    "security_remediate":   "L3",
    "email_action":         "L3",
    "dashboard_ui":         "L2",
    "dashboard_structural": "L3"
  }
}
```

### 5.2 Autonomy Levels

- **L1 (auto+log):** Execute immediately, write to audit.log only
- **L2 (auto+notify):** Execute immediately, post summary to Slack `#openclaw-activity`
- **L3 (block+approve):** Block execution, queue to Slack approval flow

Each trigger declares an `action_type` field matching a key in autonomy.json. The autonomy gate checks the level before passing to executor.

### 5.3 L3 Approval Flow

```
Trigger fires → autonomy.py detects L3
  → approval.py creates: ~/.openclaw/approvals/pending/{agent}-{action-id}.json
  → Sends Slack DM via Block Kit:
      ┌──────────────────────────────────────┐
      │ 🔒 Approval Required                 │
      │                                      │
      │ Agent: Walter (CTO)                  │
      │ Action: Deploy updated gateway config│
      │ Trigger: walter-deploy-webhook       │
      │ Focus: infra-health                  │
      │                                      │
      │ [✅ Approve]  [❌ Deny]               │
      └──────────────────────────────────────┘
  → Charlie taps Approve/Deny in Slack
  → Callback received via Slack Socket Mode (not HTTP — Socket Mode delivers interactive payloads over WebSocket)
  → approval.py moves file to approved/ or denied/
  → Approved: executor invokes agent immediately
  → Denied: logged with reason, agent notified on next wake
  → No response in 4 hours: expires, logged as "timed out"
```

**Approval state:** Stored in SQLite (`daemon.db` `approvals` table) as the single source of truth. The directory `~/.openclaw/approvals/` exists for future use (e.g., JSON export for debugging) but the daemon manages lifecycle entirely through the database.

**Slack integration:** Uses existing Dude bot (Socket Mode). Only Charlie's Slack user ID can approve/deny (hardcoded safety check).

## 6. Focus System

### 6.1 focus.md Format

```markdown
# Focus — Dude (Worker)

## Active Goals
- [ ] Stand up Paperclip task execution pipeline {focus_ref: task-execution}
- [ ] Research PowerApps integration for first client {focus_ref: powerapps-research}
- [/] Morning brief pipeline with Jr and Walter {focus_ref: morning-brief}

## Completed
- [x] Phase 2 agent onboarding {focus_ref: phase2-onboard}
```

### 6.2 Focus-Trigger Binding

- Each trigger's `focus_ref` maps to a `{focus_ref: ...}` tag in focus.md
- `focus.py` reads focus.md on every poll cycle
- When a goal is marked `[x]`, all triggers with that `focus_ref` are auto-disabled
- System triggers use `focus_ref: null` — never auto-cancel
- Agents can add new focus items and create triggers referencing them in the same session

### 6.3 Seeding

After Paperclip task reclassification, scan each agent's assigned tasks and generate initial focus items. Agents refine from there.

## 7. Inter-Agent Messaging

### 7.1 Message Format (inbox/)

```markdown
---
from: jr
to: dude
timestamp: 2026-03-18T09:15:00Z
subject: New goal from Charlie
priority: normal
focus_ref: null
---

Charlie wants to add a PowerApps integration for the first client.
He said it's not urgent but should be researched before the next call.
```

Filename format: `{timestamp}-{from}-{subject-slug}.md`

### 7.2 Processing

- `watcher.py` detects new file via inotify → reads YAML frontmatter → matches against agent's `on_message` trigger (`from_agents` filter)
- If match: fires trigger, message content becomes part of the prompt
- After agent processes: file moves to `inbox/archive/`
- If no matching trigger: file stays in inbox, logged as unmatched

### 7.3 Sending Messages

During a session, agents write markdown files to the target agent's `inbox/` directory using filesystem access. No special tool needed.

Chain of command enforced by `from_agents` filter: Dude's on_message only fires for Jr, Walter's only for Dude, etc.

## 8. HTTP Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | `{"ok": true, "uptime": ..., "agents": 9, "triggers_loaded": N}` |
| `/metrics` | GET | Fire counts, latency p50/p95, failure rates, per-agent breakdown |
| `/hook/{trigger-id}` | POST | Webhook receiver, HMAC-SHA256 validation over raw body, signature in `X-Hub-Signature-256` header (GitHub convention) |
| *(Slack Socket Mode)* | *WebSocket* | *L3 approve/deny callbacks received via Socket Mode, not HTTP — see Section 5.3* |
| `/triggers/{agent}` | GET | Current trigger state for an agent (dashboard use) |
| `/audit` | GET | Last 100 audit entries as JSON (dashboard use) |

## 9. Monitoring & Watchdog

**Smokey's monitoring:**
- Interval trigger (every 15min) polls `/health` and `/metrics`
- Non-ok or connection refused → L2 alert to Slack
- Smokey does NOT restart the daemon

**Independent watchdog cron:**
```bash
*/5 * * * * curl -sf http://localhost:18800/health > /dev/null || (systemctl --user restart trigger-daemon.service && ~/.openclaw/triggers/watchdog-alert.sh)
```

`watchdog-alert.sh` posts to Slack `#openclaw-activity` via webhook: "Trigger daemon restarted by watchdog at $(date)".

Prevents circular dependency (Smokey depends on daemon). Plain cron, no agent involvement.

**Audit log format:**
```
2026-03-18T09:00:01Z | FIRE    | dude   | dude-morning-brief    | cron       | focus:null  | L2 | ok      | 12.3s
2026-03-18T09:00:01Z | FIRE    | smokey | smokey-health-sweep   | interval   | focus:null  | L1 | ok      | 3.1s
2026-03-18T09:15:00Z | MESSAGE | dude   | dude-from-jr          | on_message | from:jr     | L2 | ok      | 8.7s
2026-03-18T09:15:02Z | BLOCKED | walter | walter-deploy         | webhook    | focus:infra | L3 | pending | —
2026-03-18T09:16:30Z | APPROVE | walter | walter-deploy         | slack      | by:charlie  | L3 | ok      | 15.2s
2026-03-18T10:00:00Z | ADAPT   | smokey | smokey-health-sweep   | interval   | 15m→5m      | —  | —       | —
```

## 10. Cron Migration

### 10.1 Process

1. Read all 13 jobs from `~/.openclaw/cron/jobs.json`
2. Convert each to trigger definition in appropriate agent's `triggers.json`
3. Mapping: `schedule.kind: "cron"` → trigger type `cron`, `schedule.kind: "every"` → trigger type `interval`
4. Preserve `payload.message` as trigger `prompt`, `delivery` settings as trigger metadata
5. Backup `jobs.json` as `jobs.json.pre-phase3a`
6. After all agents' triggers verified firing, clear `jobs.json` to empty array

### 10.2 System Crontab (KEPT)

These stay — they're infrastructure, not agent work:
- `0 */6 * * *` — config backup script
- `*/1 * * * *` — AIMEE dashboard sync
- Disabled mailroom monitor (awaiting OAuth)
- New: `*/5 * * * *` — daemon watchdog

## 11. Paperclip Activation

### 11.1 Register Missing Agents

Currently registered: Charlie, CTO, Dude, Jr. Register via Paperclip API:
- Maude, Brandt, Smokey, Da Fino, Donny, Mailroom

### 11.2 Clean Ghost Agents

Deregister any cut agents still in Paperclip's roster.

### 11.3 Reclassify Tasks

53 existing tasks need agent assignments updated:
- Herald's notification tasks → Smokey
- Oracle's analytics tasks → Donny
- Scout's PM tasks → Dude
- Unassigned → Dude for triage

### 11.4 Set Budgets

| Agent | Monthly Budget |
|-------|---------------|
| Dude | $20 (Codex flat rate) |
| Walter | $30 ceiling |
| Maude, Brandt, Smokey, Da Fino, Donny, Mailroom | $2 each |

### 11.5 Task Execution Flow

```
Dude creates Paperclip task → assigns to specialist
  → Specialist's interval trigger fires (30min)
  → Agent checks Paperclip queue, finds assigned task
  → Autonomy gate: L1 (research) or L3 (deployment)
  → Agent executes, updates Paperclip status
  → Posts findings to Plaza
```

## 12. Plaza Posting Enforcement

The trigger daemon enforces max 1 post + 2 comments per agent per trigger invocation cycle. The daemon tracks post counts in its state and drops excess posts with a warning in the audit log.

Plaza infrastructure (SQLite index, directory structure, AIMEE MC tab) is Phase 3b scope.

## 13. Implementation Order

```
state.py + config.py            ← foundation, no deps
    ↓
focus.py + autonomy.py          ← reads focus.md + autonomy.json
    ↓
executor.py                     ← needs state for dedup
    ↓
poller.py + watcher.py          ← need config, focus, autonomy, executor
    ↓
listener.py + approval.py       ← need executor + Slack integration
    ↓
plaza.py                        ← hooks into executor post-run
    ↓
__main__.py                     ← wires everything together
    ↓
Populate triggers.json × 9 agents
    ↓
Populate autonomy.json × 9 agents
    ↓
Seed focus.md × 9 agents
    ↓
Paperclip activation (register, reclassify, budgets)
    ↓
Migrate 13 cron jobs → triggers.json, clear jobs.json
    ↓
Systemd service + watchdog cron
    ↓
End-to-end verification
```

## 14. Rollback Plan

- Stop daemon: `systemctl --user stop trigger-daemon.service`
- Restore cron jobs: `cp ~/.openclaw/cron/jobs.json.pre-phase3a ~/.openclaw/cron/jobs.json`
- Restore openclaw.json: `~/.openclaw/backups/restore-config.sh --latest`
- Paperclip tasks are additive — no data loss
- triggers.json / autonomy.json / focus.md are new files — delete to revert

## 15. End-to-End Verification

1. Daemon starts, `/health` returns ok
2. Cron trigger fires at scheduled time (test with `once` trigger set 1 minute out)
3. Interval trigger fires on schedule
4. Drop file in agent's `inbox/` → on_message fires → agent processes → file moves to `inbox/archive/`
5. POST to `/hook/{id}` → webhook trigger fires
6. L3 action → Slack approval message appears → tap Approve → agent executes
7. L3 action → tap Deny → action logged, not executed
8. L3 action → wait 4h → expires
9. Agent self-modifies triggers.json → daemon picks up change → audit shows ADAPT
10. Mark focus item `[x]` → associated triggers auto-disable
11. Smokey's health sweep detects daemon status
12. Kill daemon → watchdog cron restarts within 5 minutes
13. Paperclip task assigned to specialist → specialist picks up on next interval trigger

## 16. Phase 3b Scope (Separate Spec)

Not covered here — separate design session:
1. Memory vault (session transcripts → markdown, daily summaries, Obsidian-ready)
2. AIMEE Mission Control "Memory" tab
3. Plaza knowledge feed (SQLite index + directory structure + posting rules)

## 17. References

- [Clawith Aware system](https://github.com/dataelement/Clawith) — trigger daemon inspiration
- [Parent spec](2026-03-18-openclaw-full-activation-design.md) — full activation design
- [OpenClaw invocation methods](reference in Claude Code memory) — CLI, Gateway RPC, cron, sessions_send
