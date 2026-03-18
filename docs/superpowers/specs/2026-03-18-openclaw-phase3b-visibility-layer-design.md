# OpenClaw Phase 3b — Visibility Layer Design Spec

**Date:** 2026-03-18
**Author:** Charlie Cubillas + Claude Code (Architect)
**Status:** Draft
**Scope:** Memory Vault (Obsidian-ready session transcripts), AIMEE MC Memory tab, Plaza Knowledge Feed
**Parent Spec:** `2026-03-18-openclaw-full-activation-design.md`

---

## 1. Problem Statement

Phase 3a delivered the trigger daemon — agents now wake on schedule, respond to events, and execute autonomously. But their work is invisible. Session transcripts are buried in JSONL files per agent. Plaza directories exist but have no indexing or dashboard visibility. There is no way to browse what agents did today, this week, or ever — without manually reading raw logs.

Phase 3b adds the visibility layer: making agent work browsable, searchable, and surfaced in the dashboard.

## 2. Goals

1. Convert raw JSONL session transcripts into browsable markdown (Obsidian-ready)
2. Generate daily summaries using local Nemotron LLM (zero API cost)
3. Add a Memory tab to AIMEE Mission Control showing session history by date/agent
4. Index Plaza posts into SQLite and surface as "Team Activity" in the dashboard
5. Create a shared `plaza-post` skill so agents know how to write discovery posts

## 3. Non-Goals

- Full-text search across transcripts (future — depends on memsearch/Milvus unblock)
- LLM-powered Q&A over session history ("what did Dude do last Tuesday?")
- Per-agent long-term memory docs (`~/.openclaw/memory/agents/*.md`) — deferred to Phase 4
- Mobile Obsidian sync setup (user configures after vault exists)

## 3.1 Naming Convention

Machine-readable fields (agent_id, frontmatter, JSON keys) use directory names: `worker`, `cto`, `jr`, `maude`, `brandt`, `smokey`, `da-fino`, `donny`, `mailroom`. Display text (summaries, UI labels) may use persona names: Dude, Walter, Bonny, Maude, Brandt, Smokey, Da Fino, Donny, Mailroom.

## 4. Architecture Overview

```
~/.openclaw/agents/*/sessions/*.jsonl     (source: raw transcripts)
~/.openclaw/agents/*/plaza/*.md           (source: agent plaza posts)
        │                                          │
        ▼                                          ▼
  convert-sessions.py (cron */5)           index-plaza.py (cron */5)
        │                                          │
        ▼                                          ▼
~/.openclaw/memory/                       ~/.openclaw/plaza/
├── daily/YYYY-MM-DD/                     ├── feed.db
│   ├── _summary.md (Nemotron)            └── feed.json
│   ├── worker-abc123.md                           │
│   └── cto-def456.md                              │
├── memory.db                                      │
└── memory-snapshot.json                           │
        │                                          │
        └──────────┬───────────────────────────────┘
                   ▼
            sync.sh (cron */1)
                   │
                   ▼
        AIMEE MC Dashboard
        ├── Memory tab (reads memory-snapshot.json)
        └── Team Activity panel (reads feed.json)
```

## 5. Component Details

### 5.1 Session Converter (`convert-sessions.py`)

**Location:** `~/.openclaw/memory/convert-sessions.py`
**Schedule:** Cron `*/5 * * * *`
**Runtime:** Python, uses the trigger daemon's venv (`~/.openclaw/triggers/.venv/`)

**Process:**
1. Glob for `~/.openclaw/agents/*/sessions/*.jsonl` — deleted sessions use the suffix `.jsonl.deleted.{timestamp}` and are naturally excluded by the glob pattern
2. For each unprocessed session (not in `memory.db`):
   a. Parse the JSONL — extract session metadata (first line: type=session, id, timestamp, cwd) and message entries (type=message)
   b. Convert to markdown with frontmatter
   c. Write to `~/.openclaw/memory/daily/YYYY-MM-DD/{agent}-{session-id-short}.md`
   d. Generate a one-line summary for the session via Nemotron (or extract first meaningful assistant response as fallback)
   e. Insert row into `memory.db` sessions table (including `summary_text`)
