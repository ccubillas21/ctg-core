# Mailroom Email Triage Agent — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Author:** Charlie Cubillas + Claude Code

## Overview

A two-agent system for autonomous email triage, inventory, and searchable indexing across Gmail and Outlook accounts. Designed with defense-in-depth against prompt injection — the primary threat vector when AI agents process untrusted email content.

**Problem:** 20K+ emails across Gmail and Microsoft 365 accounts. No inventory, no organization, no way to search. Important emails get buried. New important emails arrive without notification.

**Solution:** A quarantined "Mailroom" agent fetches, sanitizes, scans, and classifies emails. A privileged "Bonny" (Jr admin) agent acts on classifications, answers queries, and sends Slack alerts. The two agents communicate only via structured JSON — raw email content never crosses the trust boundary.

---

## Section 1: Agent Architecture & Trust Boundaries

### Two-Agent Split

```
┌─────────────────────────────────────────────────────────┐
│                    UNTRUSTED ZONE                        │
│                                                         │
│  ┌─────────────┐    ┌───────────┐    ┌──────────────┐  │
│  │  Gmail API   │───▶│           │───▶│  LLM Guard   │  │
│  └─────────────┘    │  Mailroom  │    │  (scanner)   │  │
│  ┌─────────────┐    │  Agent     │    └──────┬───────┘  │
│  │ Graph API   │───▶│           │            │          │
│  └─────────────┘    │ nemotron/ │◀───────────┘          │
│                     │ qwen      │   clean content only   │
│                     └─────┬─────┘                        │
│                           │                              │
│                    structured JSON only                   │
│                    (no raw email text)                    │
│                           │                              │
└───────────────────────────┼──────────────────────────────┘
                            │
                    ════════╪════════  TRUST BOUNDARY
                            │
┌───────────────────────────┼──────────────────────────────┐
│                    TRUSTED ZONE                          │
│                           ▼                              │
│                     ┌───────────┐                        │
│                     │  Bonny    │                        │
│                     │  (Jr)     │                        │
│                     └─────┬─────┘                        │
│                           │                              │
│              ┌────────────┼────────────┐                 │
│              ▼            ▼            ▼                  │
│        ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│        │  Slack   │ │  QMD +   │ │  Gmail/  │           │
│        │  Alerts  │ │  SQLite  │ │  Graph   │           │
│        │          │ │  (query) │ │  (act)   │           │
│        └──────────┘ └──────────┘ └──────────┘           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Mailroom Agent

- **Purpose:** Fetch, sanitize, scan, classify, and index emails. Report structured results to Bonny.
- **Model:** `ollama/nemotron-3-nano:latest` (primary), escalates to `qwen/qwen3.5-plus` for low-confidence classifications.
- **Tools (strictly limited):**
  - `email_fetch` — read-only API calls to Gmail and Graph
  - `index_write` — write to its own QMD collection and SQLite database
  - `sessions_send` — send structured JSON to Bonny only
- **Cannot:** execute commands, write files outside its index, access other agents' data, modify emails, send messages to users, access workspace files, or communicate with any agent other than Bonny.
- **If compromised:** Can write garbage to its own index and send structured messages to Bonny. No exfiltration path, no action capability, no access to private data.

### Bonny (Jr Admin) — New Capabilities

Bonny gains three new skills on top of her existing toolset:

- **`email-query`** — searches QMD + SQLite to answer user questions about email
- **`email-alert`** — receives classified emails from Mailroom, posts high-priority ones to Slack
- **`email-action`** — executes approve/reject decisions (archive, label, delete via Gmail/Graph APIs with read-write tokens)

Bonny never sees raw email content. She receives structured JSON summaries only.

### Meta's Rule of Two — Enforcement

| Capability | Mailroom | Bonny |
|---|---|---|
| Reads untrusted content | Yes | **Never** |
| Accesses private data | **No** | Yes |
| Takes external actions | **No** | Yes |

No agent ever holds all three powers simultaneously.

---

## Section 2: Email Ingestion Pipeline

### Bulk Ingestion (one-time, 20K+)

```
1. FETCH (batches of 500)
   Gmail API: messages.list → messages.get (metadata + body)
   Graph API: /me/messages?$top=500 (pagination via @odata.nextLink)
   │
   ▼
2. SANITIZE (deterministic code, not LLM-based)
   - Strip HTML → plain text (whitelist approach via bleach or equivalent)
   - Remove tracking pixels, base64 blobs, embedded objects
   - Extract structured fields: sender, recipients, date, subject, message-id, thread-id
   - Keep plain text body truncated to 4K chars
   - Attachments: metadata only (filename, size, type) — NOT content
   - Unicode normalization, zero-width character removal
   - Regex strip for known injection patterns
   │
   ▼
