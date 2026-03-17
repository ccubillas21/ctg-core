# AIMEE Mission Control — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page dashboard for AIMEE deployments — health monitoring, cost overview, and product kanban — for an investor demo.

**Architecture:** Static HTML/CSS/JS dashboard that fetches data from existing APIs (Relay, Hub, Paperclip, Gateway). Login gate stores auth in localStorage. Kanban uses SortableJS for drag-drop, persists to localStorage. Cost data is mocked for v1.

**Tech Stack:** Vanilla HTML/CSS/JS, SortableJS (CDN), system font stack, no build step.

---

### Task 1: Config & Login Gate

**Files:**
- Create: `~/.openclaw/ctg-core/dashboard/config.js`
- Create: `~/.openclaw/ctg-core/dashboard/login.html`

- [ ] **Step 1: Create config.js**

```js
// ~/.openclaw/ctg-core/dashboard/config.js
const CONFIG = {
  apiUrls: {
    relay: 'http://localhost:19090',
    paperclip: 'http://localhost:13100',
    hub: 'http://localhost:9100',
    gateway: 'http://localhost:28789',
  },
  hubToken: '', // set after setup.sh generates it
  companyId: '', // set after setup.sh generates it
  pollIntervalMs: 15000,
  demoPassword: 'aimee2026',
  revenue: 500,
  providerRates: {
    anthropic: {
      'claude-opus-4-6': { input: 15, output: 75 },
      'claude-sonnet-4-6': { input: 3, output: 15 },
      'claude-haiku-4-5': { input: 0.80, output: 4 },
    },
    qwen: {
      'qwen3.5-plus': { input: 0.26, output: 1.56 },
    },
    minimax: {
      'MiniMax-M2.5': { input: 0.30, output: 1.20 },
      'MiniMax-M2.5-highspeed': { input: 0.30, output: 1.20 },
    },
    google: {
      'gemini-2.5-pro': { input: 1.25, output: 10 },
      'gemini-2.5-flash': { input: 0.15, output: 0.60 },
    },
    openai: {
      'gpt-5': { input: 5, output: 15 },
    },
    ollama: {
      'nemotron-3-nano': { input: 0, output: 0 },
    },
  },
  // Mock cost data for v1 demo (realistic numbers)
  mockCosts: {
    agents: [
      { name: 'Primary', model: 'claude-sonnet-4-6', provider: 'anthropic', cost: 12.40, inputTokens: 1240000, outputTokens: 620000 },
      { name: 'Engineer', model: 'claude-opus-4-6', provider: 'anthropic', cost: 34.20, inputTokens: 890000, outputTokens: 342000 },
      { name: 'Dispatch', model: 'claude-haiku-4-5', provider: 'anthropic', cost: 2.10, inputTokens: 1600000, outputTokens: 400000 },
    ],
    providers: [
      { name: 'Anthropic', cost: 38.50 },
      { name: 'Qwen', cost: 6.20 },
      { name: 'MiniMax', cost: 2.80 },
      { name: 'Google', cost: 1.20 },
      { name: 'OpenAI', cost: 0.00 },
      { name: 'Ollama', cost: 0.00 },
    ],
    dailyTrend: [42.30, 45.10, 38.90, 51.20, 44.60, 48.70, 47.80],
  },
  // Seed kanban cards for demo
  seedKanban: [
    { id: 1, title: 'AIMEE Core v1.0', assignee: 'Charlie', priority: 'P1', notes: 'Full stack package — Docker, agents, SOPs, relay', column: 'deployed', created: '2026-03-16' },
    { id: 2, title: 'Recruiting Template', assignee: 'Engineer', priority: 'P1', notes: 'Screen resumes, schedule interviews, candidate comms', column: 'building', created: '2026-03-16' },
    { id: 3, title: 'Sales Template', assignee: 'Charlie', priority: 'P2', notes: 'Lead qualification, CRM updates, follow-up drafts', column: 'planned', created: '2026-03-16' },
    { id: 4, title: 'Client #1 Deploy', assignee: 'Charlie', priority: 'P1', notes: 'Investor pilot deployment', column: 'building', created: '2026-03-17' },
    { id: 5, title: 'Client #2 Onboard', assignee: 'Primary', priority: 'P2', notes: 'Second client via investor referral', column: 'planned', created: '2026-03-17' },
    { id: 6, title: 'Mission Control v1', assignee: 'Charlie', priority: 'P1', notes: 'Dashboard for managing deployments', column: 'testing', created: '2026-03-16' },
  ],
};
```

