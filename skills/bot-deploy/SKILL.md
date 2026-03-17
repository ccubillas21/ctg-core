# SKILL: Bot Deploy

**Purpose:** Deploy a new agent into the corporate structure.
**Owner:** Primary Agent (triggers), Engineer Agent (executes)
**Trigger:** Manual or via Lobster workflow

---

## Overview

This skill creates a new agent with workspace, Paperclip registration, and OpenClaw config entry. It uses the `new-bot.lobster` workflow for the full process including approval gates.

## Usage

```bash
# Via Lobster workflow (preferred — includes approval gate)
lobster run new-bot.lobster \
  --var agent_name="support" \
  --var agent_title="Customer Support Specialist" \
  --var model_tier="sonnet" \
  --var purpose="Handle customer inquiries and ticket triage"

# Via script (direct, no approval gate)
./scripts/deploy-bot.sh <agent-name> "<agent-title>" <model-tier> "<purpose>"
```

## Model Tiers

| Tier | Model | Best For |
|------|-------|----------|
| `sonnet` | anthropic/claude-sonnet-4-6 | Comms, triage, general tasks |
| `opus` | anthropic/claude-opus-4-6 | Code, architecture, deep analysis |
| `haiku` | anthropic/claude-haiku-4-5 | Monitoring, cron, routing, ops |

## What Gets Created

1. **Agent workspace** — `~/.openclaw/agents/<name>/` with SOUL.md, AGENTS.md, IDENTITY.md
2. **Paperclip registration** — Agent record with capabilities and status
3. **OpenClaw config entry** — Agent definition with model routing and tool permissions

## After Deployment

Connect the agent to a communication channel:
```bash
# Slack
lobster run slack-setup.lobster --var agent_id="<name>" ...

# Or bridge an existing channel
lobster run channel-bridge.lobster --var agent_id="<name>" --var channel_type="slack" ...
```
