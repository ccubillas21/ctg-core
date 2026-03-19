# AI Agent Use Cases Playbook
## From "Help me with my inbox" to "Build me a company"

**Cubillas Technology Group**
*A practical guide to what AI agents can do for your business — with exact prompts to get started*

---

## How This Guide Works

Each use case has:
- **What it does** — plain English explanation
- **Difficulty** — Beginner, Intermediate, or Advanced
- **Team needed** — which agents and how many
- **Setup prompt** — what to tell your tech lead (CTG) to configure
- **Daily prompts** — what you actually say to your agents
- **What to expect** — realistic outcomes, not hype

Use cases build on each other. Start at the top. Get comfortable. Then move down.

---

## Level 1: Beginner — "Be My Assistant"

These use cases work with your starter team (Primary, Engineer, Dispatch). No extra agents needed. No technical setup beyond the initial install.

---

### 1.1 Email Triage & Response

**What it does:** Your agent reads your inbox, sorts messages by urgency, drafts replies, and flags anything that needs your personal attention. You review and approve — it sends.

**Team needed:** Primary (starter agent)

**Setup prompt to CTG:**
> "Connect my Gmail/Outlook to the Primary agent. Set it to scan every 15 minutes. Flag anything from [list key contacts] as high priority. Auto-archive newsletters and marketing emails."

**Daily prompts:**

```
"Show me today's inbox summary — what's urgent, what's waiting, what you archived"

"Draft a reply to the email from [name]. Accept the meeting but suggest Thursday
instead of Wednesday. Keep it short."

"Find every email from [vendor name] in the last 30 days that mentions pricing
or invoices. Summarize what they're charging us."

"I'm going on vacation for a week. Set up auto-responses:
  - Clients: 'I'm out until [date], contact [backup] for urgent matters'
  - Internal: 'Back [date], not checking email'
  - Vendors: auto-archive, I'll handle when I'm back"
```

**What to expect:** 80-90% of routine emails handled without you. You'll spend 15 minutes reviewing drafts instead of 2 hours managing your inbox. The agent gets better as it learns your style — correct it early and often.

---

### 1.2 Calendar Management

**What it does:** Your agent manages your schedule — books meetings, resolves conflicts, sends reminders, and protects your focus time.

**Team needed:** Primary (starter agent)

**Setup prompt to CTG:**
> "Connect my Google Calendar / Outlook Calendar to Primary. Set my working hours as [times]. Block [days/times] as focus time — no meetings. Always keep 30 minutes between back-to-back meetings."

**Daily prompts:**

```
"What's on my calendar today? Flag any conflicts."

"Schedule a 30-minute call with [name] sometime this week. They're in Pacific time.
Send them 3 options."

"Move all my Thursday afternoon meetings to Friday. Send apologies with the
new times."

"Block every Monday morning from 9-12 as 'Strategic Planning' — recurring,
no exceptions. If someone tries to book over it, decline automatically and
suggest afternoon slots."

"I need to meet with the whole team next week. Find a 1-hour slot where
everyone is free. If there isn't one, show me the least-conflict option."
```

**What to expect:** No more double-bookings. No more back-and-forth emails finding meeting times. Your focus blocks actually stay protected.

---

### 1.3 File Organization & Cleanup

**What it does:** Your agent scans your files, identifies duplicates, organizes by category, and creates a searchable structure. It can also monitor folders and auto-file new documents.

**Team needed:** Primary + Dispatch

**Setup prompt to CTG:**
> "Give Dispatch access to my Documents, Downloads, and Desktop folders. I want it to scan for duplicates and organize files into a clean folder structure. Nothing gets deleted without my approval."

**Daily prompts:**

```
"Scan my Downloads folder. Show me everything older than 30 days, grouped by
file type. What can we archive or delete?"

"Find every PDF in my Documents folder that mentions 'invoice' or 'receipt'.
Move them to a folder called 'Financial/Invoices/2026' organized by month."

"I have 6 copies of the same presentation in different folders. Show me which
is the latest version and where the duplicates are."

"Set up auto-filing: any PDF that lands in Downloads gets moved to Documents/Inbox.
Any screenshot goes to Documents/Screenshots/[month]. Run this every hour."

"Search all my files for anything containing [client name]. Give me a list with
file paths and last modified dates."
```

