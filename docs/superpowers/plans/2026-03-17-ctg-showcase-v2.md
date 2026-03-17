# CTG Showcase Site v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the CTG showcase site from 8 sections to 7, with consistent accordion interactions, 3-layer org chart, dual-layer architecture/deployment expands, interactive product pricing with token limits, and a new Opportunity section.

**Architecture:** Single-page vanilla HTML/CSS/JS app. All interactions driven by CSS class toggling + JS event delegation. No build step. Lucide icons via CDN. Data hardcoded from agent IDENTITY.md/SOUL.md files.

**Tech Stack:** HTML5, CSS3 (custom properties, grid, flexbox, transitions), vanilla JS (ES5 IIFE pattern matching v1), Lucide Icons CDN

**Spec:** `docs/superpowers/specs/2026-03-17-ctg-showcase-v2-design.md`

**Existing files to rewrite:**
- `~/.openclaw/ctg-core/showcase/index.html`
- `~/.openclaw/ctg-core/showcase/style.css`
- `~/.openclaw/ctg-core/showcase/app.js`

---

## Task 1: Scaffold — HTML structure + sidebar + Lucide CDN

**Files:**
- Rewrite: `~/.openclaw/ctg-core/showcase/index.html`

Replaces the entire index.html with the new 7-section structure, sidebar with service links, and Lucide CDN script tag. All section containers are empty — content added in subsequent tasks.

- [ ] **Step 1: Write the scaffold HTML**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CTG — AI Operations Platform</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="shell">
    <nav class="sidebar">
      <div class="sidebar-logo">CTG</div>
      <div class="sidebar-subtitle">AI Operations Platform</div>

      <div class="sidebar-label">The Story</div>
      <a class="nav-item active" data-section="vision">① The Vision</a>
      <a class="nav-item" data-section="stack">② The Stack</a>
      <a class="nav-item" data-section="team">③ The Team</a>
      <a class="nav-item" data-section="architecture">④ Architecture</a>
      <a class="nav-item" data-section="deployment">⑤ Deployment</a>
      <a class="nav-item" data-section="product">⑥ The Product</a>
      <a class="nav-item" data-section="opportunity">⑦ The Opportunity</a>

      <div class="sidebar-links">
        <a href="https://mc.cubillastechnologygroup.com" target="_blank" class="sidebar-link">Mission Control</a>
        <a href="https://paperclip.cubillastechnologygroup.com" target="_blank" class="sidebar-link">Paperclip</a>
        <a href="https://gateway.cubillastechnologygroup.com" target="_blank" class="sidebar-link">Gateway</a>
        <a href="https://hub.cubillastechnologygroup.com" target="_blank" class="sidebar-link">Hub</a>
      </div>

      <div class="sidebar-progress">
        <div class="progress-bar">
          <div class="progress-fill" id="progress-fill" style="width: 14.3%"></div>
        </div>
        <div class="progress-label" id="progress-label">1 of 7</div>
      </div>
    </nav>

    <main class="content">
      <div class="section" id="vision">
        <!-- Task 2 -->
      </div>
      <div class="section" id="stack">
        <!-- Task 3 -->
      </div>
      <div class="section" id="team">
        <!-- Task 4 -->
      </div>
      <div class="section" id="architecture">
        <!-- Task 5 -->
      </div>
      <div class="section" id="deployment">
        <!-- Task 6 -->
      </div>
      <div class="section" id="product">
        <!-- Task 7 -->
      </div>
      <div class="section" id="opportunity">
        <!-- Task 8 -->
      </div>
    </main>
  </div>

  <script src="https://unpkg.com/lucide@0.460.0"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Start local dev server (if not running)**

```bash
cd ~/.openclaw/ctg-core/showcase && python3 -m http.server 8080 &
```

- [ ] **Step 3: Verify the page loads in browser**

Open `http://localhost:8080`. Should see sidebar with 7 nav items + service links. Content area is empty. Lucide script loads without errors (check browser console).

- [ ] **Step 4: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/index.html && git commit -m "scaffold: v2 HTML structure with 7 sections and sidebar service links"
```

---

## Task 2: Section ① — The Vision

**Files:**
- Modify: `~/.openclaw/ctg-core/showcase/index.html` (vision section)
- Modify: `~/.openclaw/ctg-core/showcase/style.css` (add quote block styles)

Content: Jensen Huang quote callout, context paragraph, the gap, why us, platform overview with Lucide icons (🦞 for Lobster).

- [ ] **Step 1: Add Vision section HTML**

Inside `<div class="section" id="vision">`, add:
- `.quote-block` with the Jensen Huang quote, attribution, and date
- `.card` with context paragraph explaining OpenClaw in simple terms
- `.card` with "the gap" — what's missing in the market
- `.card` with "why us" — Charlie's background, Power Automate bot sales, AIMEE stack
- Platform overview diagram: 4 color-coded cards in a horizontal flex row with Lucide icons (`clipboard-list`, `bot`, 🦞, `brain`) and sub-labels

Key text from spec:
- Quote: "Every company in the world today needs an OpenClaw strategy." — Jensen Huang, NVIDIA CEO · GTC, March 16, 2026
- Note below quote: OpenClaw is the open-source agentic AI framework. CTG's AIMEE stack uses it as its Layer 2 agent engine.

- [ ] **Step 2: Add CSS for quote block**

```css
/* ── Quote Block ──────────────────────────────── */
.quote-block {
  background: var(--accent-light);
  border-left: 4px solid var(--accent);
  border-radius: 0 var(--radius) var(--radius) 0;
  padding: 1.5rem 2rem;
  margin-bottom: 1.5rem;
}

