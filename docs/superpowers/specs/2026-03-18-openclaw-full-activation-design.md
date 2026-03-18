# OpenClaw Full Activation — Design Spec

**Date:** 2026-03-18
**Author:** Charlie Cubillas + Claude Code (Architect)
**Status:** Draft
**Scope:** Model stack overhaul, agent roster redesign, infrastructure activation, phased rollout

---

## 1. Problem Statement

The current OpenClaw deployment has 18 agents but only 3 do real work. Paperclip is installed but functions as a passive Kanban board — only 1 of 53 tasks was ever auto-executed. 10 of 16 cron-based heartbeats are disabled with consecutive errors. The governance/PMO layer (budgets, approvals, task execution) was set up structurally but never activated. Model costs are unpredictable (Qwen billing issues, MiniMax fallbacks). Specialist agents exist on the org chart but have never heartbeated.

## 2. Goals

1. Establish a working chain of command: Charlie → Jr → Dude → CTO → Specialists
2. Switch to cost-effective, reliable model stack ($40-60/mo total)
3. Activate Paperclip as a real task execution engine
4. Replace broken cron heartbeats with an event-driven trigger daemon
5. Install force multipliers: semantic memory, self-improvement, research automation, pre-build validation
6. Give every agent a reason to exist or cut it

## 3. Model Stack

| Agent | Primary Model | Fallback | Auth Method | Est. Monthly Cost |
|-------|--------------|----------|-------------|-------------------|
| Dude (Worker) | `openai-codex/gpt-5.4` | `anthropic/claude-sonnet-4-6` | Codex OAuth ($20/mo flat) | $20 |
| CTO (Walter) | `anthropic/claude-sonnet-4-6` | `anthropic/claude-opus-4-6` | API key | $15-30 |
| Jr (Bonny) | `openai/gpt-4o-mini` | `ollama/nemotron-3-nano:latest` | API key | ~$1 |
| Maude | `openai/gpt-4o-mini` | `ollama/nemotron-3-nano:latest` | API key | ~$1 |
| Brandt | `openai/gpt-4o-mini` | `ollama/nemotron-3-nano:latest` | API key | ~$1 |
| Smokey | `openai/gpt-4o-mini` | `ollama/nemotron-3-nano:latest` | API key | ~$1 |
| Da Fino | `openai/gpt-4o-mini` | `ollama/nemotron-3-nano:latest` | API key | ~$1 |
| Donny | `openai/gpt-4o-mini` | `ollama/nemotron-3-nano:latest` | API key | ~$1 |
| Mailroom | `ollama/nemotron-3-nano:latest` | `openai/gpt-4o-mini` | Local | $0 |
| Heartbeats/cron | `ollama/nemotron-3-nano:latest` | — | Local | $0 |
| Compaction | `ollama/nemotron-3-nano:latest` | — | Local | $0 |

**Total estimated: $40-60/month**

Qwen and MiniMax demoted to last-resort or removed entirely. Two primary providers: OpenAI + Anthropic. Ollama for free local work.

**Pre-requisite:** Validate that `openai-codex` is a working provider in OpenClaw v2026.3.13 before Phase 1 begins. Run `openclaw models list` and check for `openai-codex` provider. If unavailable or bug #38706 is unresolved, use CLIProxyAPI as bridge or fall back to `openai/gpt-4.1` (API-billed, ~$11/mo) for Dude until fixed. This changes budget ceiling to ~$50-70/mo.

**GPT-4o-mini token budget:** ~$1/mo per specialist agent corresponds to ~1.5M output tokens/month. Specialists only wake on triggers, so this is generous. If any agent enters a verbose loop, the trigger daemon's deduplication + focus binding prevents runaway costs.

## 4. Agent Roster (10 Active Agents)

### 4.1 Agent Directory Reconciliation

Current `~/.openclaw/agents/` has 17 directories. Disposition:

| Directory | Action | Notes |
|-----------|--------|-------|
| `worker` | **KEEP** as Dude | Primary agent, channel bindings stay |
| `cto` | **KEEP** as Walter | Unchanged |
| `jr` | **KEEP** as Jr/Bonny | Telegram=bonny, Slack=bonny |
| `mailroom` | **KEEP** | Quarantined, unchanged |
| `axiom` | **RENAME → maude** | Rename dir, update openclaw.json + Paperclip + channel bindings |
| `docker-2` | **RENAME → brandt** | Same rename process |
| `ops` | **RENAME → smokey** | Same rename process |
| `sentinel` | **RENAME → da-fino** | Same rename process |
| `donny` | **REPURPOSE** | Keep dir, rewrite soul.md for dashboard/viz role |
| `maude` | **CUT** | Old Delivery PM — deregister from config, archive dir |
| `scout` | **CUT** | Product PM — deregister, archive |
| `atlas` | **CUT** | VP AI Resources — deregister, archive |
| `herald` | **CUT** | VP Telecoms — deregister, archive |
| `oracle` | **CUT** | Predictive/Analytics — deregister, archive |
| `windows` | **CUT** | Windows/Edge — deregister, archive |
| `main` | **CUT** | Legacy default agent, superseded by worker/Dude |
| `claude-code` | **CUT** | Not an OpenClaw agent — Claude Code operates externally via CLI |

**17 directories → 10 active agents, 7 archived.** Cut agent directories are moved to `~/.openclaw/agents/.archive/` (not deleted) for easy recovery.

**Rename process:** No `openclaw agent rename` command exists. Each rename requires: (1) rename directory, (2) update `agents.{id}` key in openclaw.json, (3) update Paperclip agent registration, (4) update Telegram/Slack channel bindings, (5) update any cross-references in other agents' configs.

### 4.2 Agents CUT (7 removed + 2 legacy)

| Agent | Previous Role | Reason for Cut |
|-------|--------------|----------------|
| Scout | Product PM | Dude handles with Paperclip + focus.md |
| Maude (old dir) | Delivery PM | Trigger daemon + focus.md auto-tracks delivery |
| Atlas | VP AI Resources | Curiosity journal + AutoResearchClaw replaces this |
| Herald | VP Telecoms | Trigger daemon handles notifications natively |
| Oracle | Predictive/Analytics | AIMEE dashboard + poll triggers cover this |
| Windows | Windows/Edge | Too niche for a dedicated agent |
| main | Legacy default | Superseded by worker (Dude) |
| claude-code | External tool ref | Not an agent — Claude Code is external architect |

### 4.3 Active Roster (10 agents)

```
Charlie (CEO) — human, not an agent
  └─ Jr (Bonny) — Personal admin, journal keeper, your interface
      └─ Dude (Worker) — Chief of Staff, quarterback, coordinator
          ├─ Walter (CTO) — Technical executor, infrastructure
          ├─ Maude — Platform engineer, OpenClaw SME (renamed from Axiom)
          ├─ Brandt — Containers, VMs, PowerApps/Dataverse (renamed from Docker VP)
          ├─ Smokey — SRE, reliability, monitoring (renamed from Ops)
          ├─ Da Fino — Security patrol, anomaly detection (renamed from Sentinel)
          ├─ Donny — Dashboards, data visualization, Mission Control (repurposed)
          └─ Mailroom — Email triage, quarantined (unchanged)
```

### 4.4 Agent Role Definitions

**Jr (Bonny) — Personal Admin / Aide-de-Camp**
- YOUR interface to the system. You talk to Jr, Jr talks to Dude.
- Keeps journal notes, tracks your pending tasks, briefs you on status
- Dispatches email triage results from Mailroom
- Passes goals, ideas, and task progress to Dude
- Does NOT bother Dude with trivial status checks — handles those herself
- **Also the trusted half of Mailroom's Rule of Two**: Jr has Bonny's email skills (email-query, email-alert, email-action) installed. Mailroom sends structured JSON to Jr via inbox/; Jr acts on classifications with read-write OAuth tokens. The trust boundary is maintained because Jr never processes raw email content — only LLM Guard-scanned, sanitized snippets (max 200 chars) cross into Jr's inbox.
- Model: GPT-4o-mini | Channels: Telegram (bonny), Slack (bonny)
- Triggers: on_message (from Charlie + from Mailroom inbox), interval (30min status check)
- Autonomy: L1 (heartbeats), L2 (research, email alerts), L3 (email actions, external comms)