**What to expect:** A clean file system within a day. Ongoing maintenance runs automatically. You'll find files in seconds instead of digging through folders.

---

### 1.4 Meeting Notes & Action Items

**What it does:** Give your agent a meeting recording or transcript and it extracts notes, decisions, action items, and deadlines — then follows up on them.

**Team needed:** Primary

**Daily prompts:**

```
"Here's the transcript from today's team meeting. Give me:
  1. Key decisions made
  2. Action items with who's responsible and deadline
  3. Open questions that need answers
  4. A 3-sentence summary I can email to the team"

"Check last week's action items from the Monday standup. Which ones are overdue?
Draft follow-up messages to the owners."

"Compare this week's meeting notes with last week's. What topics carried over?
What's new? Are we making progress or going in circles?"
```

---

### 1.5 Research & Summarization

**What it does:** Your agent reads long documents, articles, reports, or websites and gives you the key points. Ask questions, get answers with references.

**Team needed:** Primary (simple research) or Primary + Engineer (deep analysis)

**Daily prompts:**

```
"Read this 40-page report and give me a 1-page executive summary. Focus on
financial implications and recommended actions."

"I need to understand [topic]. Find and summarize the 5 most important things
a business owner should know. No jargon."

"Compare these three vendor proposals side by side. Create a table: pricing,
features, contract terms, SLA guarantees, and your recommendation."

"Read our employee handbook and find every policy related to remote work.
Are there any contradictions or gaps?"
```

**What to expect:** 50-page documents distilled to 1 page in under a minute. Comparisons that would take hours done in seconds. Always verify specific claims — agents occasionally hallucinate details.

---

## Level 2: Intermediate — "Run My Operations"

These use cases need additional agents or integrations. Tell CTG what you need and we'll configure it.

---

### 2.1 Customer Support Triage

**What it does:** A dedicated agent monitors your support channels, classifies tickets by urgency and type, drafts responses for common issues, and escalates complex ones to your team.

**Team needed:** Primary + a new Support Agent (GPT-4o-mini, ~$1/mo)

**Setup prompt to CTG:**
> "Add a Support Agent to my team. Connect it to our [Zendesk/Freshdesk/email inbox/Slack channel]. Train it on our FAQ and knowledge base. L2 autonomy — it drafts responses but notifies me before sending. Anything involving refunds, legal, or angry customers escalates to me directly."

**Daily prompts to Primary:**

```
"How many support tickets came in today? Break down by category and urgency."

"Show me the Support Agent's drafted responses for today. I'll approve or edit."

"What are the top 5 most common questions this week? Draft FAQ entries for each."

"The Support Agent keeps getting [specific question] wrong. Here's the correct
answer: [details]. Update its knowledge base."
```

**What to expect:** 60-70% of support tickets handled automatically (drafts for your review). Response time drops from hours to minutes. Your team handles only the complex cases.

---

### 2.2 Social Media & Content Management

**What it does:** Your agent drafts social media posts, schedules content, monitors mentions, and maintains a content calendar. You approve everything before it goes live.

**Team needed:** Primary + a new Content Agent

**Setup prompt to CTG:**
> "Add a Content Agent. Connect it to our social accounts [list platforms]. Give it our brand voice guidelines: [describe tone, style, things to avoid]. L3 autonomy — nothing gets posted without my explicit approval."

**Daily prompts:**

```
"Draft this week's social media calendar. 3 posts for LinkedIn, 5 for Twitter,
2 for Instagram. Theme: [topic]. Tone: professional but approachable."

"Here's a blog post we published yesterday. Create 10 social media snippets
from it — different angles, different platforms."

"Monitor mentions of [company name] and [competitor names] across social media.
Daily digest at 8 AM: what people are saying, sentiment, anything we should
respond to."

"Our product launch is March 25. Create a 2-week content countdown:
teaser posts, announcement day content, follow-up posts. Include suggested
images descriptions for each."
```

---

### 2.3 Bookkeeping & Expense Tracking

**What it does:** Your agent processes receipts, categorizes expenses, reconciles accounts, flags anomalies, and prepares reports for your accountant.

**Team needed:** Primary + a new Finance Agent (Sonnet recommended for accuracy)