.quote-text {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text);
  font-style: italic;
  line-height: 1.6;
}

.quote-attr {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.75rem;
}

.quote-note {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
  font-style: italic;
}
```

- [ ] **Step 3: Use Lucide icons in platform overview**

For the 4-layer platform overview, use `<i data-lucide="clipboard-list"></i>` etc. Lucide auto-replaces on load. Lobster uses 🦞 emoji directly.

- [ ] **Step 4: Verify in browser**

Check: quote block renders with indigo left border, platform overview shows 4 cards with icons, text is readable and matches spec tone.

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/index.html showcase/style.css && git commit -m "feat: section 1 — The Vision with Jensen Huang quote and platform overview"
```

---

## Task 3: Section ② — The Stack

**Files:**
- Modify: `~/.openclaw/ctg-core/showcase/index.html` (stack section)

Largely unchanged from v1. Vertical stack of 4 clickable layer cards with accordion. Update icons from emoji to Lucide (except 🦞). Keep sub-components and stats row.

- [ ] **Step 1: Add Stack section HTML**

Copy the existing v1 stack section structure. Replace emoji icons (NOTE: v1 uses 🔄 for Lobster which is wrong — change to 🦞):
- 📋 → `<i data-lucide="clipboard-list" style="width:24px;height:24px"></i>`
- 🤖 → `<i data-lucide="bot" style="width:24px;height:24px"></i>`
- 🔄 → 🦞 (Lobster emoji — v1 had the wrong icon here)
- 🧠 → `<i data-lucide="brain" style="width:24px;height:24px"></i>`

Also update the Platform Overview in Section 1 (same icon mapping).

Keep: layer cards, accordion expand, sub-components grid, stats row, layer connectors.

- [ ] **Step 2: Verify accordion still works**

Click each layer card — should expand to show sub-components. Only one open at a time. Arrow rotates.

- [ ] **Step 3: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/index.html && git commit -m "feat: section 2 — The Stack with Lucide icons"
```

---

## Task 4: Section ③ — The Team (3-layer org chart)

**Files:**
- Modify: `~/.openclaw/ctg-core/showcase/index.html` (team section)
- Modify: `~/.openclaw/ctg-core/showcase/style.css` (new org chart styles)
- Modify: `~/.openclaw/ctg-core/showcase/app.js` (3-layer interaction logic)

This is the biggest task. Complete rewrite of the org chart with 3-layer progressive disclosure.

- [ ] **Step 1: Add Layer 1 HTML — Curated Overview**

Three cards in a row: Charlie (CEO), then Dude (CGO), Walter (CTO), Bonny (Jr Admin). Dude and Walter have clickable "N reports ▾" badges. Bonny does not expand.

Each card uses `data-dept` attribute for department head expansion. Structure:

```html
<div class="org-v2">
  <!-- CEO -->
  <div class="org-v2-row">
    <div class="org-v2-card dept-ceo">
      <div class="org-v2-emoji">👔</div>
      <div class="org-v2-name">Charlie</div>
      <div class="org-v2-role">CEO</div>
      <div class="org-v2-model">Human</div>
    </div>
  </div>
  <div class="org-v2-connector">│</div>
  <!-- Direct Reports -->
  <div class="org-v2-row">
    <div class="org-v2-card dept-operations" data-dept="dude">
      <div class="org-v2-emoji">🎳</div>
      <div class="org-v2-name">Dude</div>
      <div class="org-v2-role">CGO · Operations</div>
      <div class="org-v2-model">Claude Sonnet 4.6</div>
      <div class="org-v2-badge dept-operations-badge">4 reports ▾</div>
    </div>
    <div class="org-v2-card dept-engineering" data-dept="walter">
      <!-- ... Walter with 16 reports ▾ ... -->
    </div>
    <div class="org-v2-card dept-support">
      <!-- ... Bonny, no badge, no data-dept ... -->
    </div>
  </div>
  <!-- Layer 2 expansions -->
  <div class="org-v2-expansion" id="dept-dude">
    <!-- Dude's team: Scout, Maude, Donny, Atlas -->
  </div>
  <div class="org-v2-expansion" id="dept-walter">
    <!-- Walter's team: VPs grid, Engineering Teams grid, Specialists -->
  </div>