3. After conversion, generate daily summaries for any day with new sessions (Section 5.2)
4. Generate `memory-snapshot.json` (Section 5.4)

**JSONL parsing rules:**
- Session metadata: first line with `type: "session"` — extract `id`, `timestamp`, `cwd`
- Model info: line with `type: "model_change"` — extract `provider`, `modelId`
- Messages: lines with `type: "message"` — extract `message.role` and `message.content`
- Content may be a string or array of `{type: "text", text: "..."}` objects
- Skip `type: "thinking_level_change"`, `type: "custom"` lines
- Duration: difference between first and last timestamp in the file

**Markdown output format:**
```markdown
---
agent: worker
session_id: dadc85fd-502a-4aa6-b72f-a3349c7ec558
date: 2026-03-18
model: openai-codex/gpt-5.4
duration_minutes: 12
message_count: 24
source: /home/ccubillas/.openclaw/agents/worker/sessions/dadc85fd.jsonl
---

## User
System: [2026-03-17 00:48:02 EDT] Slack message...

## Assistant
Yep, I'm here.

## User
Check Paperclip for stalled tasks...

## Assistant
Found 3 tasks in queue...
```

### 5.2 Daily Summary Generator

**Runs as:** Final step of `convert-sessions.py`
**LLM:** Ollama Nemotron (`ollama/nemotron-3-nano:latest`) via HTTP API at `http://localhost:11434`

**Process:**
1. For each date with newly converted sessions, collect all session markdowns for that day
2. Concatenate session content (truncate to ~16,000 characters, roughly 4K tokens — conservative for inference speed on RTX 5080, not a context limit)
3. Prompt Nemotron:
   ```
   Summarize the following AI agent sessions from {date}. List which agents were active,
   what they worked on, key decisions made, and any issues encountered. Keep it under 200 words.

   {concatenated sessions}
   ```
4. Write output to `~/.openclaw/memory/daily/YYYY-MM-DD/_summary.md`
5. Update `daily_summaries` table in `memory.db`
6. If a summary already exists for a date with new sessions, regenerate it

**Summary markdown format:**
```markdown
---
date: 2026-03-18
agents_active: [worker, cto, smokey, jr]
session_count: 8
generated_at: 2026-03-18T17:30:00Z
generator: nemotron-3-nano
---

## Daily Summary — 2026-03-18

**Active agents:** Dude, Walter, Smokey, Jr

Dude processed 3 Paperclip tasks including the PowerApps research...
```

**Fallback:** If Ollama is unreachable, write a rule-based summary (agent names, session counts, durations) instead of failing.

### 5.3 SQLite Index (`memory.db`)

**Location:** `~/.openclaw/memory/memory.db`

**Schema:**
```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,           -- session UUID
    agent_id TEXT NOT NULL,
    date TEXT NOT NULL,             -- YYYY-MM-DD
    session_file TEXT NOT NULL,     -- source JSONL path
    vault_path TEXT NOT NULL,       -- converted markdown path
    model TEXT,
    duration_ms INTEGER,
    message_count INTEGER,
    summary_text TEXT,              -- one-line summary (from Nemotron, nullable)
    processed_at TEXT NOT NULL
);

CREATE TABLE daily_summaries (
    date TEXT PRIMARY KEY,          -- YYYY-MM-DD
    summary_path TEXT NOT NULL,
    session_count INTEGER,
    agents_active TEXT,             -- JSON array
    generated_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_sessions_agent ON sessions(agent_id);
```

### 5.4 Memory Snapshot (`memory-snapshot.json`)

**Location:** `~/.openclaw/memory/memory-snapshot.json`
**Generated by:** `convert-sessions.py` after each run
**Consumed by:** AIMEE MC Memory tab