**Setup prompt to CTG:**
> "Add a Finance Agent using Claude Sonnet. Connect it to [QuickBooks/Xero/bank feed]. Give it read access to financial accounts and write access to expense categories only. L3 autonomy for everything — every action needs my approval. This is financial data, no auto-pilot."

**Daily prompts:**

```
"Process these 15 receipts. Categorize each expense, flag anything over $500,
and enter them into [accounting system]."

"Show me this month's spending by category. Compare to last month.
Highlight anything that increased more than 20%."

"Reconcile our bank statement with QuickBooks for February. Show me any
discrepancies."

"Pull together everything my accountant needs for quarterly taxes:
revenue summary, expense categories, outstanding invoices, and estimated
tax liability based on last quarter's rate."

"Flag any recurring subscription charges. List them all with amount, frequency,
and when they renew. Which ones haven't we used in 90 days?"
```

**What to expect:** Bookkeeping that used to take 10 hours/week done in 1 hour (your review time). Zero data entry errors. Your accountant gets clean, organized data instead of a shoebox of receipts.

**Important:** Always have your accountant or financial advisor verify AI-prepared financial documents before filing anything.

---

### 2.4 HR & Recruitment Pipeline

**What it does:** Your agent screens resumes, schedules interviews, drafts offer letters, manages onboarding checklists, and handles routine HR inquiries.

**Team needed:** Primary + a new HR Agent

**Setup prompt to CTG:**
> "Add an HR Agent. Connect it to our [ATS/job board/email]. Load our job descriptions, company policies, and benefits information. L2 for screening and scheduling, L3 for any candidate communication."

**Daily prompts:**

```
"We received 45 applications for the [role] position. Screen them against these
requirements: [list must-haves and nice-to-haves]. Rank the top 10 with a
1-paragraph summary of each."

"Schedule first-round interviews for the top 5 candidates. 30 minutes each,
this week or next. Send calendar invites with our standard interview prep email."

"Draft an offer letter for [candidate name]. Position: [title]. Salary: [amount].
Start date: [date]. Use our standard template but customize the intro paragraph."

"[New hire] starts Monday. Generate their onboarding checklist: equipment,
accounts to create, training sessions to schedule, people to meet in week 1."
```

---

### 2.5 Project Management & Task Tracking

**What it does:** Your agent monitors project progress, updates task boards, sends status reminders, flags blockers, and generates weekly reports.

**Team needed:** Primary + Dispatch

**Setup prompt to CTG:**
> "Connect Dispatch to our [Asana/Monday/Trello/Jira]. Give it read/write access to project boards. L2 autonomy — it can update task statuses and send reminders, but notifies me for any scope changes."

**Daily prompts:**

```
"Give me a status report on [project name]: what's done, what's in progress,
what's blocked, and what's due this week."

"Every Friday at 4 PM, send each team member a summary of their open tasks
for next week with deadlines highlighted."

"Track time estimates vs actuals on [project]. Are we on track? If not, which
tasks took longer than expected and by how much?"

"We need to shift the [project] deadline from April 15 to April 30.
Recalculate the timeline: move all dependent tasks proportionally.
Show me the new schedule before updating the board."
```

---

## Level 3: Advanced — "Scale My Business"

These use cases involve multiple specialized agents working together, external data sources, and complex workflows. This is where the platform really shines.

---

### 3.1 Financial Planning & Analysis

**What it does:** A dedicated finance team analyzes your revenue, expenses, cash flow, and growth scenarios. Generates forecasts, models what-if scenarios, and alerts you to financial risks.

**Team needed:** Finance Agent (Sonnet) + Data Agent (GPT-4o-mini) + Engineer for complex modeling

**Setup prompt to CTG:**
> "Build me a finance team. Finance Agent on Claude Sonnet for accuracy. Data Agent on GPT-4o-mini for data processing. Connect to [accounting software, bank feeds, payment processor]. Engineer available for complex financial models. L3 on all external actions. Daily cash flow report at 7 AM."

**Prompts:**