</div>
```

- [ ] **Step 2: Add Layer 2 HTML — Walter's team**

Inside `#dept-walter`:
- Section label "Vice Presidents" + 3-column grid of 6 VP cards (Oracle, Sentinel, Docker VP, Herald, Axiom, Ops). Each card has `data-agent` attribute for Layer 3.
- Section label "Engineering Teams" + 2-column grid of 4 team cards (Azure, GCP, Web, App). Each has `data-team` attribute for expanding to show Architect + Engineer pair.
- Section label "Specialists" + row of 2 cards (Windows, Docker).

- [ ] **Step 3: Add Layer 2 HTML — Dude's team**

Inside `#dept-dude`:
- 4 cards in a grid: Scout (Product PM), Maude (Delivery PM), Donny (Client PM), Atlas (VP of AI Resources). Each has `data-agent` attribute.

- [ ] **Step 4: Add Layer 3 HTML — Agent detail panels**

Each agent card gets a hidden `.org-v2-detail` div inside it with:
- Large emoji, name, role badge
- Model name, "Reports to: [manager]"
- One-line description
- Specialty tags as pill badges

Data for each agent from IDENTITY.md files (hardcoded):

**Walter's VPs:**
- Oracle: 🔮, VP of AI/ML Operations, Sonnet 4.6, "Model selection, prompt optimization, cost monitoring, AI performance across all agents", tags: AI/ML Specialist, Cost Optimization, Prompt Engineering
- Sentinel: 🛡️, VP of Security / CSO, Sonnet 4.6, "Continuous security monitoring, vulnerability detection, compliance auditing", tags: Security, Compliance, Monitoring
- Docker VP: 🐳, VP of Infrastructure, Sonnet 4.6, "Containerization, cloud deployments, networking, infrastructure", tags: Docker, Cloud, Networking
- Herald: 📡, VP of Telecoms, Sonnet 4.6, "All communication channels — Telegram, Discord, email, SMS, message routing", tags: Messaging, Channels, Routing
- Axiom: 🧠, VP of Platform Engineering, Opus 4.6, "OpenClaw configuration control, platform documentation, SOP authorship", tags: OpenClaw SME, Config Control, Documentation
- Ops: ⚙️, VP of Platform Operations, Sonnet 4.6, "Paperclip visibility, Mission Control dashboards, gateway operations", tags: Monitoring, Dashboards, Operations

**Engineering Teams (expand to show pair):**
- Azure: 🪟 Architect (research, design) + 🔧🪟 Engineer (execute, build)
- GCP: ☁️ Architect + 🔧☁️ Engineer
- Web: 🌐 Architect + 🔧🌐 Engineer
- App: 📱 Architect + 🔧📱 Engineer

**Specialists:**
- Windows: 🪟, Host Operations, "PowerShell, Task Scheduler, Windows host control", tags: Windows, PowerShell, Host Ops
- Docker: 🐳, Container Specialist, Opus 4.6, "Dockerfiles, Compose files, registry management, container monitoring", tags: Docker, Containers, Compose

**Dude's Team:**
- Scout: Product PM, tags: Product, Roadmap
- Maude: Delivery PM, tags: Sprints, Execution
- Donny: Client PM, tags: Clients, Onboarding
- Atlas: VP of AI Resources, Sonnet 4.6, "Agent capacity planning, task-agent matching, cost optimization", tags: HR for AI, Capacity, Cost

- [ ] **Step 5: Add CSS for org chart v2**

New CSS classes (replaces old `.org-chart` styles):

```css
/* ── Org Chart v2 (3-layer) ──────────────────── */
.org-v2 { display: flex; flex-direction: column; align-items: center; }
.org-v2-row { display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap; }
.org-v2-connector { text-align: center; color: var(--border); font-size: 1.5rem; margin: 0.5rem 0; }

.org-v2-card {
  background: var(--card-bg);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  text-align: center;
  min-width: 160px;
  box-shadow: var(--shadow);
  transition: all 0.15s;
  cursor: default;
}
.org-v2-card[data-dept], .org-v2-card[data-agent], .org-v2-card[data-team] { cursor: pointer; }
.org-v2-card[data-dept]:hover, .org-v2-card[data-agent]:hover, .org-v2-card[data-team]:hover { box-shadow: var(--shadow-md); }

.org-v2-card.dept-ceo { border-color: var(--accent); }
.org-v2-card.dept-operations { border-color: var(--dept-operations); }
.org-v2-card.dept-engineering { border-color: var(--dept-engineering); }
.org-v2-card.dept-support { border-color: var(--dept-support); }
.org-v2-card.dept-pmo { border-color: var(--dept-pmo); }

.org-v2-emoji { font-size: 1.5rem; margin-bottom: 0.3rem; }
.org-v2-name { font-weight: 700; font-size: 0.9rem; }
.org-v2-role { font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.15rem; }
.org-v2-model { font-size: 0.65rem; color: var(--text-muted); margin-top: 0.15rem; }

.org-v2-badge {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
}
.dept-operations-badge { background: var(--dept-operations-light); color: var(--dept-operations); }
.dept-engineering-badge { background: var(--dept-engineering-light); color: var(--dept-engineering); }

/* Layer 2: Department expansion */
.org-v2-expansion {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
  width: 100%;
}
.org-v2-expansion.expanded { max-height: 2000px; }

.org-v2-expansion-inner {
  padding: 1.5rem 0;
  border-top: 1px solid var(--border);
  margin-top: 1rem;
}

.org-v2-group-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.org-v2-grid {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}
.org-v2-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
.org-v2-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }

.org-v2-mini {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem;
  cursor: pointer;
  transition: border-color 0.15s;
}
.org-v2-mini:hover { border-color: var(--accent); }
.org-v2-mini-name { font-weight: 600; font-size: 0.85rem; }
.org-v2-mini-role { font-size: 0.7rem; color: var(--text-secondary); }
.org-v2-mini-model { font-size: 0.65rem; color: var(--text-muted); }
.org-v2-mini-expand { font-size: 0.65rem; color: var(--accent); margin-top: 0.25rem; }

/* Layer 3: Agent detail */
.org-v2-detail {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
.org-v2-mini.expanded .org-v2-detail { max-height: 500px; }

.org-v2-detail-inner {
  padding-top: 0.75rem;
  margin-top: 0.5rem;
  border-top: 1px solid var(--border);
  text-align: left;
}

.org-v2-detail-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.org-v2-detail-tags {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.org-v2-tag {
  font-size: 0.65rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
  color: var(--text-muted);
}
```

