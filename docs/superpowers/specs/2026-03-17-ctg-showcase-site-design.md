# CTG Showcase Site — Design Spec

## Purpose

A single-page dashboard-style website for Charlie to show a friend/potential first client. Not an investor deck — a casual, visual walkthrough of what CTG built and how the friend can become client #1 at $500/month.

## Audience

Business-minded friend who has worked with technical people. Appreciates well-architected tech without needing to understand every implementation detail. Diagrams should look polished and convey sophistication.

## Tone

Business-first but proud of the tech. The full stack is the story, AIMEE is the punchline. "Look at what I built, and here's how it makes money."

## Design System

Matches the existing AIMEE Mission Control dashboard aesthetic:

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

## Layout

Single-page app with fixed sidebar navigation and scrollable content area.

### Sidebar (fixed, left, 220px)
- CTG logo + "AI Operations Platform" subtitle
- "The Story" section label with sections ①–⑥
- "For You" section label with sections ⑦–⑧
- Progress bar at bottom (current section / total)
- Active section highlighted with indigo left border + indigo background

### Content Area (scrollable, right)
- Section header: uppercase label + bold title
- Content in white cards with subtle shadows
- Diagrams in white cards with color-coded nodes
- Smooth scroll between sections, sidebar updates on scroll

### Responsive Behavior
- Desktop-first, optimized for laptop screens (1024px+)
- Below 900px: sidebar collapses to a horizontal top nav bar
- Below 600px: cards and pricing stack single-column
- Diagrams simplify to vertical layout on narrow viewports

## Sections

### ① The Vision
- **Headline:** "What if your company had AI employees?"
- **Body:** One paragraph — not chatbots, actual team members with roles, responsibilities, reporting chains, communication channels. Work 24/7, fraction of cost, improve weekly.
- **Diagram:** Horizontal 4-layer overview (Paperclip → OpenClaw → Lobster → QMD) with icons, names, one-line descriptions. Pastel-colored cards with matching borders.
- **Sub-labels:** Org + Budget / Agents + Channels / Pipelines + Gates / Search + Context

### ② The Stack
- **Headline:** "Four layers. One platform."
- **Subtitle:** "Click any layer to see what it does and how it connects."
- **Diagram:** Vertical stack of 4 clickable layer cards. Each has icon, name, layer badge, one-line description. Click to expand and reveal sub-components in a grid. Accordion behavior — only one layer expanded at a time. Expanded content appears inline, pushing lower layers down. 300ms slide transition.
- **Expanded content per layer:**
  - Paperclip: Agent Registry, Budget Gates, Task Tracking
  - OpenClaw: Multi-Agent Engine, Channel Bindings, Model Router
  - Lobster: Composable Pipelines, Approval Gates, Skill System
  - QMD: Hybrid Search, Markdown Indexing, Context Retrieval
- **Arrows:** Bidirectional (↕) between layers showing communication
- **Stats row:** 4 Layers | 100% Open Source | 1 cmd To Deploy | 24/7 Always On

### ③ The Team
- **Headline:** "Meet the team."
- **Diagram:** Org chart as a tree layout in white cards:
  ```
          Charlie (CEO)
              │
      ┌───────┼────────┐
      │       │        │
    Dude    Walter   Bonny
    (CGO)   (CTO)    (Jr)
      │
    ┌─┼──┬───┬───┐
  Scout Maude Donny Atlas
  ```
- **Node cards:** Agent name, role title, model name, department color-coded:
  - Operations = emerald
  - Engineering = indigo
  - PMO = amber
  - Support = pink
- **Interaction:** Click a node to expand and see personality, responsibilities, KPIs from their SOUL.md
- **Point:** This isn't one chatbot — it's a structured organization with governance
- **Note:** This shows Charlie's live org (the seller's team). Section ⑦ shows the buyer's starter org.

