# CTG Showcase Site Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page dashboard-style showcase site for Charlie to walk a friend through the CTG/AIMEE platform and convert him to client #1 at $500/month.

**Architecture:** Vanilla HTML/CSS/JS static site with fixed sidebar navigation and 8 scrollable content sections. Design system matches the existing AIMEE Mission Control dashboard (light theme, indigo accent, white cards). Diagrams built with HTML/CSS + inline SVG for connection lines.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript. No build tools, no frameworks, no external dependencies.

**Spec:** `docs/superpowers/specs/2026-03-17-ctg-showcase-site-design.md`

**Reference:** Existing Mission Control dashboard at `~/.openclaw/ctg-core/dashboard/` (style.css for design system, index.html for structure patterns)

---

## File Structure

```
~/.openclaw/ctg-core/showcase/
├── index.html      # Single page — sidebar + all 8 content sections
├── style.css       # Design system (extends Mission Control) + all section styles
└── app.js          # Scroll tracking, sidebar state, accordion expand/collapse
```

---

### Task 1: Project Scaffold + Design System CSS

**Files:**
- Create: `~/.openclaw/ctg-core/showcase/style.css`
- Create: `~/.openclaw/ctg-core/showcase/index.html` (skeleton only)

- [ ] **Step 1: Create the showcase directory**

```bash
mkdir -p ~/.openclaw/ctg-core/showcase
```

- [ ] **Step 2: Write style.css with full design system**

Create `~/.openclaw/ctg-core/showcase/style.css` with:

```css
/* CTG Showcase — Design System
   Extends AIMEE Mission Control aesthetic */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* Core palette (matches Mission Control) */
  --accent: #4F46E5;
  --accent-light: #EEF2FF;
  --bg: #f8fafc;
  --card-bg: #ffffff;
  --text: #0f172a;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --border: #e2e8f0;
  --shadow: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --green: #22c55e;
  --radius: 12px;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;

  /* Layer colors */
  --layer-paperclip: #4F46E5;
  --layer-paperclip-light: #EEF2FF;
  --layer-paperclip-border: #C7D2FE;
  --layer-openclaw: #059669;
  --layer-openclaw-light: #ECFDF5;
  --layer-openclaw-border: #A7F3D0;
  --layer-lobster: #D97706;
  --layer-lobster-light: #FFFBEB;
  --layer-lobster-border: #FDE68A;
  --layer-qmd: #DB2777;
  --layer-qmd-light: #FDF2F8;
  --layer-qmd-border: #FBCFE8;

  /* Department colors */
  --dept-operations: #059669;
  --dept-operations-light: #ECFDF5;
  --dept-engineering: #4F46E5;
  --dept-engineering-light: #EEF2FF;
  --dept-pmo: #D97706;
  --dept-pmo-light: #FFFBEB;
  --dept-support: #DB2777;
  --dept-support-light: #FDF2F8;
}

body {
  font-family: var(--font);
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
  line-height: 1.5;
}

/* ── Layout Shell ──────────────────────────────── */

.shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 220px;
  height: 100vh;
  background: var(--card-bg);
  border-right: 1px solid var(--border);
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  z-index: 100;
  overflow-y: auto;
}

.sidebar-logo {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--accent);
  padding: 0.5rem;
}

.sidebar-subtitle {
  font-size: 0.7rem;
  color: var(--text-muted);
  padding: 0 0.5rem;
  margin-bottom: 1.5rem;
}

.sidebar-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
}

.sidebar-label.for-you {
  margin-top: 1rem;
}

.nav-item {
  display: block;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  text-decoration: none;
  margin-bottom: 0.2rem;
  border-left: 3px solid transparent;
  transition: all 0.15s;
  cursor: pointer;
}

.nav-item:hover {
  background: var(--bg);
  color: var(--text);
}

.nav-item.active {
  background: var(--accent-light);
  border-left-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.sidebar-progress {
  margin-top: auto;
  padding: 0.5rem;
}

.progress-bar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s;
}

.progress-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 0.3rem;
  text-align: center;
}

.content {
  margin-left: 220px;
  flex: 1;
  padding: 2rem;
  max-width: 960px;
}

/* ── Section Shared ────────────────────────────── */

.section {
  margin-bottom: 4rem;
  scroll-margin-top: 2rem;
}

.section-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 0.5rem;
}

.section-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.3rem;
}

.section-subtitle {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

/* ── Cards ─────────────────────────────────────── */

.card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  transition: box-shadow 0.15s;
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.card p {
  color: var(--text-secondary);
  line-height: 1.7;
}

.card p.body-text {
  color: #334155;
  font-size: 0.95rem;
}

/* ── Stats Row ─────────────────────────────────── */

.stats-row {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.stat-label {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.stat-divider {
  width: 1px;
  background: var(--border);
}

/* ── Layer Cards (Section 2) ───────────────────── */

.layer-card {
  background: var(--card-bg);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  margin-bottom: 0.5rem;
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: all 0.15s;
}

.layer-card:hover {
  box-shadow: var(--shadow-md);
}

.layer-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.layer-icon {
  border-radius: 10px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  flex-shrink: 0;
}

.layer-info {
  flex: 1;
}

.layer-name {
  font-weight: 700;
  font-size: 1rem;
}

.layer-badge {
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  margin-left: 0.5rem;
}

.layer-desc {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-top: 0.2rem;
}

.layer-arrow {
  font-size: 1.2rem;
  transition: transform 0.3s;
}

.layer-card.expanded .layer-arrow {
  transform: rotate(180deg);
}

.layer-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.layer-card.expanded .layer-body {
  max-height: 300px;
}

.layer-body-inner {
  padding-top: 1rem;
  margin-top: 1rem;
  border-top: 1px solid var(--border);
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
}

.sub-component {
  background: var(--bg);
  border-radius: 8px;
  padding: 0.75rem;
  text-align: center;
}

.sub-component-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text);
}

.sub-component-desc {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.layer-connector {
  text-align: center;
  color: var(--border);
  font-size: 1.2rem;
  margin: 0.25rem 0;
}

/* ── Org Chart (Section 3) ─────────────────────── */

.org-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.org-row {
  display: flex;
  gap: 1rem;
  justify-content: center;
  position: relative;
}

.org-node {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  text-align: center;
  min-width: 120px;
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: all 0.15s;
  border-top: 3px solid var(--border);
}

.org-node:hover {
  box-shadow: var(--shadow-md);
}

.org-node.dept-operations { border-top-color: var(--dept-operations); }
.org-node.dept-engineering { border-top-color: var(--dept-engineering); }
.org-node.dept-pmo { border-top-color: var(--dept-pmo); }
.org-node.dept-support { border-top-color: var(--dept-support); }
.org-node.dept-ceo { border-top-color: var(--accent); }

.org-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text);
}

.org-role {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.org-model {
  font-size: 0.65rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.org-connector {
  text-align: center;
  color: var(--border);
  font-size: 1.2rem;
}

.org-branch {
  display: flex;
  justify-content: center;
  position: relative;
  padding-top: 1.5rem;
}

.org-branch::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 0;
  height: 1.5rem;
  border-left: 2px solid var(--border);
}

.org-branch::after {
  content: '';
  position: absolute;
  top: 1.5rem;
  height: 0;
  border-top: 2px solid var(--border);
}

.org-branch.children-3::after {
  left: calc(50% - 140px);
  width: 280px;
}

.org-branch.children-4::after {
  left: calc(50% - 200px);
  width: 400px;
}

.org-branch .org-node {
  position: relative;
}

.org-branch .org-node::before {
  content: '';
  position: absolute;
  top: -1rem;
  left: 50%;
  width: 0;
  height: 1rem;
  border-left: 2px solid var(--border);
}

.dept-legend {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  margin-top: 1.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.dept-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
  margin-right: 0.4rem;
  vertical-align: middle;
}

.org-detail {
  display: none;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
  text-align: left;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.org-node.expanded .org-detail {
  display: block;
}

/* ── Architecture (Section 4) ──────────────────── */

.arch-diagram {
  position: relative;
  padding: 2rem 0;
}

.arch-services {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.arch-service {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem;
  text-align: center;
  min-width: 130px;
  box-shadow: var(--shadow);
}

.arch-service-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text);
}

.arch-service-port {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-family: monospace;
}

.arch-service-health {
  font-size: 0.65rem;
  color: var(--green);
  margin-top: 0.3rem;
}

.arch-channels {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
}

.arch-channel {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.arch-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  text-align: center;
  margin: 1rem 0 0.5rem;
}

.arch-connector {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  color: var(--border);
}

.arch-connector-line {
  width: 40px;
  height: 0;
  border-top: 2px solid var(--border);
}

.arch-connector-label {
  font-size: 0.6rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.arch-row {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.arch-vertical-line {
  width: 0;
  height: 30px;
  border-left: 2px solid var(--border);
  margin: 0 auto;
}

/* Dashboard preview internals */
.mock-header {
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 8px 8px 0 0;
}

.mock-header-logo {
  font-weight: 700;
  color: var(--accent);
  font-size: 0.8rem;
}

.mock-header-badge {
  font-size: 0.55rem;
  font-weight: 700;
  background: #DCFCE7;
  color: #16a34a;
  padding: 1px 6px;
  border-radius: 8px;
  text-transform: uppercase;
}

.mock-cards-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  padding: 0.75rem;
}

.mock-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.5rem;
  text-align: center;
}

.mock-card-label {
  font-size: 0.55rem;
  color: var(--text-muted);
  text-transform: uppercase;
}

.mock-card-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
}

.mock-card-sub {
  font-size: 0.55rem;
  color: var(--text-muted);
}

/* ── Deployment Steps (Section 5) ──────────────── */

.deploy-flow {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 1rem 0;
}

.deploy-step {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem;
  min-width: 140px;
  text-align: center;
  box-shadow: var(--shadow);
  flex-shrink: 0;
}

.deploy-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 700;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 0.5rem;
}

.deploy-step.complete .deploy-step-num {
  background: #DCFCE7;
  color: var(--green);
}

.deploy-step-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
}

.deploy-step-desc {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
}

.deploy-arrow {
  display: flex;
  align-items: center;
  color: var(--border);
  font-size: 1.2rem;
  flex-shrink: 0;
}

/* ── Pricing (Section 6) ──────────────────────── */

.pricing-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.pricing-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  text-align: center;
  box-shadow: var(--shadow);
}

.pricing-card.featured {
  border-color: var(--accent);
  border-width: 2px;
}

.pricing-amount {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text);
}

.pricing-period {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.pricing-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  margin-top: 0.5rem;
}

.pricing-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.3rem;
}

.economics-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.econ-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
}

.econ-label {
  color: var(--text-secondary);
}

.econ-value {
  font-weight: 600;
  color: var(--text);
}

.econ-value.green {
  color: var(--green);
}

.included-list {
  list-style: none;
  padding: 0;
}

.included-list li {
  padding: 0.4rem 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.included-list li::before {
  content: '✓';
  color: var(--green);
  font-weight: 700;
}

/* ── Your Stack (Section 7) ────────────────────── */

.your-agents {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.your-agent-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  text-align: center;
  box-shadow: var(--shadow);
  border-top: 3px solid var(--accent);
}

.your-agent-name {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text);
}

.your-agent-model {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
}

.your-agent-role {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.4rem;
}

.dashboard-preview {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  margin-top: 1.5rem;
}

.dashboard-preview-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 0.5rem;
}

/* ── CTA (Section 8) ──────────────────────────── */

.timeline {
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
}

.timeline-step {
  flex: 1;
  text-align: center;
  padding: 1rem;
  position: relative;
}

.timeline-week {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.timeline-action {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  margin-top: 0.3rem;
}

.timeline-bar {
  height: 4px;
  background: var(--accent-light);
  margin-top: 0.75rem;
  border-radius: 2px;
}

.timeline-step:first-child .timeline-bar {
  border-radius: 2px 0 0 2px;
}

.timeline-step:last-child .timeline-bar {
  border-radius: 0 2px 2px 0;
}

.cta-box {
  background: var(--accent-light);
  border: 2px solid var(--accent);
  border-radius: var(--radius);
  padding: 2rem;
  text-align: center;
}

.cta-price {
  font-size: 2rem;
  font-weight: 700;
  color: var(--accent);
}

.cta-text {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
}

/* ── Responsive ────────────────────────────────── */

@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: auto;
    flex-direction: row;
    padding: 0.75rem 1rem;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
    gap: 0.5rem;
    align-items: center;
  }

  .sidebar-logo { margin-right: 1rem; }
  .sidebar-subtitle, .sidebar-label, .sidebar-progress { display: none; }

  .nav-item {
    white-space: nowrap;
    padding: 0.4rem 0.75rem;
    border-left: none;
    border-bottom: 3px solid transparent;
    margin-bottom: 0;
  }

  .nav-item.active {
    border-left-color: transparent;
    border-bottom-color: var(--accent);
  }

  .content {
    margin-left: 0;
    margin-top: 56px;
    padding: 1.5rem;
  }

  .pricing-row,
  .your-agents {
    grid-template-columns: 1fr;
  }

  .deploy-flow {
    flex-direction: column;
  }

  .deploy-arrow {
    transform: rotate(90deg);
    justify-content: center;
  }

  .layer-body-inner {
    grid-template-columns: 1fr;
  }

  .arch-services {
    flex-direction: column;
    align-items: center;
  }
}

@media (max-width: 600px) {
  .content {
    padding: 1rem;
  }

  .section-title {
    font-size: 1.2rem;
  }

  .pricing-row,
  .your-agents,
  .economics-row {
    grid-template-columns: 1fr;
  }

  .org-row {
    flex-direction: column;
    align-items: center;
  }

  .stats-row {
    flex-direction: column;
    gap: 1rem;
  }

  .stat-divider {
    width: 100%;
    height: 1px;
  }

  .timeline {
    flex-direction: column;
  }

  .mock-cards-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

- [ ] **Step 3: Write index.html skeleton**

Create `~/.openclaw/ctg-core/showcase/index.html` with just the shell layout (sidebar + empty content area) and placeholder section divs. No section content yet — that comes in subsequent tasks.

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
    <!-- Sidebar -->
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

      <div class="sidebar-label for-you">For You</div>
      <a class="nav-item" data-section="your-stack">⑦ Your Stack</a>
      <a class="nav-item" data-section="lets-go">⑧ Let's Go</a>

      <div class="sidebar-progress">
        <div class="progress-bar">
          <div class="progress-fill" id="progress-fill" style="width: 12.5%"></div>
        </div>
        <div class="progress-label" id="progress-label">1 of 8</div>
      </div>
    </nav>

    <!-- Content -->
    <main class="content">
      <div class="section" id="vision"></div>
      <div class="section" id="stack"></div>
      <div class="section" id="team"></div>
      <div class="section" id="architecture"></div>
      <div class="section" id="deployment"></div>
      <div class="section" id="product"></div>
      <div class="section" id="your-stack"></div>
      <div class="section" id="lets-go"></div>
    </main>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Verify scaffold loads in browser**

```bash
cd ~/.openclaw/ctg-core/showcase && python3 -m http.server 8080 &
```

Open `http://localhost:8080` — should see sidebar with nav items on white background. Kill the server after verifying.

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/index.html showcase/style.css
git commit -m "feat(showcase): scaffold project with design system CSS and shell layout"
```

---

### Task 2: Section ① The Vision + Section ② The Stack

**Files:**
- Modify: `~/.openclaw/ctg-core/showcase/index.html` (add section content)

- [ ] **Step 1: Add Section ① content to index.html**

Replace the empty `<div class="section" id="vision"></div>` with:

```html
<div class="section" id="vision">
  <div class="section-label">① The Vision</div>
  <div class="section-title">What if your company had AI employees?</div>

  <div class="card">
    <p class="body-text">Not chatbots. Not copilots. Actual team members with roles, responsibilities, reporting chains, and communication channels — that work 24/7, cost a fraction of a human hire, and get better every week.</p>
    <p style="margin-top: 1rem;">We built the infrastructure to run an AI-native company. Then we packaged it so any business can have the same thing.</p>
  </div>

  <div class="card">
    <div class="section-label" style="margin-bottom: 1rem;">Platform Overview</div>
    <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; align-items: center;">
      <div style="background: var(--layer-paperclip-light); border: 1px solid var(--layer-paperclip-border); border-radius: 10px; padding: 1rem 1.5rem; text-align: center; min-width: 120px;">
        <div style="font-size: 1.5rem; margin-bottom: 0.3rem;">📋</div>
        <div style="color: var(--layer-paperclip); font-size: 0.85rem; font-weight: 600;">Paperclip</div>
        <div style="color: var(--text-muted); font-size: 0.7rem;">The Company</div>
      </div>
      <div style="color: var(--border); font-size: 1.2rem;">→</div>
      <div style="background: var(--layer-openclaw-light); border: 1px solid var(--layer-openclaw-border); border-radius: 10px; padding: 1rem 1.5rem; text-align: center; min-width: 120px;">
        <div style="font-size: 1.5rem; margin-bottom: 0.3rem;">🤖</div>
        <div style="color: var(--layer-openclaw); font-size: 0.85rem; font-weight: 600;">OpenClaw</div>
        <div style="color: var(--text-muted); font-size: 0.7rem;">The Workers</div>
      </div>
      <div style="color: var(--border); font-size: 1.2rem;">→</div>
      <div style="background: var(--layer-lobster-light); border: 1px solid var(--layer-lobster-border); border-radius: 10px; padding: 1rem 1.5rem; text-align: center; min-width: 120px;">
        <div style="font-size: 1.5rem; margin-bottom: 0.3rem;">🔄</div>
        <div style="color: var(--layer-lobster); font-size: 0.85rem; font-weight: 600;">Lobster</div>
        <div style="color: var(--text-muted); font-size: 0.7rem;">The Workflows</div>
      </div>
      <div style="color: var(--border); font-size: 1.2rem;">→</div>
      <div style="background: var(--layer-qmd-light); border: 1px solid var(--layer-qmd-border); border-radius: 10px; padding: 1rem 1.5rem; text-align: center; min-width: 120px;">
        <div style="font-size: 1.5rem; margin-bottom: 0.3rem;">🧠</div>
        <div style="color: var(--layer-qmd); font-size: 0.85rem; font-weight: 600;">QMD</div>
        <div style="color: var(--text-muted); font-size: 0.7rem;">The Memory</div>
      </div>
    </div>
    <div style="display: flex; justify-content: center; gap: 2rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border);">
      <div style="text-align: center;">
        <div style="font-size: 0.75rem; font-weight: 600; color: var(--text);">Org + Budget</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">defines the company</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 0.75rem; font-weight: 600; color: var(--text);">Agents + Channels</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">does the work</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 0.75rem; font-weight: 600; color: var(--text);">Pipelines + Gates</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">automates processes</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 0.75rem; font-weight: 600; color: var(--text);">Search + Context</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">remembers everything</div>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add Section ② content to index.html**