- [ ] **Step 5b: Add bottom note and department legend**

After the `.org-v2` container, add:
```html
<p style="text-align: center; font-size: 0.8rem; color: var(--text-muted); margin-top: 1rem; font-style: italic;">This is CTG's live team — the organization that builds and manages client deployments.</p>

<div class="dept-legend">
  <div><span class="dept-swatch" style="background: var(--dept-operations);"></span>Operations</div>
  <div><span class="dept-swatch" style="background: var(--dept-engineering);"></span>Engineering</div>
  <div><span class="dept-swatch" style="background: var(--dept-pmo);"></span>PMO</div>
  <div><span class="dept-swatch" style="background: var(--dept-support);"></span>Support</div>
</div>
```

- [ ] **Step 6: Add JS for 3-layer org chart interaction**

In app.js, add:
- Click handler on `[data-dept]` cards: toggles `.expanded` on the matching `#dept-{id}` expansion. Accordion behavior — only one department expanded at a time. Collapses any open Layer 3 details inside.
- Click handler on `[data-agent]` and `[data-team]` mini cards: toggles `.expanded` on the clicked card. Accordion within the expansion — only one agent detail open per group.

```javascript
// ── Org Chart v2 (3-layer) ────────────────────
var deptCards = document.querySelectorAll('[data-dept]');
var expansions = document.querySelectorAll('.org-v2-expansion');

deptCards.forEach(function (card) {
  card.addEventListener('click', function () {
    var deptId = card.getAttribute('data-dept');
    var target = document.getElementById('dept-' + deptId);
    var wasExpanded = target.classList.contains('expanded');

    // Close all expansions + reset all Layer 3
    expansions.forEach(function (exp) {
      exp.classList.remove('expanded');
      exp.querySelectorAll('.org-v2-mini.expanded').forEach(function (m) {
        m.classList.remove('expanded');
      });
    });

    if (!wasExpanded) {
      target.classList.add('expanded');
    }
  });
});

// Layer 3: agent/team detail
document.addEventListener('click', function (e) {
  var mini = e.target.closest('.org-v2-mini');
  if (!mini) return;

  var parent = mini.closest('.org-v2-grid');
  if (!parent) return;

  var wasExpanded = mini.classList.contains('expanded');

  // Close siblings
  parent.querySelectorAll('.org-v2-mini.expanded').forEach(function (m) {
    m.classList.remove('expanded');
  });

  if (!wasExpanded) {
    mini.classList.add('expanded');
  }
});
```

- [ ] **Step 7: Verify in browser**

Test all 3 layers:
1. Default: see Charlie, Dude, Walter, Bonny
2. Click Walter → his team expands (VPs, Engineering Teams, Specialists)
3. Click Oracle → detail panel shows inline with tags
4. Click Sentinel → Oracle closes, Sentinel opens
5. Click Dude → Walter's whole section closes, Dude's team appears
6. Click Bonny → nothing happens (no expand)

