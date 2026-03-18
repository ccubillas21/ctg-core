# Phase 4b: Workflow Wiring — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire morning brief chain (Jr→Dude→Walter), Donny's dashboard mission, and migrate external API credentials into n8n workflows.

**Architecture:** Skills-first approach — each agent gets a dedicated skill for their brief/scan role. Morning chain uses Jr's 8am cron as single trigger, flowing via existing on_message triggers. Credential migration follows Phase 4a's webhook pattern (agent → n8n webhook → external API).

**Tech Stack:** OpenClaw trigger daemon, agent skills (markdown), n8n workflows (JSON/Docker), bash/curl for verification.

**Spec:** `docs/superpowers/specs/2026-03-18-openclaw-phase4b-workflow-wiring-design.md`

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `agents/jr/agent/skills/morning-brief/skill.md` | Jr's 8am morning roundup skill |
| `agents/worker/agent/skills/morning-brief/skill.md` | Dude's morning brief skill (triggered by Jr) |
| `agents/cto/agent/skills/morning-audit/skill.md` | Walter's infra audit skill (triggered by Dude) |
| `agents/donny/agent/skills/dashboard-scan/skill.md` | Donny's dashboard improvement scan skill |

### Modified Files
| File | Change |
|------|--------|
| `agents/jr/agent/triggers.json` | Add `jr-morning-brief` cron trigger |
| `agents/worker/agent/triggers.json` | Disable `dude-morning-brief`, add `dude-from-donny` |
| `agents/cto/agent/triggers.json` | Shift `walter-daily-audit` to 10am |
| `agents/donny/agent/triggers.json` | Update `donny-daily-data-scan` prompt to use skill |
| `~/.openclaw/openclaw.json` | Remove migrated Brave and Gemini API keys |

### n8n Workflows (created via n8n UI or CLI import)
| Workflow | Credential |
|----------|-----------|
| brave-search | BRAVE_API_KEY |
| gemini-api | GEMINI_API_KEY |
| gmail-fetch | Gmail OAuth (interactive setup) |
| graph-fetch | MS Graph OAuth (interactive setup) |
| elevenlabs | Stub (key TBD) |
| nanobanana | Stub (key TBD) |

All paths below are relative to `~/.openclaw/` unless noted otherwise.

**Parallelization:** Tasks 1+3+5+7 (skills) are independent and can run in parallel. Tasks 2+4+6+8 (triggers) are independent and can run in parallel. Tasks 9+10+11 (n8n workflows) are independent and can run in parallel. Task 12 requires interactive OAuth. Tasks 13-15 must run sequentially after everything else.

---

## Task 1: Jr Morning Brief Skill

**Files:**
- Create: `agents/jr/agent/skills/morning-brief/skill.md`

- [ ] **Step 1: Create the skill file**

```markdown
# Morning Roundup

## When to Use
Every morning at 8am ET when triggered by `jr-morning-brief` cron. This is the first step in the daily brief chain: Jr → Dude → Walter.

## What to Review
1. **Knox research findings** — check inbox for recent messages from Knox. Summarize any new research topics, key findings, and recommended actions.
2. **Mailroom triage results** — check inbox for recent messages from Mailroom. List urgent items (flagged for immediate action) and notable non-urgent items.
3. **Charlie's pending tasks** — review your journal for any tasks Charlie mentioned that are still open.
4. **Overnight Plaza activity** — read the Plaza feed for posts since last evening. Note anything requiring Charlie's attention.

## Output Format
Produce TWO outputs:

### 1. Message to Charlie (Slack/Telegram)
Brief, scannable morning summary:
```
Morning Roundup — [date]

Research: [1-2 sentence Knox summary, or "nothing new"]
Email: [urgent count] urgent, [notable count] notable items
Pending: [list open tasks, or "all clear"]
Overnight: [notable Plaza activity, or "quiet night"]
```

### 2. Message to Dude (drop in worker inbox)
Condensed brief for Dude's morning processing. Include:
- Knox findings summary (topics + action items)
- Urgent email items requiring team action
- Charlie's goals/priorities for the day
- Any overnight Plaza posts that need Dude's attention

Format as structured text so Dude can parse it efficiently.

## Chain Responsibility
After sending both messages, your part of the morning chain is complete. Dude will pick up from his `dude-from-jr` trigger.

## If Nothing to Report
Still send both messages with "all clear" summaries. The chain must fire daily so Dude and Walter run their briefs.
```

Write this to `~/.openclaw/agents/jr/agent/skills/morning-brief/skill.md`.

- [ ] **Step 2: Verify the file exists and is well-formed**

Run: `cat ~/.openclaw/agents/jr/agent/skills/morning-brief/skill.md | head -5`
Expected: shows the `# Morning Roundup` header.