Replace the empty `<div class="section" id="stack"></div>`. Here is the template for one layer card — repeat this pattern for all 4 layers, changing colors, names, icons, badges, and sub-components:

```html
<div class="section" id="stack">
  <div class="section-label">② The Stack</div>
  <div class="section-title">Four layers. One platform.</div>
  <div class="section-subtitle">Click any layer to see what it does and how it connects.</div>

  <div style="max-width: 700px; margin: 0 auto;">
    <!-- Layer 1: Paperclip -->
    <div class="layer-card" style="border-color: var(--layer-paperclip);">
      <div class="layer-header">
        <div class="layer-icon" style="background: var(--layer-paperclip-light);">📋</div>
        <div class="layer-info">
          <div>
            <span class="layer-name" style="color: var(--layer-paperclip);">Paperclip</span>
            <span class="layer-badge" style="background: var(--layer-paperclip-light); color: var(--layer-paperclip);">LAYER 1</span>
          </div>
          <div class="layer-desc">The company brain — org charts, budgets, approvals, audit trails</div>
        </div>
        <div class="layer-arrow" style="color: var(--layer-paperclip-border);">▼</div>
      </div>
      <div class="layer-body">
        <div class="layer-body-inner">
          <div class="sub-component">
            <div class="sub-component-name">Agent Registry</div>
            <div class="sub-component-desc">Who works here</div>
          </div>
          <div class="sub-component">
            <div class="sub-component-name">Budget Gates</div>
            <div class="sub-component-desc">Cost controls</div>
          </div>
          <div class="sub-component">
            <div class="sub-component-name">Task Tracking</div>
            <div class="sub-component-desc">Issue → resolution</div>
          </div>
        </div>
      </div>
    </div>

    <div class="layer-connector">↕</div>

    <!-- Layer 2: OpenClaw — same pattern, use --layer-openclaw colors -->
    <!-- Icon: 🤖, Name: OpenClaw, Badge: LAYER 2 -->
    <!-- Desc: The workforce — AI agents on Slack, Teams, Telegram -->
    <!-- Sub-components: Multi-Agent Engine / Channel Bindings / Model Router -->

    <div class="layer-connector">↕</div>

    <!-- Layer 3: Lobster — same pattern, use --layer-lobster colors -->
    <!-- Icon: 🔄, Name: Lobster, Badge: LAYER 3 -->
    <!-- Desc: The process engine — composable pipelines with approval gates -->
    <!-- Sub-components: Composable Pipelines / Approval Gates / Skill System -->

    <div class="layer-connector">↕</div>

    <!-- Layer 4: QMD — same pattern, use --layer-qmd colors -->
    <!-- Icon: 🧠, Name: QMD, Badge: LAYER 4 -->
    <!-- Desc: The knowledge layer — local markdown search with hybrid retrieval -->
    <!-- Sub-components: Hybrid Search / Markdown Indexing / Context Retrieval -->

    <!-- Stats row -->
    <div class="card" style="margin-top: 1.5rem;">
      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-value" style="color: var(--layer-paperclip);">4</div>
          <div class="stat-label">Layers</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <div class="stat-value" style="color: var(--layer-openclaw);">100%</div>
          <div class="stat-label">Open Source</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <div class="stat-value" style="color: var(--layer-lobster);">1 cmd</div>
          <div class="stat-label">To Deploy</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <div class="stat-value" style="color: var(--layer-qmd);">24/7</div>
          <div class="stat-label">Always On</div>
        </div>
      </div>
    </div>
  </div>
</div>
```

