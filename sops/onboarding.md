# SOP: New Bot/Agent Onboarding

**Owner:** Primary Agent
**Last Updated:** {{DEPLOY_DATE}}
**Approval Required:** Yes (human stakeholder)

---

## Purpose

Standard procedure for adding a new bot or agent to this corporate deployment.

## Prerequisites

- Anthropic API key configured (or alternative provider)
- Paperclip running and healthy
- Target communication channel identified (Slack/Teams)

## Procedure

### Step 1: Define the Agent

1. Decide agent role, name, and model tier:
   - **Sonnet** — General-purpose, comms, triage
   - **Opus** — Deep work, code, architecture
   - **Haiku** — Ops, monitoring, cron, routing
2. Document the agent's purpose, KPIs, and constraints

### Step 2: Create Agent Workspace

1. Run the `bot-deploy` skill or `new-bot.lobster` workflow
2. This creates:
   - Agent directory with SOUL.md, AGENTS.md, IDENTITY.md
   - Paperclip registration
   - OpenClaw config entry

### Step 3: Connect Communication Channel

1. Run the `slack-provision` or `channel-bridge` skill
2. Configure channel bindings in openclaw.json
3. Test message send/receive

### Step 4: Verify

1. Agent responds to test message in channel
2. Agent appears healthy in Mission Control dashboard
3. Paperclip shows agent as active
4. Parent relay reports new agent to hub

### Step 5: Handoff

1. Notify stakeholders that new bot is live
2. Provide bot name, channel, and capabilities summary
3. Schedule 24-hour check-in to verify stability

---

## Rollback

If onboarding fails:
1. Remove agent from openclaw.json
2. Delete agent workspace directory
3. Deactivate in Paperclip
4. Remove channel bindings