```
"Build a 12-month revenue forecast based on our last 24 months of data.
Show three scenarios: conservative (current growth rate), moderate (+20%),
and aggressive (+40%). Include monthly burn rate and runway for each."

"Model this scenario: if we hire 3 people at $80K average salary starting in
June, and our revenue grows at current rate, when do we need to raise prices
or cut costs? Show the cash flow impact month by month."

"Analyze our pricing. Compare our margins on each product/service line.
Which ones make money? Which ones are loss leaders? Are any of them not
worth keeping?"

"We're considering a $50K equipment purchase vs leasing at $2K/month.
Model both options over 3 years including tax implications, cash flow impact,
and break-even point."

"Set up a weekly financial health alert:
  - Notify me if cash drops below $[amount]
  - Flag any single expense over $[amount]
  - Alert if AR aging exceeds 60 days on any invoice
  - Monthly trend on revenue vs last year"
```

**What to expect:** CFO-level insights without a CFO salary. Models that would take a consultant days done in minutes. Always have your accountant validate forecasts before making major financial decisions.

---

### 3.2 Stock Portfolio Management & Market Intelligence

**What it does:** An agent team monitors your portfolio, tracks market signals, runs technical and fundamental analysis, sends alerts on significant moves, and models portfolio adjustments before you execute them.

**Team needed:** Market Analyst (Sonnet) + Research Agent (GPT-4o-mini) + Data Agent

**Setup prompt to CTG:**
> "Build a market intelligence team. Market Analyst on Sonnet for analysis quality. Research Agent for news and SEC filing monitoring. Data Agent for price feeds and technical indicators. Connect to [broker API — read only]. Morning market brief at 6:30 AM. Alert me on any holding that moves more than 3% intraday. L3 on everything — this team NEVER executes trades."

**Critical rule: AI agents NEVER execute trades. They analyze, recommend, and model. You decide and execute.**

**Prompts:**

```
"Give me this morning's market brief: overnight futures, pre-market movers in my
portfolio, any earnings announcements today, and macro events to watch."

"Analyze [ticker] — full workup:
  - Fundamentals: PE, revenue growth, debt/equity, free cash flow
  - Technicals: support/resistance levels, RSI, MACD, volume trends
  - Recent news and sentiment
  - Your assessment: bull case, bear case, and what I should watch for"

"I'm considering adding [ticker] to my portfolio at $[price]. Model the impact:
  - What percentage would it represent?
  - How does it change my sector allocation?
  - Does it overlap with existing holdings?
  - What's my total tech/energy/financials exposure after?"

"Backtest this strategy over the last 5 years: buy when RSI drops below 30,
sell when it crosses 70. Apply it to my current holdings. Show win rate,
average return, max drawdown."

"Monitor these 10 stocks for the following signals and alert me immediately:
  - Insider buying over $100K
  - Earnings estimate revisions (up or down more than 5%)
  - Unusual options activity
  - Breaking news from major outlets
  Format each alert as: ticker, signal, data, why it matters"

"Compare my portfolio performance YTD against the S&P 500 and the Nasdaq.
Which holdings are outperforming? Which are dragging? If I had to cut 2 positions
today, which would you recommend and why?"
```

**What to expect:** Professional-grade market intelligence for the cost of a streaming subscription. Faster reaction to market events. Better-informed decisions. Remember: the agent analyzes, YOU trade. Never automate trade execution through AI.

---

### 3.3 Heavy Research & Competitive Intelligence

**What it does:** An agent team conducts deep research — market analysis, competitor tracking, patent searches, academic literature, regulatory monitoring — and delivers structured reports.

**Team needed:** Research Agent (Knox template) + Primary for routing + Engineer for deep analysis

**Setup prompt to CTG:**
> "Set up a research team using the Knox Harrington template. Research Agent scans [industry news sources, competitor websites, patent databases, regulatory filings]. Daily scan at 6 AM. Weekly deep-dive report every Monday. Alert me immediately on competitor product launches, pricing changes, or key hires."

**Prompts:**

```
"Competitive landscape report on [industry/market]: who are the top 5 players,
what's their market share, pricing model, recent moves, and where are they
heading? Include a SWOT for each."

"Track [competitor name] across all public channels: website changes, job
postings, press releases, patent filings, social media. Weekly digest of
everything they're doing."

"Research [emerging technology/trend]. I need:
  - Current state of the technology
  - Key players and their approaches
  - Timeline for mainstream adoption
  - How it could affect our business (threats and opportunities)
  - What we should do about it in the next 6 months"

"Find every regulation that affects [our industry] that was proposed or enacted
in the last 12 months. Summarize each one: what it requires, who it affects,
compliance deadline, and estimated cost to comply."

"Set up standing research orders:
  - Daily: [competitor] news and social media monitoring
  - Weekly: industry news digest with trend analysis
  - Monthly: patent filing scan in [technology area]
  - Quarterly: market size and growth rate update for [our market]"
```