Implementer must fill in the 3 commented-out layers following the exact same pattern as Paperclip.

- [ ] **Step 3: Verify both sections render correctly in browser**

- [ ] **Step 4: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/index.html
git commit -m "feat(showcase): add Vision and Stack sections with interactive layer diagrams"
```

---

### Task 3: Section ③ The Team (Org Chart)

**Files:**
- Modify: `~/.openclaw/ctg-core/showcase/index.html` (add section content)

- [ ] **Step 1: Add Section ③ content to index.html**

Replace the empty `<div class="section" id="team"></div>` with the org chart tree using `.org-chart`, `.org-row`, `.org-node`, `.org-connector` classes.

Structure:
- Row 1: Charlie (CEO) — single node, `dept-ceo` class
- Connector: │
- Row 2: Dude (CGO, `dept-operations`), Walter (CTO, `dept-engineering`), Bonny (Jr, `dept-support`)
- Connector: │ (under Dude only)
- Row 3: Scout (`dept-pmo`), Maude (`dept-pmo`), Donny (`dept-pmo`), Atlas (`dept-pmo`)

Each node shows: name, role, model (e.g., "Claude Sonnet 4.6"), and a hidden `.org-detail` div with personality/responsibilities text that shows on click.

Include a small legend card below the org chart showing department colors.

- [ ] **Step 2: Verify org chart renders correctly**

- [ ] **Step 3: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/index.html
git commit -m "feat(showcase): add Team section with interactive org chart"
```

