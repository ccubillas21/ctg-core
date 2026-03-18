const CONFIG = {
  // ── View Modes ──────────────────────────────────────────
  // 'live' = Charlie's real stack, 'demo' = client demo deployment
  defaultView: 'live',

  // ── Public URLs (cubillastechnologygroup.com subdomains) ──
  publicUrls: {
    paperclip: 'https://paperclip.cubillastechnologygroup.com',
    gateway: 'https://gateway.cubillastechnologygroup.com',
    hub: 'https://hub.cubillastechnologygroup.com',
    about: 'https://about.cubillastechnologygroup.com',
  },

  // ── Live Environment (Charlie's actual stack) ───────────
  live: {
    apiUrls: {
      relay: 'http://localhost:19090',
      paperclip: 'http://localhost:3100',
      hub: 'http://localhost:9100',
      gateway: 'http://localhost:18789',
    },
    gatewayToken: '3f3982d2c0491f9bc162e80a092ff97e4b3af10484b2795d',
    hubToken: '',
    companyId: '057eb2f2-6da0-4637-b667-0f3487da3e1e',
    paperclipApiKey: 'pcp_6721c4b370e3c6a03d4c3fd5a8464c8a9f17b5d4f453fe18',
    label: 'CTG Live',
    agents: [
      { id: 'worker', name: 'Dude (Worker)', model: 'claude-sonnet-4-6', provider: 'Anthropic', role: 'CGO — Comms, Slack, Teams' },
      { id: 'cto', name: 'Walter (CTO)', model: 'claude-opus-4-6', provider: 'Anthropic', role: 'Architecture, deep work' },
      { id: 'jr', name: 'Bonny (Jr)', model: 'qwen3.5-plus', provider: 'Qwen', role: 'Admin, Slack, support' },
      { id: 'docker-2', name: 'Docker VP', model: 'claude-sonnet-4-6', provider: 'Anthropic', role: 'Container orchestration' },
      { id: 'axiom', name: 'Axiom', model: 'claude-sonnet-4-6', provider: 'Anthropic', role: 'Governance, compliance' },
      { id: 'ops', name: 'Ops', model: 'nemotron-3-nano', provider: 'Ollama', role: 'Heartbeats, cron, health' },
      { id: 'sentinel', name: 'Sentinel', model: 'nemotron-3-nano', provider: 'Ollama', role: 'Security monitoring' },
      { id: 'herald', name: 'Herald', model: 'nemotron-3-nano', provider: 'Ollama', role: 'Notifications, alerts' },
      { id: 'oracle', name: 'Oracle', model: 'nemotron-3-nano', provider: 'Ollama', role: 'Knowledge, QMD search' },
      { id: 'scout', name: 'Scout', model: 'nemotron-3-nano', provider: 'Ollama', role: 'Routing, discovery' },
      { id: 'maude', name: 'Maude', model: 'nemotron-3-nano', provider: 'Ollama', role: 'Scheduling, calendar' },
      { id: 'donny', name: 'Donny', model: 'nemotron-3-nano', provider: 'Ollama', role: 'Logging, analytics' },
      { id: 'atlas', name: 'Atlas', model: 'nemotron-3-nano', provider: 'Ollama', role: 'Infrastructure mapping' },
      { id: 'windows', name: 'Windows', model: 'nemotron-3-nano', provider: 'Ollama', role: 'Windows integration' },
    ],
  },

  // ── Demo Environment (client deployment preview) ────────
  demo: {
    apiUrls: {
      relay: 'http://localhost:19090',
      paperclip: 'http://localhost:13100',
      hub: 'http://localhost:9100',
      gateway: 'http://localhost:28789',
    },
    hubToken: '',
    companyId: '',
    label: 'Demo Deployment',
    agents: [
      { id: 'primary', name: 'Primary', model: 'claude-sonnet-4-6', provider: 'Anthropic', role: 'Comms, triage, delegation' },
      { id: 'engineer', name: 'Engineer', model: 'claude-opus-4-6', provider: 'Anthropic', role: 'Code, architecture, analysis' },
      { id: 'dispatch', name: 'Dispatch', model: 'claude-haiku-4-5', provider: 'Anthropic', role: 'Health checks, cron, routing' },
    ],
  },

  // ── Shared Settings ─────────────────────────────────────
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

  // Mock costs — demo view uses these, live view will use real numbers you provide
  mockCosts: {
    demo: {
      agents: [
        { name: 'Primary', model: 'claude-sonnet-4-6', provider: 'Anthropic', cost: 12.40 },
        { name: 'Engineer', model: 'claude-opus-4-6', provider: 'Anthropic', cost: 34.20 },
        { name: 'Dispatch', model: 'claude-haiku-4-5', provider: 'Anthropic', cost: 2.10 },
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
      revenue: 500,
    },
    live: {
      // PLACEHOLDER — Charlie will replace with real numbers before the meeting
      agents: [
        { name: 'Walter (CTO)', model: 'claude-opus-4-6', provider: 'Anthropic', cost: 0 },
        { name: 'Dude (Worker)', model: 'claude-sonnet-4-6', provider: 'Anthropic', cost: 0 },
        { name: 'Bonny (Jr)', model: 'qwen3.5-plus', provider: 'Qwen', cost: 0 },
        { name: 'Docker VP', model: 'claude-sonnet-4-6', provider: 'Anthropic', cost: 0 },
        { name: 'Axiom', model: 'claude-sonnet-4-6', provider: 'Anthropic', cost: 0 },
        { name: 'Ops', model: 'nemotron-3-nano', provider: 'Ollama', cost: 0 },
        { name: 'Sentinel', model: 'nemotron-3-nano', provider: 'Ollama', cost: 0 },
        { name: 'Herald', model: 'nemotron-3-nano', provider: 'Ollama', cost: 0 },
        { name: 'Oracle', model: 'nemotron-3-nano', provider: 'Ollama', cost: 0 },
        { name: 'Scout', model: 'nemotron-3-nano', provider: 'Ollama', cost: 0 },
        { name: 'Maude', model: 'nemotron-3-nano', provider: 'Ollama', cost: 0 },
        { name: 'Donny', model: 'nemotron-3-nano', provider: 'Ollama', cost: 0 },
        { name: 'Atlas', model: 'nemotron-3-nano', provider: 'Ollama', cost: 0 },
        { name: 'Windows', model: 'nemotron-3-nano', provider: 'Ollama', cost: 0 },
      ],
      providers: [
        { name: 'Anthropic', cost: 0 },
        { name: 'Qwen', cost: 0 },
        { name: 'MiniMax', cost: 0 },
        { name: 'Google', cost: 0 },
        { name: 'OpenAI', cost: 0 },
        { name: 'Ollama', cost: 0 },
      ],
      dailyTrend: [0, 0, 0, 0, 0, 0, 0],
      revenue: 0,
    },
  },

  seedKanban: [
    { id: 1, title: 'AIMEE Core v1.0', assignee: 'Charlie', priority: 'P1', notes: 'Full stack package — Docker, agents, SOPs, relay', column: 'deployed', created: '2026-03-16' },
    { id: 2, title: 'Recruiting Template', assignee: 'Engineer', priority: 'P1', notes: 'Screen resumes, schedule interviews, candidate comms', column: 'building', created: '2026-03-16' },
    { id: 3, title: 'Sales Template', assignee: 'Charlie', priority: 'P2', notes: 'Lead qualification, CRM updates, follow-up drafts', column: 'planned', created: '2026-03-16' },
    { id: 4, title: 'Client #1 Deploy', assignee: 'Charlie', priority: 'P1', notes: 'Investor pilot deployment', column: 'building', created: '2026-03-17' },
    { id: 5, title: 'Client #2 Onboard', assignee: 'Primary', priority: 'P2', notes: 'Second client via investor referral', column: 'planned', created: '2026-03-17' },
    { id: 6, title: 'Mission Control v1', assignee: 'Charlie', priority: 'P1', notes: 'Dashboard for managing deployments', column: 'testing', created: '2026-03-16' },
  ],
};
