# Working With AI Agents
## A Practical Guide for First-Time Users

**Cubillas Technology Group**
*For clients, operators, and anyone new to AI-assisted work*

---

## Before We Start

You're about to work alongside AI agents — software that reads, writes, thinks, and acts on your behalf. Not a search engine. Not autocomplete. These are digital workers with roles, responsibilities, and boundaries.

This guide will teach you how to talk to them, what to expect, and how to avoid the most common mistakes people make.

---

## Part 1: What AI Agents Actually Are

### They're Not Magic

An AI agent is a language model (like ChatGPT, Claude, or Gemini) connected to tools — email, Slack, files, databases, APIs. The model reads and writes. The tools let it act.

Think of it like hiring a very fast, very literal employee who:

- Reads everything you send instantly
- Never forgets instructions (within a conversation)
- Has no ego, no bad days, no politics
- Takes everything you say at face value
- Will do exactly what you ask — even if what you ask is wrong

That last point is the most important thing in this guide.

### They're Not People

AI agents don't have feelings, opinions, or desires. When an agent says "I think we should..." it's generating the most likely helpful response, not expressing a belief. Don't anthropomorphize them. Don't say please and thank you expecting it to change the output (though it's fine if it's just your habit). Don't worry about hurting their feelings when you reject their work.

They are tools. Powerful, flexible, sometimes surprising tools — but tools.

### They Make Mistakes

Every AI model hallucinates. This means it will occasionally:

- State false information with complete confidence
- Invent data, statistics, or quotes that don't exist
- Misunderstand your request and deliver something plausible but wrong
- Follow a pattern that worked before into a situation where it doesn't apply

This isn't a bug. It's a fundamental property of how language models work. Your job is to verify, not to trust blindly.

---

## Part 2: How to Talk to AI

### The Golden Rule

**Be specific. Be explicit. Say what you mean.**

AI agents are like the world's most capable intern on their first day. They're brilliant but they don't know your context, your preferences, or what you actually meant when you said "clean this up."

### Good vs. Bad Instructions

| Bad | Why It's Bad | Good |
|---|---|---|
| "Fix this" | Fix what? How? What counts as fixed? | "The total on line 12 should be $4,500. It currently shows $3,200. Update the formula." |
| "Make it better" | Better how? More concise? More detailed? Different tone? | "Rewrite this email to be more direct. Cut it to 3 sentences. Keep the deadline." |
| "Do the usual" | The agent has no memory of what 'usual' means across sessions | "Run the daily health check: verify all 5 services respond, log any failures to Slack" |
| "Handle it" | No constraints, no success criteria | "Reply to this customer. Apologize for the delay. Offer a 10% discount. Don't promise a specific date." |
| "Can you help?" | Too vague to act on | "Summarize this 30-page contract. List every obligation with a deadline." |

### The Three-Part Prompt

When giving an agent a task, include:

1. **Context** — What's the situation? What does the agent need to know?
2. **Task** — What specifically should it do?
3. **Constraints** — What are the boundaries? Format? Length? Tone? What should it NOT do?

**Example:**
> "We received a complaint from a customer about late delivery (Order #4412, shipped March 3, arrived March 15 instead of March 8). Draft a response email. Keep it under 150 words. Apologize, explain the delay was due to a carrier issue, and offer free shipping on their next order. Don't blame anyone. Don't promise it won't happen again — just say we're reviewing our shipping process."

That's specific. That's actionable. That gets good results on the first try.

### When to Give More Context

- When the task involves judgment calls ("professional" means different things in law vs. tech startups)
- When there are company-specific terms or abbreviations
- When the agent needs to match a style or voice
- When there are things it should definitely NOT do

### When Less Is More

- Simple, mechanical tasks ("Convert this CSV to a table")
- When you'll review and iterate anyway
- When exploring ideas ("Give me 5 approaches to reduce customer churn")

---

## Part 3: Do's and Don'ts

### Do

**Verify important outputs.** If the agent generates numbers, check them. If it cites a source, confirm it exists. If it writes code, test it. Trust but verify — especially for anything client-facing, financial, or legal.