- [ ] **Step 8: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/ && git commit -m "feat: section 3 — 3-layer interactive org chart with full team roster"
```

---

## Task 5: Section ④ — Architecture (dual-layer expand)

**Files:**
- Modify: `~/.openclaw/ctg-core/showcase/index.html` (architecture section)
- Modify: `~/.openclaw/ctg-core/showcase/style.css` (dual-layer expand styles)
- Modify: `~/.openclaw/ctg-core/showcase/app.js` (dual-layer click handler)

- [ ] **Step 1: Add Architecture section HTML**

Service diagram with clickable service cards. Each card has:
- Default: service name, port, health indicator
- Hidden `.service-expand` with business-friendly description
- Hidden `.service-tech` inside that with technical details toggle

Structure:
```html
<div class="arch-v2">
  <div class="arch-v2-row">
    <div class="arch-v2-service" data-service="postgres">
      <div class="arch-v2-name">PostgreSQL</div>
      <div class="arch-v2-port">:5432</div>
      <div class="arch-v2-health">● healthy</div>
      <div class="service-expand">
        <div class="service-expand-inner">
          <p>The database. Stores every task, every agent record, every audit trail. Your data stays on your infrastructure.</p>
          <button class="tech-toggle">Technical Details ▾</button>
          <div class="service-tech">
            <div class="service-tech-inner">
              Image: postgres:16-alpine · Health: pg_isready · Volume: pgdata · Network: ctg-core-net (172.29.0.0/16)
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- ... connectors and other services ... -->
  </div>
</div>
```

Section subtitle: "Click any service to learn what it does."

Include all 5 services with their business-friendly and technical descriptions. Keep connection arrows (SQL, REST, WebSocket, Polling labels) and channels section (Slack, Teams, Telegram).

**Technical detail data for each service (from docker-compose.yml):**
- **PostgreSQL:** Image: postgres:16-alpine · Health: `pg_isready -U ctgcore` · Volume: pgdata · Internal port: 5432
- **Paperclip:** Image: reeoss/paperclipai-paperclip:latest · Health: `wget -qO- http://localhost:3100/api/health` · Port: 13100→3100 · Depends on: PostgreSQL
- **OpenClaw Gateway:** Custom build (Dockerfile.openclaw) · Health: `wget -qO- http://localhost:18789/health` · Port: 28789→18789 · Depends on: Paperclip
- **Parent Relay:** Custom build (parent-relay/Dockerfile) · Health: `wget -qO- http://localhost:9090/health` · Port: 19090→9090 · Depends on: OpenClaw + Paperclip
- **CTG Hub:** Node.js with SQLite · Port: 9100 · Admin token auth

Bottom note: "All services run in Docker on a single server. No client data leaves the client's infrastructure — only metadata and health status flow through the relay."

- [ ] **Step 2: Add CSS for dual-layer expand**

```css
/* ── Dual-layer expand (Architecture + Deployment) */
.arch-v2-service, .deploy-v2-step {
  cursor: pointer;
  transition: all 0.15s;
}
.arch-v2-service:hover, .deploy-v2-step:hover { box-shadow: var(--shadow-md); }

.service-expand, .step-expand {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
.arch-v2-service.expanded .service-expand,
.deploy-v2-step.expanded .step-expand {
  max-height: 500px;
}

.service-expand-inner, .step-expand-inner {
  padding-top: 0.75rem;
  margin-top: 0.75rem;
  border-top: 1px solid var(--border);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.tech-toggle {
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
  font-size: 0.7rem;
  color: var(--text-muted);
  cursor: pointer;
  margin-top: 0.5rem;
  transition: all 0.15s;
}
.tech-toggle:hover { border-color: var(--accent); color: var(--accent); }

.service-tech, .step-tech {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
.service-tech.expanded, .step-tech.expanded {
  max-height: 300px;
}

.service-tech-inner, .step-tech-inner {
  padding-top: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--text-muted);
  background: var(--bg);
  border-radius: 6px;
  padding: 0.75rem;
}
```

- [ ] **Step 3: Add JS for dual-layer interaction**

```javascript
// ── Dual-layer expand (Architecture + Deployment) ─
document.addEventListener('click', function (e) {
  // Tech toggle (inner layer)
  var toggle = e.target.closest('.tech-toggle');
  if (toggle) {
    e.stopPropagation();
    var techDiv = toggle.nextElementSibling;
    techDiv.classList.toggle('expanded');
    toggle.textContent = techDiv.classList.contains('expanded')
      ? 'Technical Details ▴' : 'Technical Details ▾';
    return;
  }

  // Service card (outer layer)
  var service = e.target.closest('.arch-v2-service');
  if (service) {
    var wasExpanded = service.classList.contains('expanded');
    // Close siblings
    service.parentElement.querySelectorAll('.arch-v2-service.expanded').forEach(function (s) {
      s.classList.remove('expanded');
      s.querySelectorAll('.service-tech.expanded').forEach(function (t) { t.classList.remove('expanded'); });
      s.querySelectorAll('.tech-toggle').forEach(function (t) { t.textContent = 'Technical Details ▾'; });
    });
    if (!wasExpanded) service.classList.add('expanded');
    return;
  }
});
```

- [ ] **Step 4: Verify in browser**

