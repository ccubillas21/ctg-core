# Phase 4b: Workflow Wiring — Design Spec

**Date**: 2026-03-18
**Parent Spec**: `2026-03-18-openclaw-full-activation-design.md` (Section 4.4, Items 26–28)
**Prerequisite**: Phase 4a complete (n8n, Stranger, Knox, idea-check)

## 1. Overview

Phase 4b wires three capabilities onto the infrastructure built in Phases 3–4a:

1. **Morning brief pipeline** — chained Jr → Dude → Walter, kicked off by Jr's 8am cron
2. **Donny's first dashboard mission** — independent 10am data scan with structured proposals
3. **Credential migration** — external API keys moved into n8n workflows

## 2. Morning Brief Chain

### 2.1 Architecture

Single-trigger chain: Jr's cron fires at 8am ET. Each agent runs their brief skill, then sends a summary to the next agent's inbox via `on_message`.

```
Jr (8am cron) → Dude (on_message from Jr) → Walter (on_message from Dude)
```

No separate morning crons on Dude or Walter for the brief. Walter's existing `walter-daily-audit` cron shifts to 10am ET as a safety-net fallback (catches chain failures).

### 2.2 Jr — Morning Roundup (8am ET)

**New trigger**: `jr-morning-brief`
```json
{
  "id": "jr-morning-brief",
  "type": "cron",
  "config": { "expr": "0 8 * * *", "tz": "America/New_York" },
  "action_type": "research",
  "focus_ref": null,
  "reason": "Morning roundup — kick off daily brief chain",
  "enabled": true,
  "cooldown_seconds": 300,
  "prompt": "Run the morning-brief skill."
}
```

**New skill**: `~/.openclaw/agents/jr/agent/skills/morning-brief/skill.md`

**Reviews**:
- Knox research findings (inbox — delivered via `jr-from-knox` trigger)
- Mailroom triage results (inbox — delivered via `jr-from-mailroom` trigger)
- Charlie's pending tasks
- Overnight Plaza activity

**Outputs**:
- Structured summary to Charlie (Slack/Telegram)
- Condensed brief sent to Dude's inbox (triggers `dude-from-jr`)

### 2.3 Dude — Morning Brief (triggered by Jr)

**Trigger change**: Set existing `dude-morning-brief` to `"enabled": false` (replaced by chain). Dude's brief is now triggered by the existing `dude-from-jr` on_message (which matches `from_agents: ["jr"]`) when Jr sends the morning roundup.

**New skill**: `~/.openclaw/agents/worker/agent/skills/morning-brief/skill.md`

**Reviews**:
- Jr's brief (received message)
- Plaza feed (recent posts)
- Paperclip queue (pending/stalled tasks)
- Agent health from snapshot.json

**Outputs**:
- Team summary posted to Plaza
- Infrastructure concerns sent to Walter's inbox (triggers existing `walter-from-dude`, which matches `from_agents: ["worker"]`)

### 2.4 Walter — Morning Infra Audit (triggered by Dude)

**Trigger change**: Shift `walter-daily-audit` cron from `0 9 * * *` to `0 10 * * *` ET. This becomes a fallback — if the chain fires correctly, Walter already ran his audit by ~9:30am. The 10am cron catches chain failures.

**New skill**: `~/.openclaw/agents/cto/agent/skills/morning-audit/skill.md`

**Reviews**:
- Dude's concerns (received message)
- Gateway and trigger daemon health
- Paperclip service status
- systemd services (n8n, Paperclip, trigger-daemon, etc.)
- n8n container health

**Outputs**:
- Findings posted to Plaza
- Critical issues alert Charlie directly

### 2.5 Chain Failure Handling

- If Jr fails: Dude's `dude-paperclip-check` interval (30min) still runs; Walter's 10am cron fires independently
- If Dude fails: Walter's 10am cron fires independently
- If Walter fails: his 10am cron retries; no downstream dependency

## 3. Donny's First Mission