- [ ] **Step 3: Commit**

```bash
cd ~/.openclaw
git add agents/jr/agent/skills/morning-brief/skill.md
git commit -m "feat(jr): add morning-brief skill for 8am roundup"
```

---

## Task 2: Jr Morning Brief Trigger

**Files:**
- Modify: `agents/jr/agent/triggers.json`

- [ ] **Step 1: Read the current triggers file**

Run: `cat ~/.openclaw/agents/jr/agent/triggers.json`
Confirm it has 4 triggers: `jr-status-check`, `jr-from-charlie`, `jr-from-mailroom`, `jr-from-knox`.

- [ ] **Step 2: Add the `jr-morning-brief` cron trigger**

Add this entry to the `triggers` array in `agents/jr/agent/triggers.json`:

```json
{"id": "jr-morning-brief", "type": "cron", "config": {"expr": "0 8 * * *", "tz": "America/New_York"}, "action_type": "research", "focus_ref": null, "reason": "Morning roundup — kick off daily brief chain", "enabled": true, "cooldown_seconds": 300, "prompt": "Run the morning-brief skill."}
```

- [ ] **Step 3: Validate JSON**

Run: `python3 -c "import json; json.load(open('$HOME/.openclaw/agents/jr/agent/triggers.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd ~/.openclaw
git add agents/jr/agent/triggers.json
git commit -m "feat(jr): add jr-morning-brief cron trigger at 8am ET"
```

---

## Task 3: Dude Morning Brief Skill

**Files:**
- Create: `agents/worker/agent/skills/morning-brief/skill.md`

- [ ] **Step 1: Create the skill file**

```markdown
# Morning Brief

## When to Use
When Jr sends you the morning roundup via inbox (triggers `dude-from-jr`). This is the second step in the daily brief chain: Jr → Dude → Walter.

## What to Review
1. **Jr's brief** — read the incoming message. Extract Knox findings, urgent email items, Charlie's priorities, and overnight highlights.
2. **Plaza feed** — read recent Plaza posts (last 24h). Note trends, recurring topics, and actionable items.
3. **Paperclip queue** — check for pending tasks (new assignments), stalled tasks (no progress in >24h), and completed tasks to acknowledge.
4. **Agent health** — check snapshot.json for agent status. Note any agents that are unhealthy, have high error rates, or missed recent heartbeats.

## Output Format
Produce TWO outputs:

### 1. Plaza Post
Post a morning brief summary to Plaza:
```
Morning Brief — [date]

