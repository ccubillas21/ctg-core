# CTG Showcase Site v2 — Design Spec

**Date:** 2026-03-17
**Author:** Charlie Cubillas (CEO, Cubillas Technology Group)
**Status:** Approved
**Supersedes:** 2026-03-17-ctg-showcase-site-design.md

---

## Purpose

A single-page interactive site that serves multiple audiences from a single URL (cubillastechnologygroup.com):

1. **Charlie's vision board** — clarity on the product, business model, and market opportunity
2. **Investor/first client pitch** — the friend/investor sees the tech, the team, the numbers, and the opportunity
3. **Casual pitch tool** — people Charlie meets (kids' birthday parties, networking) can see what he's building
4. **Future clients and investors** — transparent, confident presentation of AIMEE as a real business

Charlie is not afraid of transparency. Margins are visible. The model is open. The confidence is in execution, not secrecy.

## Audience

Business-minded people ranging from a managed services professional (investor friend) to Charlie's wife to someone he meets casually. Must be impressive without requiring technical knowledge, but reward curiosity with depth via expandable detail.

## Tone

"Start with Why" (Simon Sinek influence). Lead with the impact, not the tech. Proud of what's built, transparent about the business, confident about the opportunity. Not a sales page — a war room that happens to be shareable.

## Design System

Unchanged from v1 — matches AIMEE Mission Control aesthetic:

- **Background:** `#f8fafc` (slate-50)
- **Cards:** `#ffffff` with `border: 1px solid #e2e8f0`, `border-radius: 12px`, `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`
- **Accent:** `#4F46E5` (indigo-600), light variant `#EEF2FF`
- **Text:** `#0f172a` primary, `#64748b` secondary, `#94a3b8` muted
- **Font:** System stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`)
- **Layer colors (CSS variables):**
  - `--layer-paperclip`: `#4F46E5` / light `#EEF2FF` (indigo)
  - `--layer-openclaw`: `#059669` / light `#ECFDF5` (emerald)
  - `--layer-lobster`: `#D97706` / light `#FFFBEB` (amber)
  - `--layer-qmd`: `#DB2777` / light `#FDF2F8` (pink)
- **Department colors:**
  - Operations: `#059669` (emerald)
  - Engineering: `#4F46E5` (indigo)
  - PMO: `#D97706` (amber)
  - Support: `#DB2777` (pink)

## Icons

- **Lucide Icons** via CDN (`https://unpkg.com/lucide@latest`) — clean, minimal line icons
- Paperclip: `clipboard-list`, OpenClaw: `bot`, QMD: `brain`
- **Lobster keeps 🦞** — the one emoji that stays
- Icons are placeholders for future custom branding
- Same icon mapping used in both Section ① (platform overview) and Section ② (stack layers)
- Lucide CDN fallback: if CDN fails, degrade gracefully to text labels (no broken UI)

## Layout

### Sidebar (fixed, left, 220px)
- CTG logo + "AI Operations Platform" subtitle
- Sections ①–⑦ navigation with scroll tracking
- **Live service links** at bottom (separated by divider):
  - Mission Control → `https://mc.cubillastechnologygroup.com`
  - Paperclip → `https://paperclip.cubillastechnologygroup.com`
  - Gateway → `https://gateway.cubillastechnologygroup.com`
  - Hub → `https://hub.cubillastechnologygroup.com`
- Progress bar at bottom (shows "X of 7" based on scroll position)

### Content Area (scrollable, right)
- Smooth scroll between sections, sidebar updates on scroll
- All sections use consistent inline expand/accordion interaction

### Responsive Behavior
- Desktop-first (1024px+)
- Below 900px: sidebar collapses to horizontal top nav, service links hidden (hamburger menu deferred to a later iteration)
- Below 600px: grids stack single-column

## Global Interaction Pattern

**Inline expand/accordion** used everywhere. One pattern, consistent behavior:
- Click to expand, click again to collapse
- Only one item expanded per group (accordion)
- 300ms slide transition
- Expanded content pushes siblings down

**Dual-layer expand** (used in Architecture and Deployment):
- First expand: business-friendly plain English
- "Technical Details" toggle inside: ports, commands, endpoints
- Both layers collapse together on accordion close

## Sections

### ① The Vision — "Start with Why"

**Lead quote (styled as a callout block):**
> "Every company in the world today needs an OpenClaw strategy."
> — Jensen Huang, NVIDIA CEO · GTC, March 16, 2026

**Context paragraph (simple language):**
OpenClaw is an open-source agentic AI framework that lets any computer run AI agents that think, plan, and act — not just answer questions. It's now the fastest-growing open-source project in history. The CEO of the company that powers most of the world's AI just told every business they need a strategy for this. AI agents can now handle real work: customer messages, schedules, reports, support tickets. The businesses that figure this out first win. The ones that don't get left behind.

**Note:** "OpenClaw" in the Jensen Huang quote refers to the open-source agentic AI framework. CTG's AIMEE stack uses OpenClaw as its Layer 2 agent engine — the product is built on the same technology Huang is calling essential.

**The gap:**
Most businesses don't have engineers to build this. Big consultancies charge $200K+. DIY tools assume technical expertise. There's nothing in the middle — until now.

**Why us:**
Charlie has spent his career in managed IT services — deploying, monitoring, and supporting tech for businesses without engineering teams. He's been using Power Automate desktop bots to drive sales for 2 years and is now combining that proven automated outreach with agentic AI to 10x its power. He built the entire AIMEE stack himself. This isn't a pitch deck — it's a working product from someone who understands both the tech and the service delivery model.

**Platform overview diagram:**
Horizontal 4-layer overview: Paperclip → OpenClaw → Lobster → QMD
- Lucide icons (🦞 for Lobster)
- Color-coded cards with matching borders
- Sub-labels: Org + Budget / Agents + Channels / Pipelines + Gates / Search + Context

### ② The Stack — "Four layers. One platform."

**Subtitle:** "Click any layer to see what it does and how it connects."

Vertical stack of 4 clickable layer cards. Accordion behavior — one layer expanded at a time.

**Icons:** Lucide `clipboard-list` (Paperclip), Lucide `bot` (OpenClaw), 🦞 (Lobster), Lucide `brain` (QMD)

**Expanded content per layer:**
- **Paperclip:** Agent Registry, Budget Gates, Task Tracking
- **OpenClaw:** Multi-Agent Engine, Channel Bindings, Model Router
- **Lobster:** Composable Pipelines, Approval Gates, Skill System
- **QMD:** Hybrid Search, Markdown Indexing, Context Retrieval

**Stats row:** 4 Layers | 100% Open Source | 1 cmd To Deploy | 24/7 Always On

### ③ The Team — "Meet the org chart."

**Subtitle:** "Click any role to explore the team."

**3-layer progressive disclosure:**

**Layer 1 — Curated Overview (default):**

```
        Charlie (CEO) — Human
              │
    ┌─────────┼──────────┐
    │         │          │
  Dude      Walter     Bonny
  (CGO)     (CTO)     (Jr Admin)
  Sonnet    Opus 4.6   Qwen 3.5+
  4 reports  16 reports
```

Each card shows: emoji, name, role, model, department color border. Dude and Walter show clickable "N reports ▾" badge. Bonny has no direct reports and is not expandable at Layer 2.

**Layer 2 — Department Expanded (click a department head):**

Inline expand below the clicked card. Content organized by sub-groups:

*Walter's Team (CTO Department):*

Vice Presidents (3-column grid):
- 🔮 Oracle — VP of AI/ML · Sonnet 4.6
- 🛡️ Sentinel — VP of Security · Sonnet 4.6
- 🐳 Docker VP — VP of Infrastructure · Sonnet 4.6
- 📡 Herald — VP of Telecoms · Sonnet 4.6
- 🧠 Axiom — VP of Platform Engineering · Opus 4.6
- ⚙️ Ops — VP of Platform Operations · Sonnet 4.6

Engineering Teams (2-column grid, grouped as pairs):
- 🪟 Azure Team — Architect + Engineer
- ☁️ GCP Team — Architect + Engineer
- 🌐 Web Team — Architect + Engineer
- 📱 App Team — Architect + Engineer

Specialists:
- 🪟 Windows — Host Operations
- 🐳 Docker — Container Specialist

*Dude's Team (Operations/PMO):*
- Scout — Product PM
- Maude — Delivery PM
- Donny — Client PM
- Atlas — VP of AI Resources · Sonnet 4.6

**Layer 3 — Agent Detail (click any individual):**

Inline expand within the grid showing:
- Large emoji + name + role badge
- Model name
- Reports to: [manager]
- One-line description of responsibilities
- Specialty tags (small pill badges)

Data sourced from IDENTITY.md / SOUL.md files, hardcoded into the page.

**Bottom note (italic, muted):** "This is CTG's live team — the organization that builds and manages client deployments."

**Department legend:** Operations (emerald), Engineering (indigo), PMO (amber), Support (pink)

### ④ Architecture — "Under the hood."

**Subtitle:** "Click any service to learn what it does."

Interactive service diagram. Same layout as v1 (two rows of connected service cards + channel connections) but every element is now clickable.

**Service cards (default view):**
- PostgreSQL (:5432)
- Paperclip (:13100)
- OpenClaw Gateway (:28789)
- Parent Relay (:19090)
- CTG Hub (:9100)
- Connection lines with labeled arrows (SQL, REST, WebSocket, Polling)
- Channels: Slack, Teams, Telegram branching off Gateway

**Click a service — Business-friendly expand:**
- **PostgreSQL:** "The database. Stores every task, every agent record, every audit trail. Your data stays on your infrastructure."
- **Paperclip:** "The company brain. Tracks who works here, what they're working on, and what they're allowed to spend."
- **OpenClaw Gateway:** "The workforce engine. Runs your AI agents and connects them to Slack, Teams, Telegram."
- **Parent Relay:** "The management bridge. Lets CTG monitor health and push updates without touching your data."
- **CTG Hub:** "Remote command center. Where CTG manages all client deployments from one place."

**"Technical Details" toggle (inside each expand):**
- Port numbers, health endpoints, Docker image, dependencies, connection protocols
- Container names, volume mounts, network configuration

**Bottom note:** "All services run in Docker on a single server. No client data leaves the client's infrastructure — only metadata and health status flow through the relay."

### ⑤ Deployment — "From zero to live in one command."

**Subtitle:** "Click any step to see what happens."

Horizontal 6-step flow with connecting arrows. Steps 1–3 show green checkmarks, steps 4–6 numbered.

**Each step expandable:**

1. **Copy CTG Core** → "We copy the AIMEE package to your server. 35 files, everything included — agents, workflows, SOPs, monitoring."
2. **Run setup.sh** → "Interactive setup wizard. Asks for your API keys, company name, and preferred agent names. Takes about 5 minutes."
3. **Services Start** → "Docker Compose brings up all 5 services. Database, task management, agent engine, dashboard, relay — all running in under 60 seconds."
4. **Connect Slack** → "Self-serve skill walks you through creating a Slack app and connecting it. Your agents appear in your workspace."
5. **Agents Go Live** → "Your 3 starter agents are online. Send them a message in Slack and they respond. That's it."
6. **Relay Phones Home** → "Parent Relay connects to CTG Hub. We can now monitor your deployment, push config updates, and support you remotely."

**"Technical Details" toggle (inside each expand):**
- Actual commands, file paths, Docker service names, health check URLs, expected output

### ⑥ The Product — "AI-Managed Employee Experience (AIMEE)"

Lead with the full expanded name. Let the acronym land.

**Three expandable tier cards:**

**Starter — $500/month** (featured/highlighted card)
- Default view: "3 AI agents, Slack integration, managed SOPs, monitoring, Mission Control dashboard"
- Expanded:
  - Full feature list:
    - 3 AI agents (Primary/Sonnet, Engineer/Opus, Dispatch/Haiku)
    - Slack integration with multi-account support
    - Mission Control dashboard
    - Managed SOPs (onboarding, daily ops, incident response)
    - Health monitoring and alerting
    - Remote management via Parent Relay
    - Weekly check-ins and optimization
  - Token allowances (per agent, monthly):
    - Dispatch (Haiku 4.5): 25M tokens
    - Primary (Sonnet 4.6): 8M tokens
    - Engineer (Opus 4.6): 750K tokens
  - Messaging: **"We include more than most businesses will ever need. If you outgrow your limits, there's flexibility — we'll work with you."**
  - Overage: "Additional usage billed at per-model rates."
  - Early adopter offer: "First 3 months at cost for early adopters — we invest in your success before we profit from it."

**Additional Agents — $50–$250/month each**
- Default view: "Scale your team. Price depends on the agent's role and model."
- Expanded — mini pricing table:
  - Jr Admin (Haiku / Qwen / Ollama local) — $50/mo — high-volume, low-complexity tasks
  - Specialist (Sonnet 4.6) — $150/mo — comms, triage, project management
  - Senior Developer (Opus 4.6) — $250/mo — deep work, architecture, code review
  - Token allowances per additional agent:
    - Jr Admin (Haiku/Qwen/Ollama): 20M tokens
    - Specialist (Sonnet 4.6): 5M tokens
    - Senior Developer (Opus 4.6): 600K tokens
  - Same generous limits messaging applies
  - Note: "Ollama-based agents run locally on your hardware at zero API cost"

**Custom / Enterprise — $150/hour**
- Default view: "Custom workflows, integrations, agent training, and advanced configurations."
- Expanded:
  - Bespoke workflow design and Lobster pipeline creation
  - Third-party integrations (CRM, ERP, custom APIs)
  - Agent personality training and SOP authorship
  - Dollar-based API spending caps: "For larger deployments, we offer dollar-based API budgets instead of token limits. Simpler to manage at scale, with full visibility in Mission Control. We'll scope a budget that fits your workload."

### ⑦ The Opportunity — "Why this is a real business."

**Subtitle:** "The numbers, the market, and the timing."

All content in expandable cards. Unit Economics visible by default; others collapsed.

**Unit Economics (visible by default):**

| Item | Monthly |
|---|---|
| Revenue (Starter) | $500 |
| API Cost | $50–150 |
| Infrastructure | ~$20 |
| Ops Time (~2 hrs at scale) | ~$50 |
| **Total Cost** | **$120–220** |
| **Gross Margin** | **55–75%** |

Note: "Early clients require more hands-on time (~5 hrs/month). Margins improve as templates and SOPs get reused across clients."

**Revenue Projections (expandable):**

| Timeline | Milestone | MRR |
|---|---|---|
| Month 1 | 3 clients (investor + 2 referrals) | $1,500 |
| Month 2 | 10 paying clients (network blitz + bot-assisted outreach) | $5,000 |
| Month 6 | Expand existing clients + additional agents | $8,000–12,000 |
| Month 12 | 20+ clients, vertical templates proven | $15,000–25,000 |

"$60K+ ARR by month 2. Bot-assisted outreach using the same AI platform we sell — AIMEE sells AIMEE."

**Why Now (expandable):**
- Jensen Huang just told every company they need an OpenClaw strategy (March 16, 2026)
- AI agents crossed the reliability threshold for real business tasks
- 3–6 month headstart before the market gets crowded
- Managed services professionals who've built teams and managed tech for businesses are the ones best positioned to package and deliver this
- Nobody is doing managed AI agent services for SMBs at this price point yet
- The demand is coming — the question is who's ready to supply it

**Market Potential (expandable):**
- AI agent market: ~$5B (2025) → $50B+ projected by 2030
- Gartner: 33% of enterprise software will include agentic AI by 2028
- SMB segment underserved — big consultancies priced out, DIY tools too complex
- Managed services model proven across IT ($300B+ market) — same playbook, new technology
- (Placeholder for updated stats as they become available)

**SWOT Analysis (expandable):**

| | |
|---|---|
| **Strengths** | Working product (not a prototype). Founder has managed services + automation background. 2 years of bot-assisted sales experience. Full stack built and deployed. |
| **Weaknesses** | Solo founder — bandwidth is the constraint. Early clients require more hands-on time. No brand recognition yet. |
| **Opportunities** | First mover in managed AI agents for SMBs. Investor's network as distribution channel. Vertical templates (recruiting, sales, ops) multiply revenue per client. Bot-assisted outreach scales without headcount. |
| **Threats** | Model provider dependency (mitigated by multi-provider architecture). Larger players could enter the SMB space. Client acquisition speed depends on network referrals converting. |

**News & Market Signals (expandable, roadmap item):**
- Styled as a "Roadmap" card — not "Coming soon" but "On the roadmap: automated market intelligence feed powered by AIMEE agents."
- Eventually: article summaries, links, dates. Updated manually or via a future agent-powered feed.
- Framed as a feature preview, not a gap — shows the platform's potential to serve its own business needs.

## Technical Implementation

### Stack
- Vanilla HTML/CSS/JS (no build step)
- Single `index.html` with all 7 sections
- `style.css` extending Mission Control's design system
- `app.js` for all interactions (accordion, 3-layer org chart, dual-layer expands, scroll tracking)
- **Lucide Icons** via CDN: `<script src="https://unpkg.com/lucide@latest"></script>`
- No other external dependencies

### Interaction System (app.js)
- Single accordion handler that works everywhere — pass a container selector and it manages expand/collapse
- 3-layer org chart: state machine tracking which layer is expanded, collapses children when parent collapses
- Dual-layer: nested accordion inside an accordion item, with a styled toggle button
- Scroll tracking: IntersectionObserver or scroll position for sidebar highlighting
- All interactions via CSS class toggling + JS event delegation

### Data
- Agent roster hardcoded from IDENTITY.md / SOUL.md files
- Financial projections hardcoded (updatable by editing HTML)
- News feed section is static placeholder for now

### File Structure
```
~/.openclaw/ctg-core/showcase/
├── index.html      # Single page with all 7 sections
├── style.css       # Design system + all section styles
└── app.js          # Accordion, org chart, dual-layer, scroll tracking
```

### Hosting
- Static files served behind `cubillastechnologygroup.com` via Cloudflare Tunnel
- No backend required

## Removed from v1

- Section ⑦ "Your Stack" — redundant with Product section
- Section ⑧ "Let's Go" — sales-page tone, not appropriate for a war room / vision board
- Sidebar "For You" navigation group — replaced with live service links
- Separate "What's Included" card — content folded into Product tier card expands
- Emoji icons (except 🦞) — replaced with Lucide library

## Success Criteria

1. Anyone can click through all 7 sections and understand the business in under 5 minutes
2. Investor friend sees the team, the tech, the numbers, and the opportunity — leaves wanting in
3. Casual acquaintance gets the elevator pitch from Section 1 alone
4. Charlie can open it as a vision board and see his entire business at a glance
5. Interactive elements reward curiosity without overwhelming the default view
6. Consistent interaction pattern (inline expand) throughout — no context switching
7. Loads instantly, no build step, single CDN dependency (Lucide)
8. Revenue projections: 10 paying clients within 60 days, $5,000 MRR, $60K+ ARR