1. Click PostgreSQL → business description expands
2. Click "Technical Details" → tech info shows inside
3. Click Paperclip → PostgreSQL closes (tech detail resets too), Paperclip opens
4. Channels section visible at bottom

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/ && git commit -m "feat: section 4 — interactive architecture with dual-layer expand"
```

---

## Task 6: Section ⑤ — Deployment (dual-layer expand)

**Files:**
- Modify: `~/.openclaw/ctg-core/showcase/index.html` (deployment section)
- Modify: `~/.openclaw/ctg-core/showcase/app.js` (add deploy step handler — reuses dual-layer CSS from Task 5)

- [ ] **Step 1: Add Deployment section HTML**

Horizontal 6-step flow. Each step is a `.deploy-v2-step` card with:
- Step number (checkmark for 1-3)
- Title and short description
- Hidden `.step-expand` with business-friendly detail
- Hidden `.step-tech` with technical details toggle

Steps 1-3 have `.complete` class. Steps 4-6 are numbered.

Use all 6 step descriptions from the spec.

- [ ] **Step 2: Add JS handler for deploy steps**

**IMPORTANT:** This code goes INSIDE the existing `document.addEventListener('click', function (e) { ... })` handler from Task 5 Step 3 — add it AFTER the `var service = ...` block and BEFORE the handler's closing `});`. The tech-toggle handler from Task 5 already handles the inner "Technical Details" buttons for both architecture and deployment.

```javascript
  // Deploy step (outer layer) — add inside the delegated click handler
  var step = e.target.closest('.deploy-v2-step');
  if (step) {
    var wasExpanded = step.classList.contains('expanded');
    step.parentElement.querySelectorAll('.deploy-v2-step.expanded').forEach(function (s) {
      s.classList.remove('expanded');
      s.querySelectorAll('.step-tech.expanded').forEach(function (t) { t.classList.remove('expanded'); });
      s.querySelectorAll('.tech-toggle').forEach(function (t) { t.textContent = 'Technical Details ▾'; });
    });
    if (!wasExpanded) step.classList.add('expanded');
    return;
  }
```

- [ ] **Step 3: Verify in browser**

Click step 1 → expand shows "We copy the AIMEE package..." Click tech toggle → commands show. Click step 2 → step 1 closes.

- [ ] **Step 4: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/ && git commit -m "feat: section 5 — interactive deployment steps with dual-layer expand"
```

---

## Task 7: Section ⑥ — The Product (AIMEE)

**Files:**
- Modify: `~/.openclaw/ctg-core/showcase/index.html` (product section)
- Modify: `~/.openclaw/ctg-core/showcase/style.css` (expandable pricing card styles)

- [ ] **Step 1: Add Product section HTML**

Section title: "AI-Managed Employee Experience (AIMEE)"

Three expandable pricing cards using accordion pattern:

**Starter — $500/month** (`.pricing-v2-card.featured`):
- Default: "3 AI agents, Slack integration, managed SOPs, monitoring, Mission Control dashboard"
- Expand: full feature list (7 bullet items), token allowances table (Dispatch 25M, Primary 8M, Engineer 750K), generous limits callout, overage note, early adopter offer

**Additional Agents — from $50/month** (`.pricing-v2-card`):
- Default: "Scale your team. Price depends on the agent's role and model."
- Expand: mini pricing table (Jr Admin $50/20M tokens, Specialist $150/5M, Senior Dev $250/600K), Ollama note

**Custom / Enterprise — $150/hour** (`.pricing-v2-card`):
- Default: "Custom workflows, integrations, agent training, and advanced configurations."
- Expand: services list, dollar-based spending cap option

**Generous limits callout** (inside Starter expand, styled as a highlighted note):
```html
<div class="generous-callout">
  We include more than most businesses will ever need. If you outgrow your limits, there's flexibility — we'll work with you.
</div>
```

- [ ] **Step 2: Add CSS for expandable pricing cards**

```css
/* ── Product Pricing v2 ──────────────────────── */
.pricing-v2-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.pricing-v2-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  text-align: center;
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: all 0.15s;
}
.pricing-v2-card:hover { box-shadow: var(--shadow-md); }
.pricing-v2-card.featured { border-color: var(--accent); border-width: 2px; }

.pricing-v2-expand {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
  text-align: left;
}
.pricing-v2-card.expanded .pricing-v2-expand { max-height: 1000px; }

.pricing-v2-expand-inner {
  padding-top: 1rem;
  margin-top: 1rem;
  border-top: 1px solid var(--border);
}

.token-table {
  width: 100%;
  font-size: 0.8rem;
  border-collapse: collapse;
  margin: 0.75rem 0;
}
.token-table th, .token-table td {
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.token-table th {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.generous-callout {
  background: #ECFDF5;
  border: 1px solid #A7F3D0;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: #065f46;
  font-weight: 500;
  margin: 0.75rem 0;
}
```

- [ ] **Step 3: Add JS for pricing card accordion**

```javascript
// ── Pricing accordion ─────────────────────────
var pricingCards = document.querySelectorAll('.pricing-v2-card');
pricingCards.forEach(function (card) {
  card.addEventListener('click', function () {
    var wasExpanded = card.classList.contains('expanded');
    pricingCards.forEach(function (c) { c.classList.remove('expanded'); });
    if (!wasExpanded) card.classList.add('expanded');
  });
});
```