---

### Task 4: Section ④ Architecture + Section ⑤ Deployment

**Files:**
- Modify: `~/.openclaw/ctg-core/showcase/index.html` (add section content)

- [ ] **Step 1: Add Section ④ content to index.html**

Replace the empty `<div class="section" id="architecture"></div>` with the architecture diagram. Use the new `.arch-row`, `.arch-service`, `.arch-connector`, `.arch-vertical-line` classes.

Layout structure — rows connected by labeled connectors:

```html
<div class="section" id="architecture">
  <div class="section-label">④ Architecture</div>
  <div class="section-title">Under the hood.</div>

  <div class="card">
    <div class="arch-diagram">
      <!-- Row 1: Core services -->
      <div class="arch-row">
        <div class="arch-service">
          <div class="arch-service-name">PostgreSQL</div>
          <div class="arch-service-port">:5432</div>
          <div class="arch-service-health">● healthy</div>
        </div>
        <div class="arch-connector">
          <div class="arch-connector-line"></div>
          <div class="arch-connector-label">SQL</div>
          <div class="arch-connector-line"></div>
        </div>
        <div class="arch-service">
          <div class="arch-service-name">Paperclip</div>
          <div class="arch-service-port">:13100</div>
          <div class="arch-service-health">● healthy</div>
        </div>
        <div class="arch-connector">
          <div class="arch-connector-line"></div>
          <div class="arch-connector-label">REST</div>
          <div class="arch-connector-line"></div>
        </div>
        <div class="arch-service">
          <div class="arch-service-name">OpenClaw Gateway</div>
          <div class="arch-service-port">:28789</div>
          <div class="arch-service-health">● healthy</div>
        </div>
      </div>

      <!-- Vertical connector from Gateway down -->
      <div class="arch-vertical-line"></div>
      <div style="text-align: center;"><span class="arch-connector-label">WebSocket</span></div>
      <div class="arch-vertical-line"></div>

      <!-- Row 2: Relay + Hub -->
      <div class="arch-row">
        <div class="arch-service">
          <div class="arch-service-name">Parent Relay</div>
          <div class="arch-service-port">:19090</div>
          <div class="arch-service-health">● healthy</div>
        </div>
        <div class="arch-connector">
          <div class="arch-connector-line"></div>
          <div class="arch-connector-label">Polling</div>
          <div class="arch-connector-line"></div>
        </div>
        <div class="arch-service">
          <div class="arch-service-name">CTG Hub</div>
          <div class="arch-service-port">:9100</div>
          <div class="arch-service-health">● healthy</div>
        </div>
      </div>

      <!-- Channel connections from Gateway -->
      <div class="arch-label">Channels</div>
      <div class="arch-channels">
        <div class="arch-channel">💬 Slack</div>
        <div class="arch-channel">👥 Teams</div>
        <div class="arch-channel">✈️ Telegram</div>
      </div>
    </div>
  </div>
</div>
```

