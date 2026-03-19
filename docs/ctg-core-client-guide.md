# Your Managed AI Team — Client Guide

**Provided by:** Cubillas Technology Group (CTG)

---

## Welcome

You have a small, dedicated AI team working for your company. Three agents — Aimee, CTO, and Jr — are live in your Slack workspace and ready to work. They handle email triage, research, technical analysis, writing, and operational tasks. CTG manages everything in the background: infrastructure, updates, security, and costs.

You talk to your team through Slack. That's it.

---

## Meet Your Team

### Aimee — Your Main Contact

Aimee is who you talk to first. She triages every request, routes work to the right team member, and brings back a clear answer. Think of her as your executive assistant and team lead in one. She's professional, warm, and won't let anything fall through the cracks.

**Best for:** General requests, task management, questions you're not sure who to ask.

### CTO — Your Technical Specialist

CTO handles the hard technical work. Code, architecture questions, debugging, system analysis, technical documentation. When you have a complex technical problem, Aimee routes it here. CTO is thorough, precise, and explains decisions so you can understand them even if you're not technical.

**Best for:** Code reviews, technical decisions, debugging, specifications, API questions.

### Jr — Your Admin Assistant

Jr handles high-volume admin work: email triage, web research, data gathering, document prep. Jr is efficient and methodical — great for work that needs to be done reliably at volume. All external content Jr processes goes through a security review before it ever reaches the rest of the team.

**Best for:** Email inbox triage, research tasks, pulling information together, routine admin.

---

## How to Interact

Each agent has its own Slack channel. There are also group channels where all three collaborate.

| Channel | Use it for |
|---------|-----------|
| `#aimee` | General requests, status updates, anything you're not sure where to send |
| `#cto` | Technical questions (or just ask Aimee to route it) |
| `#jr` | High-volume admin tasks, research queues |
| `#team` | Anything that benefits from the whole team seeing it |

You can always start with Aimee — she'll delegate to the right agent automatically.

---

## What Your Team Can Do

- **Email triage** — Process your inbox, surface action items, draft replies
- **Web research** — Gather information, summarize sources, compile findings
- **Technical analysis** — Review code, evaluate architecture, debug issues
- **Document work** — Write specs, draft documents, clean up drafts, format reports
- **Task tracking** — Create and track work items, follow up, close loops
- **Workflow automation** — Recurring tasks and email triggers run automatically

Your team can also spin up temporary assistants for specific tasks — these run in the background and disappear when the job is done.

---

## Security

Your AI team runs on your hardware, inside a secure, isolated environment. Here's what that means practically:

**Your data stays local.** Your agents run on a Mac Mini in your environment. Work stays in your workspace.

**CTG controls the keys.** API credentials for the AI models are held by CTG — you never see them, and they can't be leaked from your system because they're not stored there.

**External content is screened.** When Jr processes emails or web content, it goes through a security review pipeline before reaching anyone else on the team. This protects against malicious content embedded in emails or web pages.

**CTG vets every agent.** No new persistent agent joins your team without going through CTG's provisioning process: defined role, curated tool access, behavioral guidelines, and a risk review. This is what keeps the team trustworthy.

---

## Adding Capabilities

Your base team (Aimee, CTO, and Jr) covers a broad range of work. When a project could benefit from a specialist — say, a dedicated compliance reviewer, a data pipeline agent, or a domain-specific researcher — your team will tell you.

When that happens, Aimee will let you know and loop in CTG. CTG handles the process:

1. Defines the new agent's role and responsibilities
2. Sets up the Slack bot and channel
3. Configures tools and access appropriate for the role
4. Reviews for security and behavioral boundaries
5. Deploys and introduces the new team member to you

You don't need to manage any of this. You just tell us what you need.

---

## What CTG Handles

You don't need to think about any of the following:

- **Infrastructure** — The Docker stack, server health, uptime monitoring
- **Updates** — New capabilities and security patches deployed remotely
- **AI model costs** — Bundled into your service fee; no separate API accounts needed
- **Security** — Network isolation, content screening, credential management
- **Agent maintenance** — Soul updates, skill improvements, behavioral tuning

If something stops working, CTG is monitoring it and will either fix it automatically or reach out to you.

---

## Getting Help

If something isn't working as expected:

1. **Ask Aimee first** — she can often diagnose and resolve issues directly
2. **Contact CTG** — reach out via email or your dedicated support channel if Aimee is unavailable or the issue is with the infrastructure itself

CTG monitors your team's health continuously. For critical issues, you'll hear from us before you notice the problem.

---

*Cubillas Technology Group — cubillastechnologygroup.com*