- [ ] **Step 4: Verify in browser**

Click Starter → expands with features, token table, generous callout. Click Additional Agents → Starter closes, agents pricing table shows. Click Enterprise → shows services and spending cap info.

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/ && git commit -m "feat: section 6 — AIMEE product pricing with token limits and generous callout"
```

---

## Task 8: Section ⑦ — The Opportunity

**Files:**
- Modify: `~/.openclaw/ctg-core/showcase/index.html` (opportunity section)
- Modify: `~/.openclaw/ctg-core/showcase/style.css` (SWOT table, revenue table styles)

- [ ] **Step 1: Add Opportunity section HTML**

Section title: "Why this is a real business." Subtitle: "The numbers, the market, and the timing."

Expandable cards using same accordion pattern. Unit Economics is expanded by default (`.expanded` class on load):

1. **Unit Economics** (expanded by default) — table with Revenue $500, API $50-150, Infra ~$20, Ops ~$50, Total $120-220, Margin 55-75%. Note about early clients.

2. **Revenue Projections** (collapsed) — table: Month 1 $1,500 / Month 2 $5,000 / Month 6 $8-12K / Month 12 $15-25K. "$60K+ ARR by month 2" callout. "AIMEE sells AIMEE" note.

3. **Why Now** (collapsed) — 6 bullet points from spec.

4. **Market Potential** (collapsed) — 4 stats + placeholder note for future updates.

5. **SWOT** (collapsed) — 2x2 grid: Strengths, Weaknesses, Opportunities, Threats.

6. **News & Market Signals** (collapsed, roadmap) — styled as roadmap card: "On the roadmap: automated market intelligence feed powered by AIMEE agents."

- [ ] **Step 2: Add CSS for opportunity section**

```css
/* ── Opportunity Section ─────────────────────── */
.opp-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  margin-bottom: 0.75rem;
  transition: all 0.15s;
}
.opp-card:hover { box-shadow: var(--shadow-md); }