This uses CSS-only connectors (`.arch-connector-line` borders + `.arch-vertical-line` borders) — no SVG needed.

- [ ] **Step 2: Add Section ⑤ content to index.html**

Replace the empty `<div class="section" id="deployment"></div>` with the deployment flowchart. Use `.deploy-flow`, `.deploy-step`, `.deploy-arrow` classes.

6 steps in a horizontal flow:
1. Copy CTG Core (complete)
2. Run setup.sh (complete)
3. Services Start (complete)
4. Connect Slack
5. Agents Go Live
6. Relay Phones Home

Steps 1-3 get the `.complete` class (green number circle). Steps 4-6 stay indigo. Arrows between each step.

- [ ] **Step 3: Verify both sections render correctly**

- [ ] **Step 4: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/index.html
git commit -m "feat(showcase): add Architecture and Deployment sections with diagrams"
```

---

### Task 5: Section ⑥ The Product + Section ⑦ Your Stack

**Files:**
- Modify: `~/.openclaw/ctg-core/showcase/index.html` (add section content)

- [ ] **Step 1: Add Section ⑥ content to index.html**

Replace the empty `<div class="section" id="product"></div>` with:
- Pricing row (3 cards): Starter $500/mo (`.featured`), Additional Agents $200/mo, Custom Work $150/hr
- Unit economics card with `.economics-row` grid — left column: Revenue $500, API Cost $50-150, Infra ~$20, Ops ~$50. Right column: Total Cost $120-220, Gross Margin 55-75% (green)
- What's included card with `.included-list` — 3 agents, Slack integration, managed SOPs, monitoring, dashboard, remote support

- [ ] **Step 2: Add Section ⑦ content to index.html**

Replace the empty `<div class="section" id="your-stack"></div>` with:
- Note: "These are the 3 CTG Core starter agents — your dedicated AI team."
- Agent cards (3 across) using `.your-agents` grid: Primary (Claude Sonnet 4.6, "Comms, triage, delegation"), Engineer (Claude Opus 4.6, "Code, architecture, analysis"), Dispatch (Claude Haiku 4.5, "Health checks, cron, routing")
- Channels card: white card with "Your Channels" label, showing a Slack icon/badge with "Connected" status (green dot)
- Hub connection card: white card with "Remote Management" label, showing Parent Relay → CTG Hub flow with "Managed by CTG" badge. Use `.arch-connector` classes from Section 4 for the arrow.
- Dashboard preview card with `.dashboard-preview` — use the new `.mock-header`, `.mock-cards-row`, `.mock-card` classes:

```html
<div class="dashboard-preview">
  <div class="dashboard-preview-label">Your Dashboard</div>
  <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
    <div class="mock-header">
      <span class="mock-header-logo">AIMEE</span>
      <span style="color: var(--text-muted); font-size: 0.75rem;">Mission Control</span>
      <span class="mock-header-badge">LIVE</span>
    </div>
    <div class="mock-cards-row">
      <div class="mock-card">
        <div class="mock-card-label">Services</div>
        <div class="mock-card-value">3/3</div>
        <div class="mock-card-sub">All healthy</div>
      </div>
      <div class="mock-card">
        <div class="mock-card-label">Agents</div>
        <div class="mock-card-value">3</div>
        <div class="mock-card-sub">Registered</div>
      </div>
      <div class="mock-card">
        <div class="mock-card-label">Uptime</div>
        <div class="mock-card-value">99.9%</div>
        <div class="mock-card-sub">Running 14d</div>
      </div>
      <div class="mock-card">
        <div class="mock-card-label">Relay</div>
        <div class="mock-card-value" style="font-size: 0.85rem;">OK</div>
        <div class="mock-card-sub">Hub connected</div>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Verify both sections render correctly**