3. SCAN (LLM Guard)
   - PromptInjection scanner (BERT-based classifier)
   - InvisibleText scanner (zero-width chars, homoglyphs)
   - BanSubstrings scanner (blocklist: "ignore previous", "system prompt", "<|im_start|>", "[INST]")
   - Score > 0.7 → mark injection_flag, skip LLM classification, route to needs-review
   │
   ▼
4. CLASSIFY (tiered)
   - Nemotron first pass: categories = trash|archive|keep|needs-attention|financial|legal|personal
   - Confidence score 0.0–1.0
   - Confidence < 0.6 → escalate to Qwen for second opinion
   - Output: structured JSON per email
   │
   ▼
5. INDEX
   - SQLite: INSERT row with all structured fields
   - QMD: Write markdown doc with frontmatter + truncated body
   │
   ▼
6. REPORT (every 500 emails)
   - sessions_send to Bonny: batch summary JSON
   - Bonny posts to Slack: "Processed 2,500 / ~22,000 — 1,800 trash, 400 archive, 200 keep, 100 needs-attention"
```

### Ongoing Monitoring (post-ingestion)

```
Cron: */5 * * * * (every 5 minutes)
   │
   ▼
1. FETCH new emails since last sync
   Gmail: historyId-based delta
   Graph: deltaLink-based delta
   ▼
2. SANITIZE → SCAN → CLASSIFY (same pipeline as bulk)
   ▼
3. INDEX (append to SQLite + QMD)
   ▼
4. DECIDE based on confidence:
   - confidence ≥ 0.85 → auto-act (archive/label, NEVER permanent delete)
   - confidence < 0.85 → send to Bonny for user review
   ▼
5. ALERT (if category = needs-attention, financial, legal, or unknown-important)
   - Bonny posts to Slack:
     "📬 From: accountant@firm.com | Subject: Q1 Tax Filing Deadline
      Category: financial/urgent | Confidence: 0.94
      Summary: Reminder that Q1 estimated taxes due April 15..."
```

### Alert Triggers

All of the following generate Slack notifications through Bonny:

- **Specific senders** — emails from known important contacts (accountant, lawyer, clients)
- **Content-based urgency** — time-sensitive language (deadlines, payments due, legal notices, action required)
- **Dollar amounts / financial** — invoices, receipts, billing issues
- **New/unknown important senders** — unfamiliar sender but content looks legitimate and important

---

## Section 3: QMD + SQLite Index Schema

### SQLite Schema

```sql
CREATE TABLE emails (
    message_id    TEXT PRIMARY KEY,   -- Gmail/Graph message ID
    account       TEXT NOT NULL,      -- 'gmail' or 'outlook'
    thread_id     TEXT,               -- conversation threading
    sender        TEXT NOT NULL,      -- normalized email address
    sender_name   TEXT,               -- display name
    recipients    TEXT,               -- JSON array
    date          TEXT NOT NULL,      -- ISO 8601
    subject       TEXT,
    category      TEXT NOT NULL,      -- trash|archive|keep|needs-attention|financial|legal|personal
    confidence    REAL NOT NULL,      -- 0.0–1.0
    model_used    TEXT,               -- nemotron|qwen
    injection_flag BOOLEAN DEFAULT 0, -- LLM Guard flagged
    auto_acted    BOOLEAN DEFAULT 0,  -- Mailroom took action
    action_taken  TEXT,               -- archive|label|none|pending-review
    user_decision TEXT,               -- approved|rejected|reclassified (from Bonny)
    labels        TEXT,               -- JSON array of applied labels
    snippet       TEXT,               -- first 200 chars, sanitized
    indexed_at    TEXT NOT NULL       -- when we processed it
);

CREATE INDEX idx_sender ON emails(sender);
CREATE INDEX idx_date ON emails(date);
CREATE INDEX idx_category ON emails(category);
CREATE INDEX idx_confidence ON emails(confidence);
CREATE INDEX idx_account ON emails(account);
CREATE INDEX idx_thread ON emails(thread_id);
```

### QMD Markdown Format

One file per email, stored in a dedicated collection separate from agent workspace memory.

```markdown
---
message_id: "msg_abc123"
account: gmail
sender: accountant@firm.com
sender_name: "Jane Smith"
date: "2025-11-15T09:30:00Z"
subject: "Q1 Tax Filing Deadline Reminder"
category: financial
confidence: 0.94
thread_id: "thread_xyz"
---