**Iterate.** Your first prompt rarely produces the perfect result. That's normal. Say what's wrong, be specific, and ask for a revision. "Make the second paragraph more concise" is better than starting over.

**Set boundaries upfront.** Tell the agent what it should NOT do before it does it. "Don't contact the client directly" is cheaper than undoing a sent email.

**Use agents for what they're good at:**
- Drafting and rewriting text
- Summarizing long documents
- Analyzing data and spotting patterns
- Answering questions about large knowledge bases
- Automating repetitive workflows
- First-pass triage and classification

**Break big tasks into steps.** Instead of "Build me a marketing strategy," try:
1. "Analyze our last 6 months of campaign data"
2. "Identify the 3 best-performing channels"
3. "Draft a strategy focused on those channels with a $10K monthly budget"

**Save your good prompts.** When something works well, keep it. Reuse it. Share it with your team. Good prompts are valuable.

**Read what the agent sends you.** It sounds obvious, but many people approve agent outputs without reading them. You are responsible for everything that goes out under your name.

### Don't

**Don't assume the agent understood you.** If the output is wrong, the prompt was probably unclear — not the agent. Rephrase, don't repeat.

**Don't share sensitive information carelessly.** Understand where your data goes. Our system runs locally — your data stays on your hardware. But if you paste something into a public AI tool (ChatGPT, Gemini), it may be used for training. Know the difference.

**Don't use AI output without review for:**
- Legal documents or contracts
- Financial reports or tax filings
- Medical advice or diagnoses
- Public-facing statements or press releases
- Anything with compliance implications

An agent can draft all of these. A human must review all of these.

**Don't fight the agent.** If it's not producing what you want after 3 attempts, stop. Rethink your prompt. Maybe break the task into smaller pieces. Maybe the task isn't suited for AI.

**Don't treat every task as an AI task.** Sometimes a phone call is faster. Sometimes a spreadsheet formula is simpler. Sometimes you should just do it yourself. AI is a tool in your toolbox, not the only tool.

**Don't ignore the autonomy levels.** When an agent asks for approval, it's because the action has real consequences. Read the request. Understand what will happen. Then approve or deny. The 4-hour timeout exists to prevent stale approvals — if you miss it, the request expires safely.

**Don't paste confidential data into external AI tools.** Use the agents we've deployed for you. They run on your hardware. That's the whole point.

---

## Part 4: Understanding Your Agent Team

### The Roles

Your starter team has three agents:

**Primary** is your front desk. It handles incoming messages, figures out what needs to happen, and either does it or routes it to the right agent. Talk to Primary for most things.

**Engineer** is your technical specialist. It handles complex analysis, code, data processing, and anything that requires deep thinking. Primary will route to Engineer automatically when needed, or you can ask for Engineer directly.

**Dispatch** is your operations manager. It runs scheduled tasks, monitors health, manages logs, and handles automation. You'll rarely talk to Dispatch directly — it works in the background.

### How They Communicate

Agents talk to each other by leaving messages in each other's inboxes. You'll see this in the dashboard as "Team Activity." It's normal for agents to discuss a task before presenting you with a result.

### What Happens When Something Goes Wrong

Agents are designed to fail safely:

- If a service goes down, agents that depend on it stop and report the error
- If an agent can't complete a task, it escalates to the next agent in the chain
- If the chain reaches the top without resolution, you get a Slack notification
- No agent can spend money, send external messages, or change configuration without approval (L3)

---

## Part 5: Common Scenarios

### "I need to send a client update"

Tell Primary:
> "Draft an email to [client name] updating them on the project status. We completed the data migration yesterday. The API integration starts next week. Timeline is on track. Keep it professional but warm."

Review the draft. Edit if needed. Approve the send.

### "I have a document I need to understand"

Tell Primary:
> "I'm attaching our vendor contract. Summarize the key terms: payment schedule, termination clauses, SLAs, and any auto-renewal language. Flag anything unusual."

### "Something seems broken"

Check the dashboard first (Mission Control). If you see a red status:
> "The [service name] shows unhealthy. Diagnose the issue and tell me what's wrong before taking any action."

The agent will investigate and report back. It won't fix anything without your approval.