- [ ] **Step 4: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/index.html
git commit -m "feat(showcase): add Product and Your Stack sections with pricing and preview"
```

---

### Task 6: Section ⑧ Let's Go (CTA)

**Files:**
- Modify: `~/.openclaw/ctg-core/showcase/index.html` (add section content)

- [ ] **Step 1: Add Section ⑧ content to index.html**

Replace the empty `<div class="section" id="lets-go"></div>` with:
- Timeline card using `.timeline`: Week 1 Deploy → Week 2 Customize → Week 3 Go Live
- What you get card with `.included-list`: 3 AI agents in your Slack, Mission Control dashboard, Managed SOPs and monitoring, Remote support via hub, Weekly check-ins
- CTA box using `.cta-box`: "$500/month" in large indigo text, "Let's build your team." subtitle

- [ ] **Step 2: Verify section renders correctly**

- [ ] **Step 3: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/index.html
git commit -m "feat(showcase): add Let's Go CTA section with timeline and pricing"
```

---

### Task 7: App.js — Scroll Tracking, Sidebar State, Accordion

**Files:**
- Create: `~/.openclaw/ctg-core/showcase/app.js`

- [ ] **Step 1: Write app.js with all interactions**

```javascript
// CTG Showcase — Interactions

(function () {
  // ── Scroll-based sidebar highlighting ─────────────────
  var sections = document.querySelectorAll('.section');
  var navItems = document.querySelectorAll('.nav-item');
  var progressFill = document.getElementById('progress-fill');
  var progressLabel = document.getElementById('progress-label');

  function updateActiveSection() {
    var scrollPos = window.scrollY + 100;
    var activeIndex = 0;

    sections.forEach(function (section, i) {
      if (section.offsetTop <= scrollPos) {
        activeIndex = i;
      }
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

  // ── Sidebar click to scroll ───────────────────────────
  navItems.forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      var sectionId = item.getAttribute('data-section');
      var target = document.getElementById(sectionId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ── Layer accordion (Section 2) ───────────────────────
  var layerCards = document.querySelectorAll('.layer-card');

  layerCards.forEach(function (card) {
    card.addEventListener('click', function () {
      var wasExpanded = card.classList.contains('expanded');

      // Close all
      layerCards.forEach(function (c) {
        c.classList.remove('expanded');
      });

      // Toggle clicked
      if (!wasExpanded) {
        card.classList.add('expanded');
      }
    });
  });

  // ── Org node expand (Section 3) ───────────────────────
  var orgNodes = document.querySelectorAll('.org-node');

  orgNodes.forEach(function (node) {
    node.addEventListener('click', function () {
      node.classList.toggle('expanded');
    });
  });
})();
```