From Jr: [1-2 sentence summary of Charlie's priorities]
Paperclip: [X pending, Y stalled, Z completed]
Agent Health: [all healthy / list issues]
Action Items: [numbered list of today's priorities]
```

### 2. Message to Walter (drop in cto inbox)
Infrastructure concerns for Walter's audit. Include:
- Any unhealthy agents or services from snapshot.json
- Stalled Paperclip tasks that may indicate infrastructure issues
- Specific things from Jr's brief that need Walter's attention (e.g., "Knox research pipeline failed", "gateway timeouts overnight")
- If nothing needs attention, send "No infrastructure concerns from morning brief."

## Chain Responsibility
After posting to Plaza and messaging Walter, your part of the morning chain is complete. Walter will pick up from his `walter-from-dude` trigger.

## Idea Validation
Do NOT run idea-check on morning brief items. This is a status review, not a new project proposal.
```

Write this to `~/.openclaw/agents/worker/agent/skills/morning-brief/skill.md`.

- [ ] **Step 2: Verify the file**

Run: `cat ~/.openclaw/agents/worker/agent/skills/morning-brief/skill.md | head -5`
Expected: shows the `# Morning Brief` header.

- [ ] **Step 3: Commit**

```bash
cd ~/.openclaw
git add agents/worker/agent/skills/morning-brief/skill.md
git commit -m "feat(worker): add morning-brief skill for chain step 2"
```

---

## Task 4: Dude Trigger Updates

**Files:**
- Modify: `agents/worker/agent/triggers.json`

- [ ] **Step 1: Read the current triggers file**

Run: `cat ~/.openclaw/agents/worker/agent/triggers.json`
Confirm it has 4 triggers: `dude-morning-brief`, `dude-paperclip-check`, `dude-from-jr`, `dude-github-webhook`.

- [ ] **Step 2: Disable `dude-morning-brief`**

In `agents/worker/agent/triggers.json`, change the `dude-morning-brief` trigger's `"enabled": true` to `"enabled": false`.

- [ ] **Step 3: Add `dude-from-donny` trigger**

Add this entry to the `triggers` array:

```json
{"id": "dude-from-donny", "type": "on_message", "config": {"watch_inbox": true, "from_agents": ["donny"]}, "action_type": "research", "focus_ref": null, "reason": "Receive dashboard improvement proposals from Donny", "enabled": true, "cooldown_seconds": 60, "prompt": "Donny has sent a dashboard improvement proposal. Review it, run idea-check if it's a new feature, approve L2 changes, escalate L3 to Charlie."}
```

- [ ] **Step 4: Validate JSON**

Run: `python3 -c "import json; json.load(open('$HOME/.openclaw/agents/worker/agent/triggers.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw
git add agents/worker/agent/triggers.json
git commit -m "feat(worker): disable morning cron, add dude-from-donny trigger"
```

---

## Task 5: Walter Morning Audit Skill

**Files:**
- Create: `agents/cto/agent/skills/morning-audit/skill.md`

- [ ] **Step 1: Create the skill file**

```markdown
# Morning Infrastructure Audit

## When to Use
When Dude sends infrastructure concerns via inbox (triggers `walter-from-dude`). This is the third step in the daily brief chain: Jr → Dude → Walter. Also runs independently via `walter-daily-audit` cron at 10am ET as a fallback.

## What to Review
1. **Dude's concerns** — read the incoming message. Address any specific infrastructure issues flagged.
2. **Gateway health** — check `curl -s http://localhost:18789/health` for status.
3. **Trigger daemon** — check `curl -s http://localhost:18800/metrics` for agent count, trigger count, health status.
4. **Paperclip** — check `curl -s http://localhost:3101/health` for service status.
5. **systemd services** — check status of: `openclaw-paperclip.service`, `openclaw-triggers.service`, `n8n.service`, `ctg-showcase.service`.
6. **n8n container** — check `docker ps --filter name=openclaw-n8n --format '{{.Status}}'` for container health.
7. **Disk usage** — check `df -h /home` for available space.

## Output Format
Produce TWO outputs:

### 1. Plaza Post
Post infrastructure status to Plaza:
```
Infra Audit — [date]

Gateway: [healthy/unhealthy — details]
Triggers: [X agents, Y triggers — healthy/issues]
Paperclip: [healthy/unhealthy]
Services: [all running / list stopped]
n8n: [running / stopped]
Disk: [X% used, Y available]
Action Required: [list or "none"]
```

### 2. Alert Charlie (if critical)
If any of the following are true, alert Charlie directly via Slack/Telegram:
- Gateway is unreachable
- Trigger daemon is down or has 0 agents
- Paperclip is unreachable
- n8n container is stopped
- Disk usage >90%

If nothing is critical, do NOT alert Charlie — the Plaza post is sufficient.

## Fallback Behavior
If triggered by the 10am cron (no incoming message from Dude), run the same checks but skip step 1 (Dude's concerns). This means the chain failed and you're running independently.
```

Write this to `~/.openclaw/agents/cto/agent/skills/morning-audit/skill.md`.

- [ ] **Step 2: Verify the file**

Run: `cat ~/.openclaw/agents/cto/agent/skills/morning-audit/skill.md | head -5`
Expected: shows the `# Morning Infrastructure Audit` header.

- [ ] **Step 3: Commit**

```bash
cd ~/.openclaw
git add agents/cto/agent/skills/morning-audit/skill.md
git commit -m "feat(cto): add morning-audit skill for chain step 3"
```

---

## Task 6: Walter Trigger Update

**Files:**
- Modify: `agents/cto/agent/triggers.json`

- [ ] **Step 1: Read the current triggers file**

Run: `cat ~/.openclaw/agents/cto/agent/triggers.json`
Confirm `walter-daily-audit` has `"expr": "0 9 * * *"`.

- [ ] **Step 2: Shift `walter-daily-audit` to 10am ET**

In `agents/cto/agent/triggers.json`, change `walter-daily-audit`:

1. Change config from `"expr": "0 9 * * *"` to `"expr": "0 10 * * *"`
2. Change prompt from:
   `"Run daily infrastructure audit: check OpenClaw gateway health, Paperclip status, systemd services, disk usage. Report issues."`
   to:
   `"Run the morning-audit skill. This is the fallback cron — if Dude already sent concerns today, this may be redundant but run anyway."`

- [ ] **Step 3: Validate JSON**

Run: `python3 -c "import json; json.load(open('$HOME/.openclaw/agents/cto/agent/triggers.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd ~/.openclaw
git add agents/cto/agent/triggers.json
git commit -m "feat(cto): shift daily-audit to 10am, reference morning-audit skill"
```

---

## Task 7: Donny Dashboard Scan Skill

**Files:**
- Create: `agents/donny/agent/skills/dashboard-scan/skill.md`

- [ ] **Step 1: Create the skill file**

```markdown
# Dashboard Improvement Scan

## When to Use
Every morning at 10am ET when triggered by `donny-daily-data-scan` cron. Independent of the morning brief chain.

## What to Review
1. **snapshot.json** — read `~/.openclaw/ctg-core/dashboard/snapshot.json`. Check for:
   - Fields that exist but aren't displayed in any AIMEE MC panel
   - Fields with stale data (timestamps >24h old when they should be fresh)
   - Missing data that would be valuable (e.g., agent memory usage, skill invocation counts)
2. **Plaza feed** — read recent Plaza posts (last 7 days). Look for:
   - Recurring topics that could become a dedicated panel or chart
   - Agent complaints or requests that dashboard changes could address
   - Patterns in agent health that suggest a new monitoring view
3. **AIMEE MC panels** — review what's currently displayed. Identify:
   - Panels that could show more useful data
   - Missing panels for data that's available
   - Layout improvements for readability

## Output Format
Send ONE structured proposal to Dude (drop in worker inbox):

```
Dashboard Improvement Proposal — [date]

## What
[1-2 sentence description of the proposed change]

## Why
[Data justification — what's missing, stale, or underutilized]
[Reference specific snapshot.json fields or Plaza posts]

## Mockup
[Text description of what the change would look like]
[Which panel, what data, where on the page]

## Complexity
[L2 — UI cosmetic change / L3 — structural or pipeline change]

## Data Source
[Which fields in snapshot.json, or what new data source needed]
```

## Rules
- ONE proposal per day. Pick the highest-impact improvement.
- If nothing needs improving today, send "No proposals — dashboard is current." to Dude anyway (keeps the communication channel alive).
- Never propose changes that require new external API integrations — those go through the full idea-check process.
- Prefer proposals that use data already in snapshot.json over proposals that need new data sources.
```

Write this to `~/.openclaw/agents/donny/agent/skills/dashboard-scan/skill.md`.

- [ ] **Step 2: Verify the file**

Run: `cat ~/.openclaw/agents/donny/agent/skills/dashboard-scan/skill.md | head -5`
Expected: shows the `# Dashboard Improvement Scan` header.

- [ ] **Step 3: Commit**

```bash
cd ~/.openclaw
git add agents/donny/agent/skills/dashboard-scan/skill.md
git commit -m "feat(donny): add dashboard-scan skill for daily improvement proposals"
```

---

## Task 8: Donny Trigger Update

**Files:**
- Modify: `agents/donny/agent/triggers.json`

- [ ] **Step 1: Read the current triggers file**

Run: `cat ~/.openclaw/agents/donny/agent/triggers.json`
Confirm `donny-daily-data-scan` exists with its current prompt.

- [ ] **Step 2: Update the prompt**

In `agents/donny/agent/triggers.json`, change `donny-daily-data-scan`'s prompt from:
`"Scan snapshot.json and Plaza feed for data patterns. Propose dashboard improvements to Dude via his inbox if you find actionable insights."`
to:
`"Run the dashboard-scan skill."`

- [ ] **Step 3: Validate JSON**

Run: `python3 -c "import json; json.load(open('$HOME/.openclaw/agents/donny/agent/triggers.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd ~/.openclaw
git add agents/donny/agent/triggers.json
git commit -m "feat(donny): update daily-data-scan trigger to use dashboard-scan skill"
```

---

## Task 9: n8n Brave Search Workflow

**Files:**
- n8n workflow created via CLI or UI

- [ ] **Step 1: Verify n8n is running**

Run: `curl -s http://localhost:5678/healthz`
Expected: returns health status (200 OK).

If n8n is not running:
```bash
systemctl --user start n8n
sleep 3
curl -s http://localhost:5678/healthz
```

- [ ] **Step 2: Create brave-search workflow JSON**

Create a temporary workflow file at `/tmp/n8n-brave-search.json`:

```json
{
  "name": "brave-search",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "brave-search",
        "responseMode": "responseNode",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [240, 300]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "=https://api.search.brave.com/res/v1/web/search?q={{ encodeURIComponent($json.body.query) }}&count={{ $json.body.count || 10 }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Accept",
              "value": "application/json"
            },
            {
              "name": "X-Subscription-Token",
              "value": "PLACEHOLDER_BRAVE_API_KEY"
            }
          ]
        },
        "options": {}
      },
      "name": "Brave API",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [460, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($json) }}"
      },
      "name": "Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [680, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [{"node": "Brave API", "type": "main", "index": 0}]
      ]
    },
    "Brave API": {
      "main": [
        [{"node": "Response", "type": "main", "index": 0}]
      ]
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1"
  }
}
```

- [ ] **Step 3: Import the workflow**

Run: `docker exec openclaw-n8n n8n import:workflow --input=/tmp/n8n-brave-search.json` (mount or copy file into container first if needed).

Alternative: use the n8n REST API:
```bash
curl -s -X POST http://localhost:5678/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d @/tmp/n8n-brave-search.json
```

After import, activate the workflow in the n8n UI if not auto-activated.

- [ ] **Step 3a: Create Brave credential in n8n and wire it**

1. Open `http://localhost:5678` in browser
2. Go to **Credentials** → **Add Credential** → search "Header Auth"
3. Create credential named "Brave Search API" with: Name=`X-Subscription-Token`, Value=`<real Brave API key from openclaw.json>`
4. Open the brave-search workflow → click the "Brave API" HTTP Request node
5. Under Authentication, select "Generic Credential Type" → "Header Auth" → select "Brave Search API"
6. Remove the hardcoded `headerParameters` section from the node (the credential now handles the header)
7. Save the workflow

- [ ] **Step 4: Test the workflow**

```bash
curl -s -X POST "http://localhost:5678/webhook/brave-search" \
  -H "Content-Type: application/json" \
  -d '{"query": "openclaw agent framework", "count": 3}'
```

Expected: JSON response with `web.results` array containing search results.

- [ ] **Step 5: Record the webhook URL**

Note the full webhook URL (may include a workflow ID prefix like existing workflows). This URL will be referenced by Da Fino and AutoResearchClaw.

- [ ] **Step 6: Commit workflow file to repo**

```bash
cp /tmp/n8n-brave-search.json ~/.openclaw/n8n/workflows/brave-search.json
cd ~/.openclaw
git add n8n/workflows/brave-search.json
git commit -m "feat(n8n): add brave-search webhook workflow"
```

---

## Task 10: n8n Gemini API Workflow

**Files:**
- n8n workflow created via CLI or UI

- [ ] **Step 1: Create gemini-api workflow JSON**

Create `/tmp/n8n-gemini-api.json`:

```json
{
  "name": "gemini-api",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "gemini-api",
        "responseMode": "responseNode",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [240, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "=https://generativelanguage.googleapis.com/v1beta/models/{{ $json.body.model || 'gemini-2.0-flash' }}:generateContent?key=PLACEHOLDER_GEMINI_API_KEY",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({contents: [{parts: [{text: $json.body.prompt}]}]}) }}",
        "options": {}
      },
      "name": "Gemini API",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [460, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($json) }}"
      },
      "name": "Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [680, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [{"node": "Gemini API", "type": "main", "index": 0}]
      ]
    },
    "Gemini API": {
      "main": [
        [{"node": "Response", "type": "main", "index": 0}]
      ]
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1"
  }
}
```

- [ ] **Step 2: Import and activate the workflow**

Same import process as Task 9 (Step 3).

- [ ] **Step 2a: Create Gemini credential in n8n and wire it**

1. Open `http://localhost:5678` in browser
2. Go to **Credentials** → **Add Credential** → search "Header Auth"
3. Create credential named "Gemini API Key" with: Name=`x-goog-api-key`, Value=`<real Gemini API key from openclaw.json>`
4. Open the gemini-api workflow → click the "Gemini API" HTTP Request node
5. Change the URL to remove the `?key=PLACEHOLDER_GEMINI_API_KEY` query parameter: `=https://generativelanguage.googleapis.com/v1beta/models/{{ $json.body.model || 'gemini-2.0-flash' }}:generateContent`
6. Under Authentication, select "Generic Credential Type" → "Header Auth" → select "Gemini API Key"
7. Save the workflow

- [ ] **Step 3: Test the workflow**

```bash
curl -s -X POST "http://localhost:5678/webhook/gemini-api" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Say hello in exactly 5 words.", "model": "gemini-2.0-flash"}'
```

Expected: JSON response with `candidates[0].content.parts[0].text` containing a response.

- [ ] **Step 4: Commit workflow file**

```bash
cp /tmp/n8n-gemini-api.json ~/.openclaw/n8n/workflows/gemini-api.json
cd ~/.openclaw
git add n8n/workflows/gemini-api.json
git commit -m "feat(n8n): add gemini-api webhook workflow"
```

---

## Task 11: n8n Stub Workflows (ElevenLabs + NanoBanana)

**Files:**
- n8n workflows created via CLI or UI

- [ ] **Step 1: Create elevenlabs stub workflow JSON**

Create `/tmp/n8n-elevenlabs.json`:

```json
{
  "name": "elevenlabs",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "elevenlabs",
        "responseMode": "responseNode",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [240, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify({error: 'ElevenLabs API key not configured. Provide key to Charlie to activate this workflow.', status: 'stub'}) }}",
        "options": {
          "responseCode": 503
        }
      },
      "name": "Stub Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [460, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [{"node": "Stub Response", "type": "main", "index": 0}]
      ]
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1"
  }
}
```

- [ ] **Step 2: Create nanobanana stub workflow JSON**

Create `/tmp/n8n-nanobanana.json` — same structure as elevenlabs but with:
- `"name": "nanobanana"`
- `"path": "nanobanana"`
- Error message: `"NanoBanana API key not configured. Provide key to Charlie to activate this workflow."`

- [ ] **Step 3: Import both workflows**

Import both via n8n REST API or CLI (same process as Task 9).

- [ ] **Step 4: Test both stubs**

```bash
curl -s -X POST "http://localhost:5678/webhook/elevenlabs" \
  -H "Content-Type: application/json" -d '{}'
# Expected: 503 with {"error": "ElevenLabs API key not configured...", "status": "stub"}

curl -s -X POST "http://localhost:5678/webhook/nanobanana" \
  -H "Content-Type: application/json" -d '{}'
# Expected: 503 with {"error": "NanoBanana API key not configured...", "status": "stub"}
```

- [ ] **Step 5: Commit workflow files**

```bash
mkdir -p ~/.openclaw/n8n/workflows
cp /tmp/n8n-elevenlabs.json ~/.openclaw/n8n/workflows/elevenlabs.json
cp /tmp/n8n-nanobanana.json ~/.openclaw/n8n/workflows/nanobanana.json
cd ~/.openclaw
git add n8n/workflows/elevenlabs.json n8n/workflows/nanobanana.json
git commit -m "feat(n8n): add elevenlabs and nanobanana stub workflows"
```

---

## Task 12: n8n Gmail and Graph Workflows

**Files:**
- n8n workflows created via n8n UI (OAuth requires interactive browser flow)

- [ ] **Step 1: Create Gmail fetch workflow in n8n UI**

Open `http://localhost:5678` in browser. Create a new workflow named `gmail-fetch`:

1. Add **Webhook** node (POST, path: `gmail-fetch`, response mode: "Response Node")
2. Add **Gmail** node (operation: "Get Many", return type: messages, use the incoming `$json.body.query` as label/filter, limit: `$json.body.limit || 20`)
3. Add **Respond to Webhook** node (respond with JSON, body: `{{ JSON.stringify($json) }}`)
4. Connect: Webhook → Gmail → Response
5. In the Gmail node, click "Create New Credential" and complete the OAuth consent flow in the browser
6. Activate the workflow

- [ ] **Step 2: Create Graph fetch workflow in n8n UI**

Same pattern but with Microsoft Outlook node:

1. Add **Webhook** node (POST, path: `graph-fetch`, response mode: "Response Node")
2. Add **Microsoft Outlook** node (operation: "Get Many", folder: inbox, filter by `$json.body.query` if provided, limit: `$json.body.limit || 20`)
3. Add **Respond to Webhook** node
4. Connect: Webhook → Outlook → Response
5. Create OAuth credential via browser consent flow
6. Activate the workflow

- [ ] **Step 3: Test Gmail workflow**

```bash
curl -s -X POST "http://localhost:5678/webhook/gmail-fetch" \
  -H "Content-Type: application/json" \
  -d '{"query": "is:unread", "limit": 5}'
```

Expected: JSON array of email messages.

- [ ] **Step 4: Test Graph workflow**

```bash
curl -s -X POST "http://localhost:5678/webhook/graph-fetch" \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'
```

Expected: JSON array of email messages.

- [ ] **Step 5: Record webhook URLs and commit notes**

Note the full webhook URLs for both workflows. These will be referenced by Mailroom's email-pipeline.

```bash
cd ~/.openclaw
echo "gmail-fetch: http://localhost:5678/webhook/<workflow-id>/webhook/gmail-fetch" >> n8n/workflows/README.md
echo "graph-fetch: http://localhost:5678/webhook/<workflow-id>/webhook/graph-fetch" >> n8n/workflows/README.md
git add n8n/workflows/README.md
git commit -m "feat(n8n): add gmail-fetch and graph-fetch OAuth workflows"
```

---

## Task 13: Backup and Credential Cleanup

**Files:**
- Modify: `~/.openclaw/openclaw.json`

- [ ] **Step 1: Create pre-Phase4b backup**

```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.pre-phase4b
```

- [ ] **Step 2: Verify all n8n workflows are working**

Run each test from Tasks 9-12:
```bash
# brave-search
curl -s -X POST "http://localhost:5678/webhook/brave-search" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "count": 1}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('brave-search: OK' if 'web' in d else 'FAIL')"

# gemini-api
curl -s -X POST "http://localhost:5678/webhook/gemini-api" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Say OK"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('gemini-api: OK' if 'candidates' in d else 'FAIL')"

# stubs
curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:5678/webhook/elevenlabs" -d '{}' -H "Content-Type: application/json"
# Expected: 503

curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:5678/webhook/nanobanana" -d '{}' -H "Content-Type: application/json"
# Expected: 503
```

- [ ] **Step 3: Verify agents are using n8n webhook URLs (not direct keys)**

Before removing credentials, confirm that no agent tool config or skill references `BRAVE_API_KEY` or `GEMINI_API_KEY` directly:

```bash
cd ~/.openclaw
grep -r "BRAVE_API_KEY\|BSAB57N1N" agents/*/agent/ agents/*/skills/ --include="*.md" --include="*.json" -l
grep -r "GEMINI_API_KEY\|AIzaSyCs" agents/*/agent/ agents/*/skills/ --include="*.md" --include="*.json" -l
```

Expected: no results (or only this plan file). If any agent configs reference these keys directly, update them to use the n8n webhook URLs before proceeding.

- [ ] **Step 4: Remove BRAVE_API_KEY from openclaw.json**

In `~/.openclaw/openclaw.json`, remove the `BRAVE_API_KEY` entry from the tools section. The key is now stored in n8n's credential store.

- [ ] **Step 5: Remove GEMINI_API_KEY from openclaw.json**

In `~/.openclaw/openclaw.json`, remove the `GEMINI_API_KEY` entry from the models/tools section. The key is now stored in n8n's credential store.

- [ ] **Step 6: Verify OpenClaw still starts correctly**

```bash
openclaw status
```

Expected: all agents reporting, no errors about missing credentials (Brave/Gemini are tool credentials, not model credentials — agents should not need them at startup).

- [ ] **Step 7: Commit credential cleanup**

```bash
cd ~/.openclaw
git add openclaw.json
git commit -m "security: remove Brave and Gemini API keys from openclaw.json (migrated to n8n)"
```

**Note on Gmail/Graph credential cleanup:** The Gmail and Graph OAuth paths in Mailroom's email-pipeline config should be updated to use the n8n webhook URLs after Task 12 is verified. However, since Mailroom's OAuth setup (Task 11 in the original Mailroom plan) is still pending, defer this cleanup until Mailroom is fully wired to n8n. Do not remove Mailroom's credential paths in this phase.

---

## Task 14: Restart Trigger Daemon and Verify

**Files:** None (runtime verification)

- [ ] **Step 1: Restart the trigger daemon**

```bash
systemctl --user restart openclaw-triggers
sleep 3
systemctl --user status openclaw-triggers
```

Expected: active (running), no errors.

- [ ] **Step 2: Verify trigger count**

```bash
curl -s http://localhost:18800/metrics | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"Agents: {d.get('agents', '?')}\")
print(f\"Triggers: {d.get('triggers', '?')}\")
print(f\"Health: {d.get('status', '?')}\")
"
```

Expected: 11 agents (was 11 before), triggers should be +2 from before (jr-morning-brief, dude-from-donny added; dude-morning-brief disabled counts the same). Health: healthy.

- [ ] **Step 3: Verify new triggers are loaded**

```bash
curl -s http://localhost:18800/triggers | python3 -c "
import sys, json
d = json.load(sys.stdin)
triggers = {t['id']: t for t in d.get('triggers', [])}
for tid in ['jr-morning-brief', 'dude-from-donny']:
    t = triggers.get(tid)
    if t:
        print(f\"{tid}: enabled={t.get('enabled', '?')}\")
    else:
        print(f\"{tid}: NOT FOUND\")
# Verify dude-morning-brief is disabled
t = triggers.get('dude-morning-brief')
if t:
    print(f\"dude-morning-brief: enabled={t.get('enabled', '?')} (should be false)\")
# Verify walter-daily-audit shifted
t = triggers.get('walter-daily-audit')
if t:
    print(f\"walter-daily-audit: expr={t.get('config', {}).get('expr', '?')} (should be 0 10 * * *)\")
"
```

Expected:
```
jr-morning-brief: enabled=True
dude-from-donny: enabled=True
dude-morning-brief: enabled=False (should be false)
walter-daily-audit: expr=0 10 * * * (should be 0 10 * * *)
```

- [ ] **Step 4: Verify all existing tests still pass**

```bash
cd ~/.openclaw
python3 -m pytest tests/ -v --tb=short 2>&1 | tail -5
```

Expected: 76+ tests passing, 0 failures.

---

## Task 15: Live Chain Test

**Files:** None (manual verification)

- [ ] **Step 1: Manually trigger Jr's morning brief**

Simulate the 8am cron by sending a trigger fire:

```bash
curl -s -X POST http://localhost:18800/fire \
  -H "Content-Type: application/json" \
  -d '{"trigger_id": "jr-morning-brief"}'
```

Expected: 200 OK, trigger fired.

- [ ] **Step 2: Verify Jr produced output**

Wait ~60 seconds, then check:
```bash
# Check if Jr sent a message to Dude's inbox
ls -la ~/.openclaw/agents/worker/inbox/
```

Expected: a recent file from Jr (timestamped).

- [ ] **Step 3: Verify chain reached Walter**

Wait another ~60 seconds, then check:
```bash
# Check if Dude sent a message to Walter's inbox
ls -la ~/.openclaw/agents/cto/inbox/

# Check Plaza for Dude's morning brief post
cat ~/.openclaw/plaza/feed.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
recent = [p for p in d.get('posts', []) if 'Morning Brief' in p.get('title', '') or 'morning brief' in p.get('content', '').lower()]
for p in recent[-2:]:
    print(f\"{p.get('author', '?')}: {p.get('title', p.get('content', '')[:80])}\")
"
```

Expected: Dude's morning brief post in Plaza, message in Walter's inbox.

- [ ] **Step 4: Verify Walter completed audit**

Wait another ~60 seconds, then check Plaza for Walter's infra audit post:
```bash
cat ~/.openclaw/plaza/feed.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
recent = [p for p in d.get('posts', []) if 'Infra Audit' in p.get('title', '') or 'infra audit' in p.get('content', '').lower()]
for p in recent[-2:]:
    print(f\"{p.get('author', '?')}: {p.get('title', p.get('content', '')[:80])}\")
"
```

Expected: Walter's infra audit post in Plaza.

- [ ] **Step 5: Test Donny's scan independently**

```bash
curl -s -X POST http://localhost:18800/fire \
  -H "Content-Type: application/json" \
  -d '{"trigger_id": "donny-daily-data-scan"}'
```

Wait ~60 seconds, then check:
```bash
ls -la ~/.openclaw/agents/worker/inbox/
```

Expected: a recent file from Donny with a dashboard improvement proposal (or "no proposals" message).

- [ ] **Step 6: Verify Donny→Dude→idea-check flow (manual)**

After Dude receives Donny's proposal, check that Dude processed it:
```bash
# Check Dude's most recent session log for idea-check invocation
ls -lt ~/.openclaw/agents/worker/workspace/.sessions/ | head -3
```

If Donny sent an L3 proposal, verify Dude called idea-check and routed the result. If Donny sent an L2 proposal (or "no proposals"), Dude should have approved directly without idea-check. This step may require manual review of Dude's session output — the exact behavior depends on what Donny proposes.

**Note**: Full end-to-end idea-check routing verification is best done manually since it depends on the content of Donny's proposal. Confirm that the `dude-from-donny` trigger fired and Dude's prompt includes the idea-check instruction.

- [ ] **Step 7: Final status check**

```bash
echo "=== Trigger Daemon ==="
curl -s http://localhost:18800/metrics | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"Agents: {d.get('agents')}, Triggers: {d.get('triggers')}, Status: {d.get('status')}\")"

echo "=== n8n Workflows ==="
curl -s http://localhost:5678/api/v1/workflows | python3 -c "
import sys, json
d = json.load(sys.stdin)
for w in d.get('data', []):
    print(f\"  {w['name']}: active={w.get('active', '?')}\")
"

echo "=== Tests ==="
cd ~/.openclaw && python3 -m pytest tests/ -q 2>&1 | tail -3
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Jr morning-brief skill | 3 min |
| 2 | Jr morning-brief trigger | 2 min |
| 3 | Dude morning-brief skill | 3 min |
| 4 | Dude trigger updates (disable cron + add from-donny) | 3 min |
| 5 | Walter morning-audit skill | 3 min |
| 6 | Walter trigger update (shift to 10am) | 2 min |
| 7 | Donny dashboard-scan skill | 3 min |
| 8 | Donny trigger update (use skill) | 2 min |
| 9 | n8n brave-search workflow | 5 min |
| 10 | n8n gemini-api workflow | 5 min |
| 11 | n8n stubs (elevenlabs + nanobanana) | 3 min |
| 12 | n8n gmail-fetch + graph-fetch (interactive OAuth) | 10 min |
| 13 | Backup + credential cleanup | 5 min |
| 14 | Restart daemon + verify | 3 min |
| 15 | Live chain test | 8 min |
| **Total** | | **~60 min** |