- [ ] **Step 2: Create login.html**

Simple login page — password field, checks against `CONFIG.demoPassword`, sets `localStorage.aimeeAuth = 'true'`, redirects to `index.html`.

Clean SaaS style: centered card, AIMEE branding, indigo accent button.

- [ ] **Step 3: Verify login flow**

Open `login.html` in browser. Enter wrong password — should show error. Enter `aimee2026` — should redirect to `index.html`. Open `index.html` directly without auth — should redirect to `login.html`.

---

### Task 2: CSS Foundation

**Files:**
- Create: `~/.openclaw/ctg-core/dashboard/style.css`

- [ ] **Step 1: Write style.css**

All styles for the dashboard:
- CSS reset + system font stack
- Header bar (fixed top, white, bottom border)
- Card component (white bg, rounded, subtle shadow, padding)
- Status dots (`.dot-healthy`, `.dot-down`, `.dot-degraded`)
- Summary number cards (large font, label above)
- Expandable section (`.expandable` with `.expanded` toggle)
- Cost bar chart (horizontal bars with percentage fill)
- Sparkline container
- Kanban board (flex columns, card styles, priority tags)
- Skeleton loading animation (`@keyframes pulse`)
- Error banner
- Login page styles
- Accent color: `#4F46E5` throughout
- All box-shadow: `0 1px 3px rgba(0,0,0,0.08)`

---

### Task 3: Dashboard HTML Shell

**Files:**
- Create: `~/.openclaw/ctg-core/dashboard/index.html`

- [ ] **Step 1: Write index.html**

Single HTML file with these sections in order:

1. `<head>` — meta, title "AIMEE Mission Control", link to style.css, SortableJS from CDN (`https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js`)

2. **Header bar** — AIMEE logo text + "Mission Control" subtitle, quick links (Paperclip, Gateway, Hub — read URLs from config), client selector dropdown (just "Demo" for v1), sign-out button

3. **Section: Health** (`#health-section`) — `<h2>` section title, container `div` for 4 cards (Services, Agents, Uptime, Relay). Each card starts with skeleton loading state.

4. **Section: Costs** (`#cost-section`) — `<h2>` section title, summary row (3 big numbers: Revenue, Cost, Margin), expandable "Per Agent" breakdown, expandable "Per Provider" breakdown, sparkline SVG container.

5. **Section: Product Board** (`#kanban-section`) — `<h2>` section title, 4 column containers (Planned, Building, Testing, Deployed) each with header + "+" add button + card list container.

6. **Error banner** (`#error-banner`) — hidden by default, red strip at top.

7. `<script src="config.js">`, `<script src="app.js">`, `<script src="kanban.js">`

- [ ] **Step 2: Verify shell renders**

Open in browser. Should see header, 3 section headings, skeleton cards, empty kanban columns. No JS errors in console.

---

### Task 4: App Logic — Health Section

**Files:**
- Create: `~/.openclaw/ctg-core/dashboard/app.js`

- [ ] **Step 1: Write auth check + data fetching**

At top of `app.js`:
- Check `localStorage.aimeeAuth` — if not set, redirect to `login.html`
- Sign-out button clears localStorage and redirects to login
- `async function fetchJSON(url, options)` — wrapper with timeout, error handling, returns `{ok, data, error}`
- `async function fetchHealth()` — calls relay `/status`, relay `/health`, hub `/api/tenants/:id/health` (with Bearer token). Returns combined health object.

- [ ] **Step 2: Write health section renderer**

`function renderHealth(data)`:
- **Services Card** — loop through `data.services`, render name + dot (green if "healthy", red otherwise). Infer PostgreSQL from Paperclip.
- **Agents Card** — loop through `data.agents`, render name + model + status dot + last activity (relative time like "2m ago")
- **Uptime Card** — show relay uptime as formatted hours/days + check-in count. Render as ring SVG (percentage arc).
- **Relay Card** — show `lastCheckin` as relative time, `lastCheckinStatus`, `checkinCount`, parent hub configured or not.

Replace skeleton HTML with rendered content. If fetch fails, show error banner.

- [ ] **Step 3: Write polling loop**

```js
async function poll() {
  const health = await fetchHealth();
  renderHealth(health);
  renderCosts(); // from mock data, no fetch needed
}
poll(); // initial
setInterval(poll, CONFIG.pollIntervalMs);
```