**Dude (Worker) — Chief of Staff / Quarterback**
- Receives structured goals from Jr, breaks into tasks, assigns to specialists
- Writes SOPs, skills, improvement plans that make the whole team better
- Dispatches research via AutoResearchClaw before execution
- Runs idea-reality-mcp validation (>70 = stop, 30-70 = differentiate, <30 = proceed)
- Coordinates specialist agents via Paperclip task assignments
- Posts discoveries to Plaza knowledge feed
- Directs Walter on infrastructure work
- Knows when to escalate to Claude Code for complex engineering
- Model: GPT-5.4 via Codex OAuth | Fallback: Sonnet 4.6
- Channels: Telegram (dude), Slack (dude)
- Triggers: on_message (from Jr), cron (morning brief 9am), interval (Paperclip queue 30min), webhook (GitHub, CI/CD)
- Autonomy: L2 for research/SOPs, L3 for external actions

**Walter (CTO) — Technical Executor**
- Takes direction from Dude on infrastructure and technical work
- Executes deployments, configurations, agent management
- Escalates to Claude Code (Charlie + me) for complex engineering
- Reviews code, runs deep audits, manages the OpenClaw platform
- Model: Sonnet 4.6 | Escalation: Opus 4.6
- Channels: Telegram (cto), Slack (walter)
- Triggers: on_message (from Dude), cron (daily audit 9:30am, weekly security Sun 7am), webhook (Grafana, deploy failures)
- Autonomy: L2 for audits, L3 for deployments/config changes

**Maude — Platform Engineer / OpenClaw SME**
- Deep expertise in OpenClaw internals, plugin system, skill architecture
- Monitors OpenClaw releases, evaluates new features, recommends upgrades
- Builds and maintains custom skills and plugins for the team
- FS unrestricted (needs access to OpenClaw internals)
- Model: GPT-4o-mini | Channels: Telegram (maude)
- Triggers: poll (OpenClaw GitHub releases), on_message (from Walter)
- Autonomy: L2 for research, L3 for config changes

**Brandt — Container & VM Specialist**
- Manages Docker containers, VMs, PowerApps, Dataverse
- Handles container lifecycle, image builds, orchestration
- Future: custom MCP server for Dataverse API
- Model: GPT-4o-mini | Channels: Telegram (brandt)
- Triggers: poll (container health), on_message (from Walter), webhook (Docker events)
- Autonomy: L2 for monitoring, L3 for deployments

**Smokey — SRE / Reliability**
- "There are rules." Enforces operational standards.
- Continuous health sweeps across all services
- Absorbs Herald's notification role + Oracle's monitoring
- Owns the service health endpoints and alerting
- Model: GPT-4o-mini | Channels: Telegram (smokey)
- Triggers: interval (15min health sweep), poll (all service endpoints)
- Autonomy: L1 for health checks, L2 for alerts

**Da Fino — Security Patrol**
- The private eye. Always watching.
- Runs TruffleHog scans, permission audits, CVE monitoring
- OpenMOSS "Patrol" pattern — anomaly detection
- ClawSec skill suite for drift detection and skill integrity
- Model: GPT-4o-mini | Channels: Telegram (da-fino)
- Triggers: cron (daily scan 3am), poll (CVE feeds), webhook (TruffleHog alerts)
- Autonomy: L2 for scanning, L3 for remediation

**Donny — Dashboard & Data Visualization**
- Owns Mission Control UI — layout, charts, panels, interactions
- Analyzes snapshot.json and agent session data for better visualizations
- Watches Plaza feed for dashboard ideas
- Proposes improvements to Dude, executes after approval
- Curiosity journal focused on dashboard inspiration
- Model: GPT-4o-mini | Channels: Telegram (donny)
- Triggers: cron (daily data scan 10am), on_message (from Dude), poll (snapshot.json schema changes)
- Autonomy: L2 for UI changes, L3 for structural/pipeline changes