.opp-card-header {
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.opp-card-title {
  font-weight: 700;
  font-size: 0.95rem;
}

.opp-card-arrow {
  color: var(--text-muted);
  transition: transform 0.3s;
}
.opp-card.expanded .opp-card-arrow { transform: rotate(180deg); }

.opp-card-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
.opp-card.expanded .opp-card-body { max-height: 2000px; }

.opp-card-body-inner {
  padding: 0 1.5rem 1.5rem;
  border-top: 1px solid var(--border);
  margin: 0 1.5rem;
  padding-top: 1rem;
}

.opp-table {
  width: 100%;
  font-size: 0.85rem;
  border-collapse: collapse;
}
.opp-table td, .opp-table th {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.opp-table th { color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase; }

.swot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.swot-cell {
  background: var(--bg);
  border-radius: 8px;
  padding: 1rem;
}
.swot-cell-title {
  font-weight: 700;
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}
.swot-cell ul {
  padding-left: 1.25rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.swot-cell li { margin-bottom: 0.3rem; }

.roadmap-card {
  background: var(--accent-light);
  border: 1px dashed var(--accent);
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.85rem;
  color: var(--accent);
  text-align: center;
}
```

- [ ] **Step 3: Add JS for opportunity accordion**

```javascript
// ── Opportunity accordion ─────────────────────
var oppCards = document.querySelectorAll('.opp-card');
oppCards.forEach(function (card) {
  card.querySelector('.opp-card-header').addEventListener('click', function () {
    var wasExpanded = card.classList.contains('expanded');
    oppCards.forEach(function (c) { c.classList.remove('expanded'); });
    if (!wasExpanded) card.classList.add('expanded');
  });
});
```

- [ ] **Step 4: Verify in browser**

1. Unit Economics card is expanded on load
2. Click Revenue Projections → Unit Economics closes, projections table shows
3. SWOT shows 2x2 grid
4. News card shows roadmap styling

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/ && git commit -m "feat: section 7 — The Opportunity with financials, SWOT, market data"
```

---

## Task 9: Core JS — Wrap in IIFE + scroll tracking + Lucide init

**Files:**
- Refactor: `~/.openclaw/ctg-core/showcase/app.js`

**Important:** Tasks 4-8 each appended JS handlers to app.js incrementally. This task wraps everything in a single IIFE, adds scroll tracking and Lucide init at the top, and ensures all handlers are properly scoped. This is a refactor/consolidation, NOT a rewrite — all the handler code from Tasks 4-8 is already in the file.

- [ ] **Step 1: Write the complete app.js**

Combine all interaction handlers from Tasks 4-8 into a single IIFE:

```javascript
(function () {
  // ── Lucide icon initialization ──────────────────
  if (window.lucide) { lucide.createIcons(); }

  // ── Scroll-based sidebar highlighting ───────────
  var sections = document.querySelectorAll('.section');
  var navItems = document.querySelectorAll('.nav-item');
  var progressFill = document.getElementById('progress-fill');
  var progressLabel = document.getElementById('progress-label');

  function updateActiveSection() {
    var scrollPos = window.scrollY + 100;
    var activeIndex = 0;
    sections.forEach(function (section, i) {
      if (section.offsetTop <= scrollPos) { activeIndex = i; }
    });
    navItems.forEach(function (item, i) {
      item.classList.toggle('active', i === activeIndex);
    });
    var pct = ((activeIndex + 1) / sections.length) * 100;
    progressFill.style.width = pct + '%';
    progressLabel.textContent = (activeIndex + 1) + ' of ' + sections.length;
  }

  window.addEventListener('scroll', updateActiveSection);
  updateActiveSection();

  // ── Sidebar nav click ───────────────────────────
  navItems.forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.getElementById(item.getAttribute('data-section'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // ── Stack layers accordion (Section 2) ──────────
  var layerCards = document.querySelectorAll('.layer-card');
  layerCards.forEach(function (card) {
    card.addEventListener('click', function () {
      var wasExpanded = card.classList.contains('expanded');
      layerCards.forEach(function (c) { c.classList.remove('expanded'); });
      if (!wasExpanded) card.classList.add('expanded');
    });
  });

  // ── Org Chart 3-layer (Section 3) ───────────────
  // [Task 4 Step 6 code here]

  // ── Dual-layer expand (Sections 4 + 5) ──────────
  // [Task 5 Step 3 + Task 6 Step 2 code here]

  // ── Pricing accordion (Section 6) ───────────────
  // [Task 7 Step 3 code here]

  // ── Opportunity accordion (Section 7) ────────────
  // [Task 8 Step 3 code here]
})();
```

- [ ] **Step 2: Verify all interactions work end-to-end**

Walk through every section:
1. Scroll tracking updates sidebar
2. Stack layer accordion works
3. Org chart 3 layers all work
4. Architecture dual-layer expand + tech toggle
5. Deployment dual-layer expand + tech toggle
6. Product pricing accordion with token tables
7. Opportunity accordion with Unit Economics expanded by default

- [ ] **Step 3: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/app.js && git commit -m "feat: consolidated app.js with all interaction handlers"
```

---

## Task 10: CSS cleanup + responsive updates

**Files:**
- Rewrite: `~/.openclaw/ctg-core/showcase/style.css`

- [ ] **Step 1: Remove dead CSS**

Remove styles for removed sections:
- `.your-agents`, `.your-agent-card`, `.your-agent-name`, `.your-agent-model`, `.your-agent-role`
- `.dashboard-preview`, `.dashboard-preview-label`
- `.cta-box`, `.cta-price`, `.cta-text`, `.cta-button`
- `.timeline`, `.timeline-step`, `.timeline-week`, `.timeline-action`, `.timeline-bar`
- `.sidebar-label.for-you`
- Old `.org-chart`, `.org-row`, `.org-node`, `.org-connector`, `.org-branch` (replaced by `.org-v2-*`)
- Old `.pricing-row`, `.pricing-card` (replaced by `.pricing-v2-*`)

- [ ] **Step 2: Update responsive breakpoints**

At 900px:
- `.org-v2-grid.cols-3` → 2 columns
- `.pricing-v2-row` → 1 column
- `.deploy-flow` → vertical
- `.swot-grid` → 1 column

At 600px:
- `.org-v2-grid.cols-2` → 1 column
- `.org-v2-row` → flex-wrap with centered items

- [ ] **Step 3: Verify responsive layout**

Resize browser window. Check 1024px, 900px, 600px breakpoints. Org chart should stack, pricing cards should stack, deploy flow goes vertical.

- [ ] **Step 4: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/style.css && git commit -m "refactor: remove dead CSS, update responsive breakpoints for v2"
```

---

## Task 11: Final QA pass

**Files:** All showcase files

- [ ] **Step 1: Full walkthrough in browser**

Open `http://localhost:8080` and check every section against the spec. Verify:
- [ ] Section count: 7
- [ ] Sidebar: 7 nav items + 4 service links
- [ ] Progress bar: "X of 7"
- [ ] Vision: quote block, context, gap, why us, platform overview with Lucide icons + 🦞
- [ ] Stack: 4 accordion layers with Lucide icons
- [ ] Team: 3-layer org chart (curated → department → detail)
- [ ] Architecture: clickable services with dual-layer expand
- [ ] Deployment: clickable steps with dual-layer expand
- [ ] Product: 3 expandable pricing cards with token tables + generous callout
- [ ] Opportunity: 6 expandable cards, Unit Economics open by default

- [ ] **Step 2: Check console for JS errors**

Open browser dev tools → Console. No errors. Lucide icons all render.

- [ ] **Step 3: Check Lucide CDN fallback**

Disable network in dev tools, reload. Page should still be usable — text labels instead of broken icons.

- [ ] **Step 4: Final commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/ && git commit -m "chore: QA pass — CTG Showcase v2 complete"
```