- [ ] **Step 4: Verify health section works**

With relay running on :19090, open dashboard. Should show live service status, agent list, relay info. Stop relay — should show red dots / error banner on next poll.

---

### Task 5: Cost Overview Section

**Files:**
- Modify: `~/.openclaw/ctg-core/dashboard/app.js`

- [ ] **Step 1: Write cost section renderer**

`function renderCosts()`:
- Read `CONFIG.mockCosts` and `CONFIG.revenue`
- Calculate total cost (sum of all agent costs)
- Calculate margin: `((revenue - totalCost) / revenue * 100).toFixed(1)`
- Render summary row: Revenue ($500), Cost ($48.70), Margin (90.3%)
- Render per-agent breakdown: name, model, cost, percentage bar (width = cost/totalCost * 100%)
- Render per-provider breakdown: name, cost, percentage bar
- Make both breakdowns expandable (click header to toggle `.expanded` class)

- [ ] **Step 2: Write sparkline renderer**

`function renderSparkline(containerId, values)`:
- Take `CONFIG.mockCosts.dailyTrend` (7 numbers)
- Generate SVG polyline — normalize values to fit within a 200x40 viewBox
- Style: indigo stroke (`#4F46E5`), no fill, 2px stroke width
- Render day labels below (Mon-Sun)

- [ ] **Step 3: Verify cost section**

Open dashboard. Should see 3 summary numbers, expandable agent/provider breakdowns with horizontal bars, sparkline chart at bottom of section.

---

### Task 6: Kanban Board

**Files:**
- Create: `~/.openclaw/ctg-core/dashboard/kanban.js`

- [ ] **Step 1: Write kanban data layer**

```js
function loadCards() — read from localStorage('aimeeKanban'), fallback to CONFIG.seedKanban
function saveCards(cards) — write to localStorage('aimeeKanban')
function nextId(cards) — max id + 1
```

- [ ] **Step 2: Write kanban renderer**

`function renderKanban()`:
- Load cards, group by `column`
- For each column (planned, building, testing, deployed), render cards into the column container
- Each card shows: title, assignee, priority tag (P1=red, P2=orange, P3=blue), created date
- Click card → expand to show notes, with close button
- "+" button opens inline form: title, assignee, priority dropdown, notes textarea, save/cancel

- [ ] **Step 3: Initialize SortableJS**

```js
function initSortable():
  for each column container:
    new Sortable(el, {
      group: 'kanban',
      animation: 150,
      ghostClass: 'card-ghost',
      onEnd: function(evt) {
        // Update card's column based on which container it landed in
        // Save to localStorage
      }
    })
```

- [ ] **Step 4: Wire up add card**

Each column's "+" button:
- Shows inline form at top of column
- On save: create card object, add to cards array, saveCards(), renderKanban()
- On cancel: hide form

- [ ] **Step 5: Verify kanban**

Open dashboard. Should see seed cards in correct columns. Drag a card between columns — should persist on refresh. Click "+" — add a new card — should appear and persist. Click a card — should expand to show notes.

---

### Task 7: Polish & Integration Test

**Files:**
- Modify: `~/.openclaw/ctg-core/dashboard/index.html` (minor tweaks)
- Modify: `~/.openclaw/ctg-core/dashboard/style.css` (minor tweaks)

- [ ] **Step 1: Add header quick links**

Wire up Paperclip, Gateway, Hub links to open `CONFIG.apiUrls.*` in new tabs. Wire sign-out button.

- [ ] **Step 2: Add error/loading states**

- Error banner: shows when all API calls fail, hides when any succeed
- Skeleton cards: show on initial load, replaced after first successful poll

- [ ] **Step 3: Full integration test**

1. Start hub API on :9100 (already running)
2. Open `login.html` → enter password → redirects to dashboard
3. Health section shows relay/hub data (or error if services not running)
4. Cost section shows mock data with expandable breakdowns + sparkline
5. Kanban shows seed cards, drag-drop works, new cards persist
6. Quick links open correct URLs in new tabs
7. Sign out returns to login page
8. Reopen dashboard — kanban cards persisted

- [ ] **Step 4: Serve locally for demo**

```bash
cd ~/.openclaw/ctg-core/dashboard && python3 -m http.server 8080
```

Open `http://localhost:8080/login.html` — full dashboard working.