**Mailroom — Email Triage (Quarantined)**
- Unchanged from existing code-complete design
- Quarantined agent: fetches, sanitizes, scans (LLM Guard), classifies, indexes
- Read-only OAuth tokens, no channels, no user interaction
- Rule of Two: Mailroom (untrusted) → Jr/Bonny (trusted, Slack alerts)
- Model: Nemotron (local) | Fallback: GPT-4o-mini
- Triggers: cron (bulk ingestion daily 2am), interval (5min monitoring)
- Autonomy: L1 for ingestion, L3 for any actions (via Jr)

## 5. Infrastructure

### 5.1 Aware Trigger Daemon

Single Python service (systemd) replacing all 16 legacy cron jobs.

**Architecture:** Two subsystems in one process:
1. **Poll loop** (every 30 seconds): evaluates cron, interval, poll, and once triggers by reading each agent's `triggers.json`
2. **Event listener** (async): HTTP server on `localhost:18800` for webhook triggers + inotify watcher on all agent `inbox/` directories for on_message triggers

- Groups fired triggers by agent — invokes once per agent per cycle
- 30-second deduplication window prevents duplicate invocations
- Focus-trigger binding: every trigger references a focus.md goal (system triggers like heartbeat exempt)
- When focus item is completed (`[x]`), associated triggers auto-cancel
- Failed triggers: log + retry next cycle. After 5 consecutive failures, trigger auto-disables with L2 alert to Slack (see Phase 3a spec Section 4.4)
- Health endpoint: `GET localhost:18800/health` returns JSON status for Smokey to poll
- Metrics endpoint: `GET localhost:18800/metrics` returns fire counts, latency, failure rates
- Audit log: `~/.openclaw/triggers/audit.log`

**triggers.json schema:**
```json
{
  "triggers": [
    {
      "id": "dude-morning-brief",
      "type": "cron",
      "config": { "expr": "0 9 * * *", "tz": "America/New_York" },
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
      "focus_ref": "task-execution",
      "reason": "Check Paperclip for new/stalled tasks",
      "enabled": true
    },
    {
      "id": "dude-github-webhook",
      "type": "webhook",
      "config": { "path": "/hook/dude-github", "secret": "${GITHUB_WEBHOOK_SECRET}" },
      "focus_ref": null,
      "reason": "React to GitHub push/PR events",
      "enabled": true
    },
    {
      "id": "dude-from-jr",
      "type": "on_message",
      "config": { "watch_inbox": true, "from_agents": ["jr"] },
      "focus_ref": null,
      "reason": "Receive goals and updates from Jr",
      "enabled": true
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
      "focus_ref": "infra-health",
      "reason": "Monitor gateway health, alert on change",
      "enabled": true
    }
  ]
}
```

**on_message mechanics:** Daemon uses inotify to watch `~/.openclaw/agents/{name}/inbox/` directories. When a new `.md` file appears, the daemon reads the frontmatter (from_agent, subject, priority) and fires the matching on_message trigger. After agent processes the message, file moves to `inbox/archive/`.

**webhook mechanics:** Daemon's HTTP server listens on `localhost:18800`. Webhook URLs follow pattern `/hook/{trigger-id}`. Payload is passed to the agent as trigger context. HMAC signature validation when `secret` is configured. Rate limited to 1 request per trigger per cooldown period.

**Chain of command enforcement:** Each agent's `soul.md` instructs it to only accept direction from its designated superior (Jr from Charlie, Dude from Jr, Walter from Dude). The `on_message` trigger's `from_agents` filter ensures only messages from authorized agents fire the trigger. Direct Telegram messages still work (agents are accessible) but soul.md instructs agents to route unexpected requests through the proper chain.