---

### 3.4 DevOps & Infrastructure Management

**What it does:** An agent team monitors your servers, deploys code, manages CI/CD pipelines, responds to incidents, and keeps your infrastructure healthy.

**Team needed:** SRE Agent (Smokey template) + Container Agent (Brandt template) + Engineer for architecture

**Setup prompt to CTG:**
> "Build a DevOps team. SRE Agent on GPT-4o-mini for monitoring and alerting. Container Agent for Docker/Kubernetes management. Engineer on Opus for architecture decisions and incident response. Connect to [GitHub, AWS/Azure/GCP, monitoring tools]. L1 for health checks, L2 for routine deployments, L3 for production changes and incident response."

**Prompts:**

```
"Set up monitoring for all our services:
  - Check every endpoint every 60 seconds
  - Alert on Slack if response time exceeds 2 seconds
  - Page me if any service is down for more than 5 minutes
  - Daily uptime report at midnight"

"Our staging environment should mirror production. Audit the differences:
versions, environment variables, resource allocation, network rules.
Give me a list of everything that doesn't match."

"We need to deploy version [x.y.z] to production:
  - Run the test suite first
  - If all pass, deploy to staging
  - Run smoke tests on staging
  - If staging is green, show me the deploy plan for production
  - Wait for my approval before touching production"

"Review our AWS bill for last month. Break down by service. Which resources
are underutilized? Estimate savings if we right-size. Don't change anything —
just show me the analysis."

"Post-incident review: the API went down at 3:47 PM for 12 minutes.
Pull the logs, reconstruct the timeline, identify root cause, and draft a
post-mortem with action items to prevent recurrence."

"Create a disaster recovery runbook for our stack:
  - What to do if the database goes down
  - What to do if we lose the primary region
  - How to restore from backup
  - Expected recovery time for each scenario
  Keep it simple enough that a junior dev could follow it at 3 AM."
```

---

### 3.5 Idea Curation & Mobile App Factory

**What it does:** A pipeline that takes raw ideas, validates them against market data, scores feasibility, generates specs, and produces working prototypes. From napkin sketch to testable app in days instead of months.

**Team needed:** Full team — Primary (intake) + Research Agent (validation) + Engineer (architecture + code) + Data Agent (market analysis) + a new Product Agent

**Setup prompt to CTG:**
> "Build me an idea-to-prototype pipeline. Product Agent on Sonnet for product thinking. Research Agent for market validation. Engineer on Opus for architecture and code generation. Connect the idea-reality scoring system. When I submit an idea, run it through the full pipeline automatically: score it, validate it, spec it, then wait for my go/no-go before prototyping."

**Prompts:**

```
STAGE 1 — IDEA SUBMISSION:
"New app idea: [describe the concept in plain English]. Target user: [who].
Problem it solves: [what pain point]. Run it through the pipeline."

STAGE 2 — VALIDATION (automatic, agents handle this):
The pipeline will return:
  - Idea-Reality Score (0-100)
  - Market analysis: existing competitors, market size, gaps
  - Technical feasibility assessment
  - Estimated development cost and timeline
  - Go / Differentiate / Stop recommendation

STAGE 3 — IF GO:
"Green light on [app name]. Generate the full spec:
  - User stories (prioritized)
  - Screen-by-screen wireframe descriptions
  - Data model
  - API endpoints needed
  - Third-party services required
  - MVP scope (what's in v1 vs later)"

STAGE 4 — PROTOTYPE:
"Build the MVP for [app name]:
  - React Native for cross-platform
  - Use [Firebase/Supabase] for backend
  - Implement the top 5 user stories only
  - Push to a test repo
  - Deploy to TestFlight/Play Console internal testing"

STAGE 5 — ITERATE:
"I tested the [app name] prototype. Feedback:
  - [Screen X] is confusing — simplify the flow
  - Add [feature] — users expect this
  - Remove [feature] — nobody used it in testing
  - Performance is slow on [screen] — optimize
  Implement these changes and push a new build."
```

**Full pipeline example — end to end:**