### "I want a recurring report"

Tell Primary:
> "Every Monday at 9 AM, compile a summary of last week's activity: tasks completed, pending items, and any flagged issues. Post it to the #weekly-updates Slack channel."

This becomes a scheduled trigger. It'll run automatically until you cancel it.

### "The agent got it wrong"

Don't start over. Tell it what's wrong:
> "The tone is too casual for this client. Also, the project timeline in paragraph 2 is wrong — it's Q3, not Q2. Revise."

Specific corrections get fixed in one pass. Vague complaints ("try again") waste time.

---

## Part 6: Privacy and Security

### Where Your Data Lives

Everything runs on your hardware. Your documents, emails, conversations, and agent memories stay on your machine. We don't have access to your content.

The only data that leaves your network:
- **API calls to AI models** (Anthropic, OpenAI) — these process your prompts and return responses. Both providers offer data retention policies. Ask us for details.
- **Health check-ins to CTG hub** (optional) — status and metadata only, never message content. This lets us monitor uptime and push updates.

### What We Can See

If you've enabled the Parent Relay (remote management):
- Which agents are running and their health status
- Service uptime and error counts
- Agent names and configurations

We cannot see:
- Your messages or conversations
- Your documents or files
- Your email content
- Your Slack messages
- Anything your agents produce

### API Keys

You provide your own API keys for AI models. These keys are stored encrypted and isolated — even your agents can't read them. They're accessed through a secure proxy (n8n) that makes the API call on the agent's behalf.

---

## Part 7: Vocabulary

| Term | What It Means |
|---|---|
| **Agent** | An AI worker with a specific role, model, and set of tools |
| **Model** | The AI brain (e.g., Claude Sonnet, GPT-4o-mini). Different models have different capabilities and costs |
| **Prompt** | The instruction you give to an agent |
| **Hallucination** | When an AI states something false with confidence |
| **Token** | The unit AI models use to measure text. ~750 words = ~1,000 tokens |
| **Context window** | How much text an agent can "remember" in a single conversation |
| **L1 / L2 / L3** | Autonomy levels: auto-silent, auto-notify, requires-approval |
| **Trigger** | A scheduled or event-driven action (cron job, webhook, file watcher) |
| **Paperclip** | The task management system that tracks agent work |
| **Lobster** | The workflow engine for multi-step automations |
| **QMD** | The knowledge search engine that indexes your documents |
| **Plaza** | The internal feed where agents share findings with each other |
| **SOP** | Standard Operating Procedure — pre-written instructions agents follow |
| **Inbox** | How agents send messages to each other (markdown files) |
| **Mission Control** | The dashboard where you monitor everything |
| **Parent Relay** | Optional sidecar that reports health status to CTG |

---

## Part 8: Quick Reference Card

### Talking to Your Agent

```
✓ "Summarize this contract in 5 bullet points, focusing on payment terms"
✗ "What does this say?"

✓ "Draft a reply declining this meeting. Suggest next Tuesday instead. Keep it brief."
✗ "Reply to this"

✓ "The third paragraph is too technical. Rewrite it for a non-technical audience."
✗ "Make it simpler"

✓ "Search our SOPs for the incident response procedure and walk me through it"
✗ "What do I do when something breaks?"
```

### Before You Send Agent Output

- [ ] Did I read the entire response?
- [ ] Are the facts correct?
- [ ] Are the numbers accurate?
- [ ] Is the tone appropriate for the audience?
- [ ] Would I put my name on this?

### When to Call a Human

- Legal or compliance decisions
- Anything involving money over $1,000
- External communications to executives or press
- When the agent says "I'm not sure" — it's being honest, listen to it
- When you've tried 3 prompts and the output is still wrong
- Security incidents or data breaches

---

## Getting Help

Your agents are monitored by CTG. If something isn't working:

1. Check Mission Control (your dashboard) for service health
2. Ask Primary: "Run a health check on all services and report back"
3. Contact CTG support — we can see your system health remotely and push fixes

You don't need to troubleshoot infrastructure. That's what we're here for.

---

*This guide was written by a human who works with AI agents every day. The AI helped draft it. The human verified every word.*