- [ ] **Step 2: Verify all interactions work**

Test in browser:
- Scroll through page → sidebar highlights current section, progress bar updates
- Click sidebar items → smooth scroll to section
- Click layer cards in Section 2 → accordion expand/collapse
- Click org nodes in Section 3 → detail panel toggles

- [ ] **Step 3: Commit**

```bash
cd ~/.openclaw/ctg-core && git add showcase/app.js
git commit -m "feat(showcase): add scroll tracking, sidebar nav, and accordion interactions"
```

---

### Task 8: Final Polish and Verification

**Files:**
- Modify: `~/.openclaw/ctg-core/showcase/index.html` (minor tweaks)
- Modify: `~/.openclaw/ctg-core/showcase/style.css` (minor tweaks)

- [ ] **Step 1: Test full page flow**

Start local server and verify all 8 sections load, all interactions work, sidebar tracks correctly, responsive behavior works at 900px and 600px breakpoints.

```bash
cd ~/.openclaw/ctg-core/showcase && python3 -m http.server 8080
```

- [ ] **Step 2: Fix any visual issues**

Adjust spacing, alignment, or color issues found during testing. Common things to check:
- Card spacing consistency
- Diagram alignment on different screen widths
- Progress bar accuracy
- Section scroll-margin alignment with sidebar highlighting

- [ ] **Step 3: Commit final polish**

```bash
cd ~/.openclaw/ctg-core && git add showcase/
git commit -m "feat(showcase): polish layout, spacing, and responsive behavior"
```