**Structure:**
```json
{
  "generated_at": "2026-03-18T17:30:00Z",
  "daily": [
    {
      "date": "2026-03-18",
      "summary": "Dude processed 3 Paperclip tasks...",
      "agents_active": ["worker", "cto", "smokey", "jr"],
      "sessions": [
        {
          "id": "dadc85fd",
          "agent": "worker",
          "model": "openai-codex/gpt-5.4",
          "duration_minutes": 12,
          "messages": 24,
          "summary": "Checked Paperclip queue, processed 3 tasks"
        }
      ]
    }
  ],
  "stats": {
    "total_sessions": 47,
    "agents_active": 8,
    "days_covered": 14
  }
}
```

**Window:** Last 14 days. Older data remains in `memory.db` and the markdown files but is not included in the snapshot.

### 5.5 AIMEE MC Memory Tab

**Files modified:** `~/.openclaw/ctg-core/dashboard/index.html`, `style.css`

**UI design:**
- New "Memory" tab in the existing tab bar (alongside Live, Demo, Kanban, etc.)
- Fetches `memory-snapshot.json` on tab activation
- **Day accordion:** Each date is a collapsible section showing the daily summary at top
- **Session cards:** Below each summary, individual session cards with: agent name, model badge, duration, message count, one-line summary
- **Agent filter:** Dropdown at top to filter sessions by agent
- **Stats bar:** Total sessions, active agents, days covered

**No new dependencies.** Vanilla JS, same patterns as existing dashboard tabs.

### 5.6 Plaza Indexer (`index-plaza.py`)

**Location:** `~/.openclaw/plaza/index-plaza.py`
**Schedule:** Cron `*/5 * * * *` (separate cron entry — see Section 6)
**Runtime:** Python, uses trigger daemon's venv

**Process:**
1. Scan all `~/.openclaw/agents/*/plaza/*.md` files
2. Parse YAML frontmatter (agent, date, topic, tags, type)
3. For each unindexed post (not in `feed.db`):
   a. Copy file to `~/.openclaw/plaza/YYYY-MM-DD-{agent}-{topic-slug}.md` (centralized copy)
   b. Insert into `feed.db` posts table
4. Generate `feed.json` — last 50 posts sorted by date desc

**`feed.db` schema:**
```sql
CREATE TABLE posts (
    id TEXT PRIMARY KEY,            -- hash of agent+date+topic
    agent_id TEXT NOT NULL,
    date TEXT NOT NULL,
    topic TEXT NOT NULL,
    tags TEXT,                       -- JSON array
    type TEXT DEFAULT 'post',        -- 'post' or 'comment'
    content_path TEXT NOT NULL,      -- path to centralized copy
    source_path TEXT NOT NULL,       -- original agent plaza/ path
    summary TEXT,                    -- first 200 chars of body
    indexed_at TEXT NOT NULL
);

CREATE INDEX idx_posts_date ON posts(date);
CREATE INDEX idx_posts_agent ON posts(agent_id);
```

**`feed.json` structure:**
```json
{
  "generated_at": "2026-03-18T17:35:00Z",
  "posts": [
    {
      "agent": "worker",
      "date": "2026-03-18",
      "topic": "GitHub PR velocity",
      "tags": ["metrics", "github"],
      "type": "post",
      "summary": "Noticed PR merge times dropped 40% this week..."
    }
  ]
}
```

### 5.7 AIMEE MC "Team Activity" Panel

**Location:** Added to the main dashboard view (not a separate tab)
**Position:** Right sidebar or bottom section of the Live view

**UI design:**
- Feed-style list of recent plaza posts
- Each entry: agent name, topic (bold), timestamp, first ~100 chars of content
- Click to expand full post content inline
- Reads from `feed.json`

### 5.8 `plaza-post` Shared Skill

**Location:** `~/.openclaw/skills/plaza-post/SKILL.md`

**SKILL.md content teaches agents:**
- When to post: discoveries, learnings, status updates, recommendations
- Required frontmatter format (agent, date, topic, tags, type)
- Rules: max 1 post + 2 comments per invocation, under 500 words, use descriptive tags
- File naming: `YYYY-MM-DD-{topic-slug}.md` in their `plaza/` directory
- Example post with correct format

**Installation:** Symlink from each agent's `skills/` directory, or install via ClawHub if packaged.

### 5.9 Sync Pipeline Update

**File modified:** `~/.openclaw/ctg-core/dashboard/sync.sh`