```
"I have an idea for a restaurant app. Not reviews — I want something that
tracks what I've ordered at every restaurant I visit, rates my own meals,
and recommends what to try next based on my taste profile. The social angle
is sharing your personal food journey, not restaurant ratings.

Run this through the pipeline. I want to know:
  1. Does anything like this exist?
  2. Would people actually use it?
  3. What's the minimum viable version?
  4. How much would it cost to build and launch?
  5. If the answer to 1-4 looks good, build me a prototype."
```

**What to expect:** You can go from idea to testable prototype in 3-5 days instead of 3-5 months. The validation stage kills bad ideas early (saving thousands in wasted development). The pipeline learns from your feedback — rejected ideas inform future scoring. Not every idea should be built. The pipeline's job is to tell you which ones are worth your time.

---

### 3.6 Accounting & Tax Preparation

**What it does:** A specialized team handles chart of accounts management, monthly close procedures, tax document preparation, audit trails, and regulatory compliance tracking.

**Team needed:** Finance Agent (Sonnet — high accuracy required) + Data Agent + Dispatch for automation

**Setup prompt to CTG:**
> "Build an accounting team. Finance Agent on Sonnet — this needs to be the most accurate model available. Data Agent for processing. Dispatch for scheduled tasks. Connect to [QuickBooks/Xero/NetSuite]. Monthly close automation on the 1st of each month. L3 on everything — no financial action without my approval. Maintain complete audit trail on all entries."

**Prompts:**

```
"Run the monthly close process for [month]:
  1. Reconcile all bank accounts
  2. Review and post all pending journal entries
  3. Run accounts receivable aging
  4. Run accounts payable aging
  5. Generate P&L, Balance Sheet, and Cash Flow Statement
  6. Flag any anomalies or misclassified entries
  Show me the results before finalizing."

"We need to prepare for the Q1 tax filing:
  - Compile all revenue by category
  - Compile all deductible expenses with receipts
  - Calculate estimated tax liability
  - List any carryforward credits or losses
  - Generate the document package my CPA needs
  Do NOT file anything — this is prep only."

"Audit trail request: show me every transaction over $5,000 in the last
quarter with: date, amount, vendor/customer, category, who approved it,
and supporting documentation."

"We received an invoice from [vendor] for $12,000 but our PO was for $9,500.
Flag this discrepancy. Pull the original PO, the contract terms, and any
change orders. Draft a query email to the vendor."

"Set up these automated checks — run daily at 7 AM:
  - Any duplicate payments in the last 24 hours
  - Invoices approaching payment deadline (5 days out)
  - Bank balance below $[threshold]
  - Revenue recognition entries that need review"
```

**Important:** AI-prepared financial documents must always be reviewed by a qualified accountant or CPA before filing. The agent does the heavy lifting — the professional does the verification.

---

### 3.7 Legal Document Review & Contract Management

**What it does:** An agent reviews contracts, tracks obligations and deadlines, flags risk clauses, compares terms across agreements, and maintains a contract repository.

**Team needed:** Primary + Engineer (for deep document analysis)

**Setup prompt to CTG:**
> "Configure Engineer for legal document review. Load our standard contract templates and terms we always require. L3 on all external communications. This agent reviews — it does not negotiate or sign anything."

**Prompts:**

```
"Review this vendor contract and give me:
  - Summary of key terms (1 page max)
  - Payment obligations and schedule
  - Termination clause and notice period
  - Auto-renewal terms (if any)
  - Liability caps and indemnification
  - Non-compete or exclusivity restrictions
  - Red flags: anything unusual, one-sided, or that deviates from market standard"

"Compare these two proposals from [Vendor A] and [Vendor B]. Side-by-side table
of: pricing, SLA guarantees, data handling, exit terms, and total cost of
ownership over 3 years."

"Track all our active contracts. I need a dashboard showing:
  - Contract name, vendor, value, start/end dates
  - Days until renewal or expiration
  - Alert me 90 days before any auto-renewal
  - Which contracts are month-to-month vs locked in"

"We need to update our standard NDA. Add a clause covering AI-generated work
product. Draft the clause — I'll have legal review it."
```

**Important:** AI can review and flag — but a qualified attorney must make final determinations on legal documents. Use agents to do the first pass, not the final pass.

---

## Level 4: Expert — "Build Me a Machine"