Reminder that Q1 estimated taxes are due April 15.
Attached: Q1-estimate-worksheet.pdf (42KB)
Please review the attached worksheet and confirm
the payment amount by end of week.
```

**QMD path:** `~/.openclaw/agents/mailroom/qmd/emails/`

### Query Flow (Bonny's email-query skill)

1. **Structured questions** → SQLite first: `SELECT * FROM emails WHERE sender LIKE '%accountant%' AND date >= '2025-01-01' ORDER BY date DESC`
2. **Fuzzy/natural language** → QMD `memory_search` against the emails collection
3. **Aggregation** ("how many newsletters?", "top senders by volume") → SQLite only
4. Bonny formats results and responds via Slack/Telegram

---

## Section 4: Security Model

### Layer 1 — Architectural Isolation (Rule of Two)

The primary defense. Even if all other layers fail, a compromised Mailroom agent cannot exfiltrate data or take harmful actions because it architecturally lacks the capability.

| Capability | Mailroom | Bonny |
|---|---|---|
| Reads untrusted content | Yes | **Never** |
| Accesses private data | **No** — only its own index | Yes |
| Takes external actions | **No** — write to index + sessions_send only | Yes (Slack, email actions) |

### Layer 2 — Input Scanning (LLM Guard)

Runs before any content reaches an LLM:

- **PromptInjection scanner** — BERT-based classifier, detects direct and indirect injection
- **InvisibleText scanner** — catches zero-width chars, homoglyphs, hidden Unicode
- **BanSubstrings scanner** — blocklist of known injection patterns

Flagged emails:
- `injection_flag = true` in SQLite
- Skipped from LLM classification entirely
- Routed to "needs-review" with flag reason
- Bonny notifies user: "LLM Guard flagged an email from X — possible prompt injection. Quarantined for manual review."

### Layer 3 — Trust Boundary Protocol

`sessions_send` messages from Mailroom → Bonny must conform to a strict JSON schema:

```json
{
  "type": "email_batch | email_alert | email_status",
  "emails": [
    {
      "message_id": "string",
      "account": "gmail | outlook",
      "sender": "string",
      "sender_name": "string",
      "date": "ISO 8601",
      "subject": "string (max 200 chars)",
      "category": "enum",
      "confidence": "number 0-1",
      "snippet": "string (max 200 chars)",
      "injection_flag": "boolean",
      "recommended_action": "archive | label | review | alert"
    }
  ],
  "progress": { "processed": 0, "total": 0 }
}
```

**Bonny rejects any message that:**
- Fails JSON schema validation
- Contains fields longer than their max length
- Contains raw email body text
- References tools, function calls, or instruction-like patterns in any string field

### Layer 4 — Credential Separation

| Credential | Held By | Scope |
|---|---|---|
| Gmail OAuth token (read-only) | Mailroom | `gmail.readonly` |
| Graph OAuth token (read-only) | Mailroom | `Mail.Read` |
| Gmail OAuth token (read-write) | Bonny | `gmail.modify` |
| Graph OAuth token (read-write) | Bonny | `Mail.ReadWrite` |
| Slack bot token | Bonny | Existing "Bonny" Slack app |

Mailroom cannot modify email even if fully compromised — its tokens are read-only.

### Layer 5 — Output Validation on Actions

When Bonny auto-acts on high-confidence items:
- **Only soft actions:** `archive` or `label`. Never `delete`.
- All actions logged to SQLite (`auto_acted = true`, `action_taken`)
- Daily digest to Slack: "Auto-archived 47 emails today. 3 flagged for your review."
- Undo capability: "undo the last batch" → Bonny moves archived emails back to inbox

### Upgrade Path to Lakera Guard (Premium)

When ready, swap Layer 2:
- Replace LLM Guard scanners with `POST https://api.lakera.ai/v2/guard`
- Keep LLM Guard as local fallback if Lakera API is unreachable
- No architecture changes needed — scanner is a pluggable step

---

## Section 5: OpenClaw Agent Configuration

### Mailroom Agent Definition

New entry in `openclaw.json` under `agents`:

```json
{
  "mailroom": {
    "name": "Mailroom",
    "persona": "Silent email processor. Never interacts with users directly. Reports to Bonny only.",
    "model": "ollama/nemotron-3-nano:latest",
    "escalationModel": "qwen/qwen3.5-plus",
    "tools": ["email_fetch", "index_write", "sessions_send"],
    "toolRestrictions": {
      "sessions_send": { "allowedTargets": ["jr"] },
      "index_write": { "allowedPaths": ["~/.openclaw/agents/mailroom/qmd/emails/", "~/.openclaw/agents/mailroom/db/"] }
    },
    "contextTokens": 128000,
    "channels": [],
    "scheduling": {
      "bulk": "manual",
      "monitor": "*/5 * * * *"
    }
  }
}
```

Key decisions:
- **No channels** — Mailroom never talks to users
- **128K context** — above the 100K safe floor
- **`sessions_send` locked to Bonny only**
- **`index_write` locked to its own directories**

### Bonny Skill Additions