**Changes:**
1. Add two `cp` lines before the git operations:
   ```bash
   cp ~/.openclaw/memory/memory-snapshot.json "$DEPLOY_DIR/" 2>/dev/null || true
   cp ~/.openclaw/plaza/feed.json "$DEPLOY_DIR/" 2>/dev/null || true
   ```
2. Update the `git add` command to include the new files (or use `git add -A`)
3. The existing `git diff --cached --quiet` check handles skip-if-no-changes

## 6. Cron Configuration

```crontab
# Phase 3b: Memory vault + Plaza indexer (every 5 minutes, flock prevents overlap)
*/5 * * * * flock -n /tmp/convert-sessions.lock /home/ccubillas/.openclaw/triggers/.venv/bin/python /home/ccubillas/.openclaw/memory/convert-sessions.py >> /home/ccubillas/.openclaw/memory/convert.log 2>&1
*/5 * * * * flock -n /tmp/index-plaza.lock /home/ccubillas/.openclaw/triggers/.venv/bin/python /home/ccubillas/.openclaw/plaza/index-plaza.py >> /home/ccubillas/.openclaw/plaza/index.log 2>&1
```

**First run:** Invoke manually to verify output before enabling cron. The `memory.db` tracking ensures idempotent reruns if interrupted.

## 7. File Tree (New Files)

```
~/.openclaw/memory/                         (NEW directory)
├── convert-sessions.py                     (converter + summary generator)
├── convert.log                             (cron output log)
├── memory.db                               (SQLite index)
├── memory-snapshot.json                    (for dashboard)
├── daily/
│   └── YYYY-MM-DD/
│       ├── _summary.md                     (Nemotron-generated)
│       ├── worker-abc123.md
│       └── cto-def456.md
# agents/ subdirectory deferred to Phase 4 (see Non-Goals)

~/.openclaw/plaza/                          (EXISTS, add files)
├── index-plaza.py                          (indexer)
├── index.log                               (cron output log)
├── feed.db                                 (SQLite index)
├── feed.json                               (for dashboard)
└── YYYY-MM-DD-{agent}-{topic}.md           (centralized copies)

~/.openclaw/skills/plaza-post/              (NEW directory)
└── SKILL.md                                (shared skill)

~/.openclaw/ctg-core/dashboard/             (MODIFY existing)
├── index.html                              (add Memory tab + Team Activity panel)
├── style.css                               (add Memory/Activity styles)
└── sync.sh                                 (add 2 cp lines)
```

## 8. Dependencies

- Python 3.10+ (already in trigger daemon venv)
- `pyyaml` — for parsing plaza post frontmatter (add to venv)
- `urllib.request` — for Ollama HTTP API calls (stdlib, no install needed)
- Ollama running with `nemotron-3-nano:latest` (already installed)
- Existing trigger daemon venv at `~/.openclaw/triggers/.venv/`

**Setup:** Install new dependency into shared venv:
```bash
~/.openclaw/triggers/.venv/bin/pip install pyyaml
```

## 9. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Nemotron context too small for many sessions | Truncate to ~16K chars, summarize per-agent if needed |
| Ollama down during summary generation | Fallback to rule-based summary (agent list, counts, durations) |
| Large number of JSONL files on first run | Process in batches of 50, track progress in memory.db |
| JSONL format changes across OpenClaw versions | Defensive parsing — skip unrecognized line types, log warnings |
| Dashboard payload too large | 14-day window cap on memory-snapshot.json, 50-post cap on feed.json |

## 10. Success Criteria

- [ ] Session converter processes all existing JSONL files into browsable markdown
- [ ] Daily summaries generated by Nemotron for each day with sessions
- [ ] Memory tab in AIMEE MC shows sessions grouped by date with summaries
- [ ] Plaza indexer picks up new posts and generates feed.json
- [ ] Team Activity panel shows recent plaza posts in the dashboard
- [ ] plaza-post skill installed on all 9 agents
- [ ] Obsidian can open `~/.openclaw/memory/` as a vault and browse daily entries
- [ ] Both cron jobs run without errors for 24 hours