These use cases combine multiple agent teams into autonomous pipelines. This is the full power of the platform.

---

### 4.1 Business Intelligence Command Center

**What it does:** A unified dashboard fed by multiple agent teams — finance, operations, market, and customer data all in one view. Automated daily briefings, anomaly detection, and strategic recommendations.

**Setup prompt to CTG:**
> "Build a BI command center. I want a morning brief at 7 AM covering: financial health, operational metrics, customer sentiment, market movement, and competitor activity. Use the AIMEE dashboard template. Anomaly detection on all metrics — alert me when anything deviates more than 2 standard deviations from the 30-day average."

**What the morning brief looks like:**

```
DAILY BRIEF — March 19, 2026

FINANCIAL
  Revenue (MTD): $47,200 (+8% vs last month pace)
  Cash position: $182,400
  AR aging: 3 invoices past 60 days ($12,100 total) ⚠️
  Burn rate: $38,000/mo

OPERATIONS
  Support tickets (yesterday): 23 resolved, 4 escalated, 1 critical open
  System uptime: 99.97%
  Deploy: v2.4.1 shipped to production at 3:12 PM, no issues

MARKET
  [Competitor A]: launched new pricing tier (see analysis)
  [Your sector] index: +1.2%
  3 regulatory updates flagged for review

CUSTOMER
  NPS (7-day rolling): 72 (+3)
  Churn risk: 2 accounts flagged (see details)
  Feature requests trending: [topic] mentioned 8 times this week

RECOMMENDATIONS
  1. Follow up on $12,100 AR aging — draft collection emails attached
  2. [Competitor A] pricing undercuts us on mid-tier — review attached analysis
  3. Consider [feature] — customer demand is consistent
```

---

### 4.2 Multi-Brand / Multi-Client Management

**What it does:** If you manage multiple businesses, brands, or clients, each one gets its own agent team with isolated data. A parent dashboard gives you the bird's-eye view.

**Setup prompt to CTG:**
> "I manage 3 businesses: [list them]. Each needs its own agent team. Set up the parent hub so I can see all three from one dashboard. Each team operates independently but I get a unified daily brief covering all three."

**This is exactly what CTG Core is built for.** Each client gets an independent stack. The Parent Relay reports health back to your hub. You manage them all from one place.

---

### 4.3 Full Autonomous Operations

**What it does:** The endgame. Your agent team handles day-to-day operations autonomously within defined boundaries. You focus on strategy and decisions. The team handles execution, reporting, and escalation.

**What this looks like in practice:**

- **7:00 AM** — Morning brief lands in your Slack with everything you need to know
- **Throughout the day** — Agents handle email, scheduling, support tickets, file management, bookkeeping, and monitoring without your involvement
- **As needed** — L3 approvals pop up in Slack for anything that needs your judgment. You tap Approve or Deny
- **5:00 PM** — End-of-day summary: what happened, what's pending, what needs your attention tomorrow

**You're the CEO. They're the staff.** You set the strategy, they execute. You make the decisions, they do the work. You review the output, they handle the details.

---

## Getting Started Checklist

### Week 1: Foundation
- [ ] Starter agents installed and connected
- [ ] Email connected to Primary
- [ ] Calendar connected to Primary
- [ ] Slack workspace set up with agent channels
- [ ] Practice: send 5 tasks to Primary, review the results, learn to give feedback

### Week 2: Comfort
- [ ] Daily inbox triage running automatically
- [ ] Calendar management active
- [ ] File organization complete
- [ ] You've corrected the agent at least 10 times (this is how it learns your style)

### Week 3: Expansion
- [ ] First additional agent added (your biggest pain point)
- [ ] First automated workflow running (daily report, recurring scan, etc.)
- [ ] You're spending less time on admin and more time on real work

### Month 2+: Scale
- [ ] Multiple agents working together
- [ ] Morning briefs active
- [ ] Financial or operational workflows automated
- [ ] You barely think about email anymore

---

## The Most Important Rule

**AI agents multiply your capability, but they don't replace your judgment.**

Every output gets reviewed. Every decision is yours. Every action with real-world consequences needs your approval. The agents handle the 80% that's routine so you can focus on the 20% that matters.

Start simple. Get comfortable. Then scale.

---

*Your agents are ready. What would you like them to do first?*