**Smokey's alerting:** Smokey operates at L1 for health checks (log only) and L2 for alerts (auto-send to Telegram + log). Health alerts to Telegram are classified as "monitoring notifications" not "external comms" — Smokey can autonomously notify Charlie when a service goes down without L3 approval.

**Plaza posting enforcement:** The trigger daemon enforces max 1 post + 2 comments per agent per trigger invocation cycle (each time the daemon groups and fires triggers for an agent). The daemon tracks post counts in its state and drops excess posts with a warning in the audit log.

**Inter-agent message format (inbox/):**
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
Messages are markdown files with YAML frontmatter. Filename format: `{timestamp}-{from}-{subject-slug}.md`. After processing, files move to `inbox/archive/`.

**L3 approval flow:**
When an agent attempts an L3 action, the trigger daemon:
1. Blocks execution and queues the action to `~/.openclaw/approvals/pending/{agent}-{action-id}.json`
2. Sends a Slack DM to Charlie via Block Kit interactive message (Approve/Deny buttons) using Dude bot Socket Mode
3. Charlie taps Approve or Deny in Slack
4. Callback received via Socket Mode, approval.py processes the decision
5. If no response within 4 hours, the action expires and is logged as "timed out"
6. Approved actions execute immediately; denied actions are logged with reason

**Note:** Updated from Telegram to Slack as of Phase 3a design (2026-03-18). See Phase 3a spec for full implementation details.

**Daemon watchdog:** In addition to Smokey polling the health endpoint, a standalone cron job (independent of the daemon) checks `localhost:18800/health` every 5 minutes. If unhealthy, it restarts the daemon via systemd and posts to Slack `#openclaw-activity` via `watchdog-alert.sh`. This prevents the circular dependency where Smokey depends on the daemon that triggers Smokey.

### 5.2 Agent File Structure (Standardized)

```
~/.openclaw/agents/{name}/
├── agent/
│   ├── soul.md              ← WHO: agency-agents template (immutable persona)
│   ├── memory.md            ← WHAT I KNOW: learned knowledge (grows over time)
│   ├── focus.md             ← WHAT I'M DOING: active goals with checkboxes
│   ├── curiosity-journal.md ← passive research findings with sources
│   ├── triggers.json        ← trigger definitions for daemon
│   └── autonomy.json        ← L1/L2/L3 per action type
├── .learnings/              ← self-improving-agent output
│   ├── LEARNINGS.md
│   ├── ERRORS.md
│   └── FEATURE_REQUESTS.md
├── skills/                  ← agent-specific skills
├── inbox/                   ← messages from other agents (markdown files)
├── plaza/                   ← posts for shared knowledge feed
└── workspace/               ← private working files
```

### 5.3 Tool Installations

| Tool | Purpose | Install Method | Serves |
|------|---------|----------------|--------|
| memsearch | Semantic vector search over agent memory | Docker or local Python, RTX 5080 embeddings | All agents |
| self-improving-agent | Error/correction capture → permanent knowledge | ClawHub skill install per agent | All agents |
| Capability Evolver | Meta-skill: detects failures, writes new skills | ClawHub skill install per agent | All agents |
| AutoResearchClaw | 23-stage autonomous research pipeline | Git clone + OpenClaw bridge adapter | Dude dispatches |
| idea-reality-mcp | Pre-build validation (scores 0-100) | MCP server install | Dude (mandatory gate) |
| n8n | Credential proxy + workflow automation | Docker via openclaw-n8n-stack | All agents |
| ClawSec | Security: drift detection, audits, skill integrity | ClawHub skill install | Da Fino + all agents |

### 5.4 Paperclip Activation

| Aspect | Current State | Target State |
|--------|--------------|--------------|
| Task execution | 1 of 53 auto-executed | Dude creates, specialists auto-checkout via trigger daemon |
| Budgets | $0 across the board | Per-agent monthly limits matching model costs |
| Heartbeats | Ad-hoc, 16 of 24 agents never connected | All 12 agents heartbeat via trigger daemon |
| Ghost agents | 16 never heartbeated | Deregistered — clean roster of 12 |
| Systemd | None (manual start) | `paperclip.service` with auto-restart |
| UI | Disabled | Enabled — data source for Donny's dashboards |
| Goals | 9 in "planned" status | Activated, bound to focus.md items |