### ④ Architecture
- **Headline:** "Under the hood."
- **Diagram:** Technical architecture showing 5 Docker services and connections:
  - PostgreSQL (port 5432) → Paperclip (13100) → OpenClaw Gateway (28789) → Parent Relay (19090) → CTG Hub (9100)
  - Channel connections branching off Gateway: Slack, Teams, Telegram
  - Each service in a white card with port number and health endpoint
  - Connection lines with labeled arrows (REST, WebSocket, polling)
- **Style:** Clean engineering diagram — white cards, thin connection lines, small labels. Not a marketing graphic, an actual architecture diagram that happens to look good.

### ⑤ Deployment
- **Headline:** "From zero to live in one command."
- **Diagram:** Horizontal step-by-step flowchart:
  1. Copy CTG Core
  2. Run `setup.sh`
  3. Services start (Docker Compose)
  4. Connect Slack
  5. Agents go live
  6. Relay phones home to CTG Hub
- **Style:** Numbered step cards in a horizontal flow with connecting arrows. Green checkmarks on completed steps.
- **Point:** Repeatable, automated. Not a bespoke consulting engagement — a product deployment.

### ⑥ The Product
- **Headline:** "AIMEE — AI-Managed Employee Experience"
- **Pricing cards (3 across):**
  - Starter: $500/mo — 3 agents, Slack, managed SOPs, monitoring, dashboard
  - Additional agents: $200/mo each
  - Custom work: $150/hr
- **Unit economics card:**
  - Revenue: $500/mo
  - API cost: $50–150/mo
  - Infrastructure: ~$20/mo
  - Ops time: ~$50/mo
  - Total cost: ~$120–220/mo
  - Gross margin: 55–75%
- **What's included list:** Bullet points in a white card

### ⑦ Your Stack
- **Headline:** "Here's what yours looks like."
- **Personalized for the friend:**
  - His 3 starter agents shown in cards: Primary (Sonnet), Engineer (Opus), Dispatch (Haiku)
  - His channels: Slack
  - His dashboard: Mission Control (embed or screenshot of demo view)
  - His hub connection: Parent Relay → CTG Hub for managed support
- **Point:** Make it tangible. This isn't hypothetical — here's exactly what he'd get.
- **Note:** These are the 3 CTG Core starter agents, distinct from Charlie's own org shown in section ③. Dashboard uses a static screenshot, not a live iframe.

### ⑧ Let's Go
- **Headline:** "Want in?"
- **Timeline card:** Week 1: Deploy stack → Week 2: Customize agents → Week 3: Go live
- **What you get (bullet list):**
  - 3 AI agents in your Slack
  - Mission Control dashboard
  - Managed SOPs and monitoring
  - Remote support via hub
  - Weekly check-ins
- **CTA:** "$500/month. Let's build your team."
- **Tone:** No pressure, just clarity. Friend to friend.

## Technical Implementation

### Stack
- Vanilla HTML/CSS/JS (no build step, same as Mission Control)
- Single `index.html` with all sections
- `style.css` extending Mission Control's design system
- `app.js` for interactions (expand/collapse, scroll tracking, sidebar highlighting)
- No external dependencies except possibly a lightweight diagramming approach (CSS-only preferred)

### Diagrams
- Built with HTML/CSS (divs, flexbox, grid) where possible
- Simple inline SVG lines are acceptable for connection arrows in the architecture diagram (section ④)
- Color-coded nodes using the layer color CSS variables
- Click-to-expand interactions via JS class toggling

### Hosting
- Static files, can be served from anywhere (local file, simple HTTP server, or Azure Static Web Apps alongside Mission Control)
- No backend required — all content is static

### File Structure
```
~/.openclaw/ctg-core/showcase/
├── index.html      # Single page with all 8 sections
├── style.css       # Design system + section styles
└── app.js          # Scroll tracking, expand/collapse, sidebar state
```

## Success Criteria

1. Friend can click through all 8 sections and understand the business
2. Diagrams convey technical sophistication without requiring technical knowledge
3. Section ⑦ feels personalized — "this is what YOU would get"
4. Section ⑧ makes the ask clear without feeling like a sales pitch
5. The whole thing looks like it was built by a real software company
6. Loads instantly, no build step, no dependencies
