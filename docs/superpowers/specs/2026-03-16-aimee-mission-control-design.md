# AIMEE Mission Control — Dashboard Design

**Date:** 2026-03-16
**Author:** Charlie Cubillas (CEO, Cubillas Technology Group)
**Status:** Approved
**Context:** Investor demo MVP, will grow into multi-tenant client dashboard

---

## Overview

Single-page scrollable dashboard for managing AIMEE deployments. Clean SaaS visual style (light, card-based, like Linear/Vercel). Three sections: Health, Costs, Product Kanban. Hosted at `cubillastechnologygroup.com` behind auth.

**Primary user (v1):** Charlie — managing demos and deployments.
**Future user:** Clients see their own stack (tenant-scoped view).

---

## Visual Style

- **Light mode**, white/slate background, card-based layout
- Cards with subtle shadows (`box-shadow: 0 1px 3px rgba(0,0,0,0.08)`)
- Status indicators: green dots (healthy), red dots (down), yellow (degraded)
- Typography: system font stack, 14px base, semibold headers
- Accent color: `#4F46E5` (indigo, CTG brand)
- Responsive but desktop-first (investor sees it on a laptop)

---

## Layout

```
┌─────────────────────────────────────────────────────────┐
│  AIMEE ◆ Mission Control    [Paperclip] [Gateway] [Hub] │
│                                          Client ▼  [◎]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Services │ │ Agents   │ │ Uptime   │ │ Relay    │  │
│  │ 5/5  ●●● │ │ 3/3 ●●●  │ │ 99.9%    │ │ 2m ago   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
│  ── Cost Overview ──────────────────────────────────── │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Revenue: $500    Cost: $48    Margin: 90.4%       │ │
│  │  ┌─────────────────────────────────────────────┐   │ │
│  │  │  ▼ Per Agent                                │   │ │
│  │  │  Primary (Sonnet)  $12.40  ████░░  25%      │   │ │
│  │  │  Engineer (Opus)   $34.20  █████████░ 70%   │   │ │
│  │  │  Dispatch (Haiku)  $2.10   █░░░░░░░░░  4%   │   │ │
│  │  ├─────────────────────────────────────────────┤   │ │
│  │  │  ▼ Per Provider                             │   │ │
│  │  │  Anthropic   $38.50  ██████████░░  79%      │   │ │
│  │  │  Qwen        $6.20   ██░░░░░░░░░░  13%      │   │ │
│  │  │  MiniMax     $2.80   █░░░░░░░░░░░   6%      │   │ │
│  │  │  Google      $1.20   ░░░░░░░░░░░░   2%      │   │ │
│  │  │  OpenAI      $0.00   ░░░░░░░░░░░░   0%      │   │ │
│  │  │  Ollama      $0.00   ░░░░░░░░░░░░   0%      │   │ │
│  │  └─────────────────────────────────────────────┘   │ │
│  │  [7-day trend sparkline ~~~~~~]                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ── Product Board ──────────────────────────────────── │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────┐ │
│  │  PLANNED  │ │ BUILDING  │ │ TESTING   │ │DEPLOYED│ │
│  │           │ │           │ │           │ │        │ │
│  │ ┌───────┐ │ │ ┌───────┐ │ │           │ │┌──────┐│ │
│  │ │Sales  │ │ │ │Recruit│ │ │           │ ││AIMEE ││ │
│  │ │Templ. │ │ │ │Templ. │ │ │           │ ││Core  ││ │
│  │ │P2     │ │ │ │P1  🔵 │ │ │           │ ││v1.0  ││ │
│  │ └───────┘ │ │ └───────┘ │ │           │ │└──────┘│ │
│  │ ┌───────┐ │ │           │ │           │ │        │ │
│  │ │Client │ │ │           │ │           │ │        │ │
│  │ │#2 Dep │ │ │           │ │           │ │        │ │
│  │ └───────┘ │ │           │ │           │ │        │ │
│  └───────────┘ └───────────┘ └───────────┘ └────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Section 1: Header

| Element | Details |
|---|---|
| Logo | "AIMEE" + diamond icon + "Mission Control" subtitle |
| Quick links | Paperclip (`:13100`), Gateway (`:28789`), Hub API (`:9100`) — open in new tab |
| Client selector | Dropdown, defaults to current tenant. Multi-tenant ready. |
| User menu | Avatar circle, sign-out link |

---

## Section 2: Health Cards

Four cards in a row:

### Services Card
- Lists: Paperclip, Gateway, Parent Relay (3 services with HTTP health endpoints)
- Each with green/red/yellow dot
- PostgreSQL health is inferred from Paperclip being healthy (it depends on PG)
- Data source: relay `/status` endpoint (single call returns all service + agent data)

### Agents Card
- Lists all registered agents with status dot
- Shows: name, model tier, last activity timestamp
- Data source: Paperclip `/api/companies/:id/agents`

### Uptime Card
- Percentage uptime over last 24h (v1 — single period, no selector)
- Simple ring visualization
- Data source: Hub `GET /api/tenants/:id/health` returns latest check-in. For historical uptime, a new Hub endpoint (`GET /api/tenants/:id/checkins?since=`) would be needed — **v1 shows relay `checkinCount` and uptime from `process.uptime()` as a proxy**

### Relay Card
- Last check-in timestamp
- Connection status to parent hub
- Check-in count
- Data source: relay `/health` endpoint

---

## Section 3: Cost Overview

### Summary Row
Three large numbers: **Revenue** | **Total API Cost** | **Gross Margin %**

### Expandable: Per Agent Breakdown
| Agent | Model | Cost | % of Total | Bar |
|---|---|---|---|---|
| Primary | anthropic/claude-sonnet-4-6 | $12.40 | 25% | ████░░ |
| Engineer | anthropic/claude-opus-4-6 | $34.20 | 70% | █████████░ |
| Dispatch | anthropic/claude-haiku-4-5 | $2.10 | 4% | █░ |

### Expandable: Per Provider Breakdown

All 6 providers tracked:

| Provider | Models | Cost Source |
|---|---|---|
| **Anthropic** | Opus 4.6, Sonnet 4.6, Haiku 4.5 | Per-token (known pricing) |
| **Qwen** | Qwen 3.5 Plus | $0.26 input / $1.56 output per 1M |
| **MiniMax** | M2.5, M2.5 Highspeed | $0.30 input / $1.20 output per 1M |
| **Google** | Gemini 2.5 Pro, Gemini 2.5 Flash | Usage-based (free tier available) |
| **OpenAI** | GPT-5 (image model) | Per-token |
| **Ollama** | Nemotron 3 Nano (local) | $0.00 (always free) |

### Trend
7-day sparkline showing daily cost. Simple SVG line chart.

### Data Source
- **v1 (demo):** Mock/seed data in `config.js` — realistic numbers, manually updated. Cost tracking requires gateway-level instrumentation that doesn't exist yet; mocking is the right call for tomorrow.
- **v2 (production):** Token counts from OpenClaw gateway usage API (to be built), cost calculated client-side using per-token rates from `config.js`.
- **Revenue:** Set per client in `config.js` (e.g., `revenue: 500`). No UI to edit it in v1.

---

## Section 4: Product Kanban

### Columns

| Column | Meaning |
|---|---|
| **Planned** | Scoped and ready to start |
| **Building** | Actively being worked on |
| **Testing** | Built, being validated |
| **Deployed** | Live and delivered |

### Card Properties
- **Title** — what it is ("Recruiting Template", "Client #2 Deploy")
- **Assignee** — Charlie, or an agent name
- **Priority** — P1 (red), P2 (orange), P3 (blue) tag
- **Created date** — when card was added
- **Notes** — optional short description (expandable)

### Interactions
- Drag and drop between columns (using SortableJS, ~10KB — vanilla HTML DnD is too inconsistent)
- Click to expand card details
- Add new card via "+" button in each column header
- Cards persist in localStorage for the demo (upgrade to API-backed later)

### Scope
This board tracks AIMEE **product development and deployment projects** — templates, client onboarding, features, infrastructure. It does NOT track client operational tasks (those live in Paperclip).

---

## Authentication & API Access (v1 — Demo)

### UI Auth
- Login page with password field
- Password checked against hardcoded demo token in `config.js`
- Sets a localStorage flag; redirect to login if missing
- No user management, no roles — just a gate

### API Auth (CORS + Token Strategy)
For the demo, the dashboard runs on the **same host** as all services (Charlie's Mac). All APIs are on `localhost` at different ports, so CORS is not an issue when the dashboard is served from a local dev server or from the ctg-core container.

For production (cubillastechnologygroup.com → remote APIs):
- Add CORS headers to Hub and Relay (`Access-Control-Allow-Origin`)
- Hub admin token stored in `config.js` — acceptable for demo (single user). For prod, proxy through a thin backend to avoid exposing the token client-side.
- Relay and Paperclip health endpoints are unauthenticated — no token needed.

**Future:** Azure AD / OAuth for real multi-tenant auth with client-scoped views. Backend-for-frontend proxy holds all API tokens.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Frontend** | Static HTML/CSS/JS | No framework needed for a dashboard. Fast, no build step. |
| **Styling** | Inline or single CSS file | Clean SaaS style, system fonts, card components |
| **Data** | Fetch from Paperclip + Hub + Relay APIs | Dashboard is a read layer over existing APIs |
| **Kanban storage** | localStorage (v1) | No backend needed for demo. Upgrade to Paperclip-backed later. |
| **Hosting (demo)** | Served from ctg-core container or local dev server | Works on Charlie's Mac for the meeting |
| **Hosting (prod)** | Azure Static Web Apps (free tier) | cubillastechnologygroup.com, HTTPS, custom domain |
| **Auth (demo)** | Simple password gate | Single shared password for demo |
| **Auth (prod)** | Azure AD B2C or Auth0 | Multi-tenant, client-scoped |

---

## API Endpoints Consumed

| Endpoint | Source | Purpose |
|---|---|---|
| `GET /health` | Gateway (`:28789`) | Service health status |
| `GET /api/health` | Paperclip (`:13100`) | Paperclip health |
| `GET /api/companies/:id/agents` | Paperclip | Agent list + status |
| `GET /health` | Relay (`:19090`) | Relay status + last check-in |
| `GET /status` | Relay (`:19090`) | Full health report (services + agents + resources) |
| `GET /api/tenants` | Hub (`:9100`) | Tenant list (admin view) |
| `GET /api/tenants/:id/health` | Hub (`:9100`) | Latest client health data |

---

## File Structure

```
~/.openclaw/ctg-core/dashboard/
├── index.html          # Main dashboard (single page)
├── login.html          # Auth gate
├── style.css           # Clean SaaS styles
├── config.js           # API URLs, polling interval, provider rates, revenue, demo password
├── app.js              # Dashboard logic (fetch data, render sections)
└── kanban.js           # Kanban board logic (drag/drop, localStorage, SortableJS)
```

### config.js contents
```js
{
  apiUrls: { relay, paperclip, hub, gateway },
  hubToken: "...",          // admin token (demo only — proxy in prod)
  companyId: "...",         // tenant UUID
  pollIntervalMs: 15000,   // refresh every 15 seconds
  demoPassword: "...",      // UI gate password
  revenue: 500,             // monthly revenue per client
  providerRates: { ... },   // per-token costs for all 6 providers
}
```

---

## Loading & Error States

- **Loading:** Skeleton card placeholders (gray pulsing rectangles) while API calls are in flight
- **API error:** Red banner at top of section: "Could not reach [service name] — retrying..." Auto-retry on next poll cycle.
- **Service down:** Health card dot turns red, tooltip shows last healthy timestamp
- **All APIs down:** Full-page message: "AIMEE services unreachable. Check that the stack is running."

---

## Out of Scope (v1)

- Real-time WebSocket updates (polling is fine for demo)
- User management / roles
- Historical cost graphs (just 7-day sparkline)
- Mobile responsive (desktop-first for investor meeting)
- Alerts / notifications
- Dark mode toggle