### 5.5 Credential Isolation (n8n)

All external API credentials migrate from agent configs to n8n workflows.
Agents call webhook URLs, never see API keys.

```
Agent → webhook URL → n8n workflow → external API
```

Examples:
- Mailroom → n8n/gmail-fetch → Gmail API
- Da Fino → n8n/cve-check → NVD API
- Dude → n8n/github-search → GitHub API
- Walter → n8n/azure-deploy → Azure APIs
- Brandt → n8n/docker-api → Docker socket

### 5.6 Plaza Knowledge Feed

Shared directory + SQLite index where agents post discoveries:

```
~/.openclaw/plaza/
├── YYYY-MM-DD-{agent}-{topic}.md   ← discovery posts
└── feed.json                        ← indexed for dashboard
```

- Agents post during heartbeats (max 1 post + 2 comments per cycle)
- Donny surfaces in Mission Control as "Team Activity" panel
- Dude reviews in morning briefs, promotes actionable items to Paperclip tasks

### 5.7 Autonomy Matrix

| Action Type | L1 (auto+log) | L2 (auto+notify) | L3 (block+approve) |
|------------|---------------|-------------------|---------------------|
| Heartbeat/status check | All agents | — | — |
| Research/curiosity | — | All agents | — |
| SOP/skill writing | — | Dude, Maude | — |
| Dashboard changes | — | Donny | Structural changes |
| Config changes | — | — | Walter, Maude |
| Deployments | — | — | Walter, Brandt |
| External comms | — | — | All agents |
| Security actions | — | Da Fino (scan) | Da Fino (remediate) |
| Email actions | — | — | Mailroom (via Jr) |

## 6. Phased Rollout

### Phase 1: Foundation (Session 1)

1. Codex OAuth setup — `openclaw models auth login --provider openai-codex`
2. Model stack switch — Update openclaw.json for all agents
3. Deregister cut agents — Remove 7 agents from Paperclip + openclaw.json
4. Rename agents — Axiom→Maude, Docker VP→Brandt, Ops→Smokey, Sentinel→Da Fino
5. soul.md for core three — Jr, Dude, Walter
6. Chain of command wiring — on_message triggers: Charlie→Jr→Dude→Walter
7. Paperclip systemd service — Create paperclip.service
8. Verify — Goal flows from Charlie → Jr → Dude via Telegram

**Phase 1 rollback:** Restore openclaw.json from backup (`~/.openclaw/backups/restore-config.sh --latest`). Cut agents are only deregistered from config, not deleted — directories remain for easy re-registration.

### Phase 2: Agent Intelligence (Session 2)

9. Standardize agent file structure — All 12 agents get full layout (soul.md, memory.md, focus.md, .learnings/, inbox/, plaza/, workspace/)
10. soul.md for specialists — Maude, Brandt, Smokey, Da Fino, Donny
11. memsearch install — Docker/local, RTX 5080 embeddings, index existing memory (confirm GPU memory coexistence with Nemotron)
12. self-improving-agent skill — Install from ClawHub on all 12 agents (requires .learnings/ from step 9)
13. Capability Evolver skill — Install fleet-wide
14. ClawSec install — Da Fino primary, available to all

**Phase 2 rollback:** Remove skill files, revert agent directories to pre-step-9 state via backup. memsearch is a standalone service — stop it if problematic.

### Phase 3: Trigger Daemon & Paperclip Activation (Session 3)

15. Write trigger-daemon.py — Systemd service, 30-second poll loop + async event listener on :18800
16. Paperclip activation — Budgets, clean ghost agents, reclassify existing 53 tasks to new agent assignments, enable task checkout
17. focus.md per agent — Seed from reclassified Paperclip tasks (depends on step 16)
18. triggers.json per agent — All trigger assignments per schema in Section 5.1
19. autonomy.json per agent — L1/L2/L3 matrix
20. Decommission legacy crons — All 16 removed, daemon handles everything
21. Plaza feed — Directory + SQLite + posting rules
22. Verify — Trigger fires → agent wakes → Paperclip task → Plaza post