| Skill | Purpose | Trigger |
|---|---|---|
| `email-query` | Search QMD + SQLite, return results to user | User asks about email/mail/messages/sender |
| `email-alert` | Receive alerts from Mailroom, validate schema, post to Slack | Incoming `sessions_send` from Mailroom |
| `email-action` | Execute user decisions (archive, label, undo) via read-write OAuth | User commands via Slack/Telegram |

### Cron

```
# Mailroom: ongoing email monitoring (after bulk ingestion complete)
*/5 * * * * /usr/bin/openclaw agent run mailroom --task monitor >> ~/.openclaw/agents/mailroom/monitor.log 2>&1
```

Bulk ingestion triggered manually: `openclaw agent run mailroom --task ingest`

### File Structure

```
~/.openclaw/agents/mailroom/
├── agent/
│   ├── skills/
│   │   └── email-pipeline/
│   │       ├── SKILL.md
│   │       ├── fetch.py          # Gmail API + Graph API clients
│   │       ├── sanitize.py       # HTML strip, unicode normalize, truncate
│   │       ├── scan.py           # LLM Guard wrapper
│   │       ├── classify.py       # Nemotron/Qwen classification
│   │       └── index.py          # SQLite + QMD writer
│   └── config/
│       ├── schema.json           # Trust boundary JSON schema
│       └── categories.json       # Classification taxonomy
├── db/
│   └── emails.sqlite             # SQLite index
├── qmd/
│   └── emails/                   # One .md per email
├── logs/
│   └── monitor.log
└── credentials/
    ├── gmail-readonly.json       # Read-only OAuth token
    └── graph-readonly.json       # Read-only OAuth token

~/.openclaw/workspace/skills/
├── email-query/
│   └── SKILL.md                  # Bonny's query skill
├── email-alert/
│   └── SKILL.md                  # Bonny's alert skill
└── email-action/
    └── SKILL.md                  # Bonny's action skill
```

---

## Section 6: Client Packaging & First-Client Relevance

### What Ships Generic (CTG Core module)

- Mailroom agent definition (templatized — client plugs in their own OAuth creds)
- Sanitizer + LLM Guard pipeline (identical for every deployment)
- SQLite schema + QMD index structure
- Bonny skill templates (email-query, email-alert, email-action)
- Trust boundary JSON schema
- Category taxonomy (customizable per client)

### What's Per-Client

- OAuth tokens (Gmail, Outlook — each client does their own OAuth consent)
- Slack workspace + channel configuration
- Category customizations ("I want a 'contracts' category")
- Confidence thresholds (some clients want more automation, some want more review)
- Alert rules (which senders/patterns trigger Slack notifications)

### Pricing Alignment

Fits existing CTG Core tiers:

| Tier | Email Capabilities |
|---|---|
| **Starter** | Email monitoring + Slack alerts only (no bulk triage, no query) |
| **Agents** | Full Mailroom + Bonny pipeline, bulk ingestion, searchable index |
| **Custom** | Lakera Guard upgrade, custom categories, multi-account beyond 2 |

### Security as Differentiator

The Rule of Two architecture + LLM Guard + credential separation is a selling point. Most AI email tools run the LLM with full access to everything.

**Pitch:** *"Our email agent is architecturally incapable of leaking your data — the component that reads your email cannot take actions or access other systems, by design."*

---

## Dependencies & Prerequisites

| Dependency | Purpose | Status |
|---|---|---|
| Gmail API OAuth app | Read-only email access | Not yet created |
| Azure App Registration (Graph) | Read-only email access | Azure infra exists, new app needed |
| LLM Guard (pip install) | Prompt injection scanning | Not yet installed |
| SQLite3 | Email index | Available on system |
| QMD | Full-text email search | Already running |
| Bonny Slack app | Alert delivery | Already configured |
| Python `bleach` / `html2text` | HTML sanitization | Not yet installed |
| Google API Python client | Gmail API | Not yet installed |
| `msal` / `msgraph-sdk` | Microsoft Graph | Not yet installed |

## Open Questions

None — all sections approved. Ready for implementation planning.

---

## References

- [Meta: Rule of Two for AI Agent Security](https://ai.meta.com/blog/practical-ai-agent-security/)
- [Design Patterns for Securing LLM Agents (arXiv:2506.08837)](https://arxiv.org/html/2506.08837v3)
- [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [LLM Guard](https://github.com/protectai/llm-guard) — open-source input/output scanners
- [LlamaFirewall / PromptGuard 2](https://github.com/meta-llama/PurpleLlama) — BERT-based injection classifier
- [NeMo Guardrails](https://github.com/NVIDIA-NeMo/Guardrails) — programmable guardrails (future consideration)
- [Lakera Guard](https://www.lakera.ai/) — commercial prompt injection detection (upgrade path)
- [CaMeL (Google DeepMind)](https://github.com/google-research/camel-prompt-injection) — capability-based security (research reference)