### 3.1 Architecture

Independent of the morning brief chain. Donny runs on his existing `donny-daily-data-scan` cron at 10am ET.

### 3.2 Dashboard Scan Skill

**New skill**: `~/.openclaw/agents/donny/agent/skills/dashboard-scan/skill.md`

**Reviews**:
- `snapshot.json` structure — fields, staleness, missing data opportunities
- Plaza feed — recent posts with dashboard-relevant content
- AIMEE MC current panels vs. available data

**Outputs**:
- Structured improvement proposal sent to Dude's inbox

### 3.3 Proposal Format

Each proposal contains:
- **What**: specific change description
- **Why**: data justification (what's missing, what's stale, what's underutilized)
- **Mockup**: text description of the proposed UI change
- **Complexity**: L2 (UI cosmetic) or L3 (structural/pipeline change)

### 3.4 Approval Flow

- Dude receives proposal via new `dude-from-donny` on_message trigger
- Dude evaluates: runs idea-check for new features, approves L2 changes directly, escalates L3 to Charlie
- Approved tasks go into Paperclip queue assigned to Donny

### 3.5 New Trigger: dude-from-donny

```json
{
  "id": "dude-from-donny",
  "type": "on_message",
  "config": { "watch_inbox": true, "from_agents": ["donny"] },
  "action_type": "research",
  "focus_ref": null,
  "reason": "Receive dashboard improvement proposals from Donny",
  "enabled": true,
  "cooldown_seconds": 60,
  "prompt": "Donny has sent a dashboard improvement proposal. Review it, run idea-check if it's a new feature, approve L2 changes, escalate L3 to Charlie."
}
```

## 4. Credential Migration to n8n

### 4.1 Architecture

Same pattern as Phase 4a (idea-check, github-api): agents call n8n webhook URLs, n8n handles auth and external API calls, agents never see API keys.

```
Agent → webhook URL → n8n workflow → external API → response back through n8n
```

### 4.2 Workflows to Create

| Workflow | Credential | Purpose | Consumers |
|----------|-----------|---------|-----------|
| `brave-search` | `BRAVE_API_KEY` | Web search queries | Da Fino, Dude (via AutoResearchClaw) |
| `gemini-api` | `GEMINI_API_KEY` | Gemini API calls (tool use, not primary model) | Any agent |
| `gmail-fetch` | Gmail OAuth | Email fetching | Mailroom |
| `graph-fetch` | MS Graph OAuth | Email fetching | Mailroom |
| `elevenlabs` | ElevenLabs API key | Voice synthesis | TBD (stub — key to be provided) |
| `nanobanana` | NanoBanana API key | TBD | TBD (stub — key to be provided) |

### 4.3 Implementation Notes

- **brave-search**: Accept query string, return search results JSON. Wire into Da Fino's research tools and AutoResearchClaw's search adapter.
- **gemini-api**: Accept prompt + optional model params, return completion. Generic wrapper for any agent needing Gemini as a tool.
- **gmail-fetch / graph-fetch**: n8n has native Gmail and Microsoft Outlook nodes with built-in OAuth refresh. This simplifies the current runtime-path approach in Mailroom's email-pipeline. **Note**: Requires interactive OAuth consent flow in n8n UI (browser-based). Cannot be automated via CLI.
- **elevenlabs / nanobanana**: Stub workflows with placeholder credentials. Webhook endpoints are live but return a clear error until real keys are provided. Plumbing is ready — just drop in keys later.

### 4.4 Existing Workflows (Unchanged)

- `idea-check` — `http://localhost:5678/webhook/26nCNnEnqBwgRtsF/webhook/idea-check`
- `github-api` — `http://localhost:5678/webhook/Gr3DaIhDiUHzLC2b/webhook/github-api`

### 4.5 Credential Removal

After each workflow is verified working, remove the corresponding credential from its source location:
- `BRAVE_API_KEY` from `openclaw.json` tools section
- `GEMINI_API_KEY` from `openclaw.json` models section
- Gmail/Graph OAuth paths from Mailroom email-pipeline config

LLM provider keys (Anthropic, OpenAI, MiniMax, Qwen), messaging tokens (Telegram, Slack, Teams), and infrastructure credentials (gateway, Paperclip) remain in their current locations — these are runtime-direct and cannot be proxied through n8n.

### 4.6 Pending Credentials (User Action Required)

- **ElevenLabs API key** — Charlie to provide, store in n8n elevenlabs workflow
- **NanoBanana API key** — Charlie to provide, store in n8n nanobanana workflow

## 5. Files Created/Modified Summary

### New Files
- `agents/jr/agent/skills/morning-brief/skill.md` — Jr's morning roundup skill
- `agents/worker/agent/skills/morning-brief/skill.md` — Dude's morning brief skill
- `agents/cto/agent/skills/morning-audit/skill.md` — Walter's infra audit skill
- `agents/donny/agent/skills/dashboard-scan/skill.md` — Donny's dashboard scan skill
- 6 n8n workflow JSON files (brave-search, gemini-api, gmail-fetch, graph-fetch, elevenlabs, nanobanana)

### Modified Files
- `agents/jr/agent/triggers.json` — add `jr-morning-brief` cron
- `agents/worker/agent/triggers.json` — disable `dude-morning-brief` cron, add `dude-from-donny` on_message
- `agents/cto/agent/triggers.json` — shift `walter-daily-audit` cron to 10am ET
- `agents/donny/agent/triggers.json` — update `donny-daily-data-scan` prompt to `"Run the dashboard-scan skill."`
- `openclaw.json` — remove migrated credentials after verification

## 6. Success Criteria

- [ ] Jr 8am cron fires, produces roundup, sends to Dude
- [ ] Dude receives Jr's message, runs brief, posts to Plaza, sends to Walter
- [ ] Walter receives Dude's message, runs audit, posts to Plaza
- [ ] Chain completes within 30 minutes (8:00–8:30am window)
- [ ] Walter 10am fallback cron still works independently
- [ ] Donny 10am scan produces structured proposal, sends to Dude
- [ ] Dude receives Donny's proposal via `dude-from-donny` trigger
- [ ] brave-search n8n workflow returns search results
- [ ] gemini-api n8n workflow returns completions
- [ ] gmail-fetch and graph-fetch workflows handle OAuth refresh
- [ ] elevenlabs and nanobanana stubs return clear "key not configured" errors
- [ ] Migrated credentials removed from openclaw.json after verification
- [ ] Dude runs idea-check on a Donny L3 proposal and correctly routes the result (approve/escalate)
- [ ] All existing tests still pass (76+)

## 7. Rollback Plan

1. **Morning brief chain**: Re-enable `dude-morning-brief` cron (set `"enabled": true`), shift `walter-daily-audit` back to `0 9 * * *`, remove `jr-morning-brief` trigger and new skills. Chain reverts to independent crons.
2. **Donny's mission**: Remove `dude-from-donny` trigger, revert `donny-daily-data-scan` prompt to original. Donny still scans but proposals don't route to Dude.
3. **Credential migration**: Backup taken as `openclaw.json.pre-phase4b` before any credential removal. Restore backup to re-add credentials. n8n workflows can remain (harmless).

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Jr fails at 8am, chain never starts | Walter's 10am cron fallback; Dude's 30min interval still checks Paperclip |
| on_message delivery delay breaks timing | Triggers fire within seconds; 1-hour window between Jr (8am) and Walter fallback (10am) is generous |
| Gmail/Graph OAuth setup complexity | n8n native nodes handle refresh; OAuth credentials configured in n8n UI, not code |
| n8n webhook URLs change if workflows recreated | Document URLs in agent skills; backup n8n volume |
| Donny proposals spam Dude | cooldown_seconds: 60 on trigger; daily cron means max 1 proposal/day |