**Phase 3 rollback:** Stop trigger daemon, re-enable legacy cron jobs from backup. Paperclip tasks are additive — no data loss.

### Phase 4: Force Multipliers (Session 4)

23. n8n install — Docker, migrate credentials from agent configs
24. AutoResearchClaw — Clone, bridge adapter, wire to Dude
25. idea-reality-mcp — MCP server, mandatory gate in Dude's workflow
26. Donny's first mission — Dashboard analysis + improvement proposals
27. Morning brief pipeline — Jr 8am → Dude 9am → Walter 9:30am
28. End-to-end test — Full chain: Telegram goal → Jr → Dude validates → research → Paperclip task → specialist executes → Donny visualizes → Jr reports back

## 7. Success Criteria

- [ ] All 12 agents heartbeat successfully via trigger daemon
- [ ] Dude creates and assigns Paperclip tasks autonomously
- [ ] Specialists auto-checkout and execute tasks from Paperclip queue
- [ ] Jr delivers daily brief to Charlie via Telegram by 8am
- [ ] idea-reality-mcp blocks at least one bad idea (score >70)
- [ ] AutoResearchClaw completes a research task dispatched by Dude
- [ ] self-improving-agent captures learnings on all 12 agents
- [ ] memsearch returns semantic results across agent memory files
- [ ] Da Fino completes a security scan with ClawSec
- [ ] Donny proposes a dashboard improvement from Plaza feed data
- [ ] n8n handles all external API calls — zero credentials in agent configs
- [ ] Monthly cost stays within $40-60 budget
- [ ] Plaza feed has posts from at least 6 agents within first week

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Codex OAuth rate limits hit (14-15 heavy tasks/week) | Dude falls back to Sonnet 4.6; GPT-5.4-mini for lighter tasks |
| OpenClaw `openai-codex` provider bug (#38706) | Check fix status in v2026.3.13; workaround via CLIProxyAPI if needed |
| Trigger daemon becomes single point of failure | Smokey polls daemon health; systemd auto-restarts; fallback to direct cron |
| n8n adds latency to API calls | Keep direct credentials as emergency fallback; n8n runs locally |
| 12 agents still too many for governance | Dude reviews roster quarterly via curiosity journal findings |
| ClawHub supply chain risk (ClawHavoc) | Da Fino + ClawSec verify skill integrity before install |
| Paperclip data migration (existing 53 tasks) | Keep existing tasks; reclassify to new agent assignments |

## 9. References

- [AutoResearchClaw](https://github.com/aiming-lab/AutoResearchClaw) — Research pipeline
- [agency-agents](https://github.com/msitarzewski/agency-agents) — Agent persona templates
- [Clawith Aware system](https://github.com/dataelement/Clawith) — Trigger daemon inspiration
- [memsearch](https://github.com/zilliztech/memsearch) — Semantic memory search
- [idea-reality-mcp](https://github.com/mnemox-ai/idea-reality-mcp) — Pre-build validation
- [openclaw-n8n-stack](https://github.com/caprihan/openclaw-n8n-stack) — Credential isolation
- [self-improving-agent](https://clawhub.ai/pskoett/self-improving-agent) — Learning capture
- [Capability Evolver](https://llmbase.ai/openclaw/evolver/) — Autonomous skill writing
- [ClawSec](https://github.com/prompt-security/clawsec) — Security skill suite
- [awesome-openclaw-usecases](https://github.com/hesamsheikh/awesome-openclaw-usecases) — Community patterns
- [OpenMOSS](https://github.com/uluckyXH/OpenMOSS) — Multi-agent coordination (Patrol pattern)
- [AGENT-ZERO](https://github.com/msitarzewski/AGENT-ZERO) — Memory Bank pattern
- [openclaw-mission-control](https://github.com/abhi1693/openclaw-mission-control) — Dashboard reference
