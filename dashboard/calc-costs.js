#!/usr/bin/env node
// AIMEE — Real-time cost calculator
//
// Uses calibration factors derived from real invoices to accurately estimate
// costs from OpenClaw session logs. Run calibrate.js when you drop in new
// invoice CSVs to update the factors.
//
// Sources:
// 1. calibration.json — correction factors from real invoices
// 2. OpenClaw session JSONL logs — per-agent, per-session tracking
// 3. Claude Code subscription — $100/mo fixed

const fs = require('fs');
const path = require('path');

const DASHBOARD_DIR = __dirname;
const AGENTS_DIR = path.join(process.env.HOME, '.openclaw', 'agents');
const CALIBRATION_FILE = path.join(DASHBOARD_DIR, 'calibration.json');

// Load calibration (from real invoices)
let cal = { anthropic: { correctionFactor: 5.91 }, qwen: { costPerChar: 0.0000521 }, setupDays: [] };
if (fs.existsSync(CALIBRATION_FILE)) {
  cal = JSON.parse(fs.readFileSync(CALIBRATION_FILE, 'utf8'));
}

const AGENT_NAMES = {
  'worker': 'Dude (Worker)', 'cto': 'Walter (CTO)', 'jr': 'Bonny (Jr)',
  'docker-2': 'Docker VP', 'axiom': 'Axiom', 'ops': 'Ops',
  'sentinel': 'Sentinel', 'herald': 'Herald', 'oracle': 'Oracle',
  'scout': 'Scout', 'maude': 'Maude', 'donny': 'Donny',
  'atlas': 'Atlas', 'windows': 'Windows', 'main': 'Main',
};

const PROVIDER_MAP = {
  'anthropic': 'Anthropic', 'qwen-portal': 'Qwen', 'minimax-portal': 'MiniMax',
  'minimax': 'MiniMax', 'google': 'Google', 'openai': 'OpenAI',
  'ollama': 'Ollama', 'openclaw': 'Ollama',
};

const MINIMAX_RATES = {
  'MiniMax-M2.5': { input: 0.30, output: 1.20 },
  'MiniMax-M2.5-highspeed': { input: 0.30, output: 1.20 },
};

const now = new Date();
const currentMonth = now.toISOString().substring(0, 7);
const setupDays = new Set(cal.setupDays || []);

// ── Parse all sessions ──────────────────────────────────
const agentData = {};
const dailyCosts = {};
const providerTotals = {};
let totalSessions = 0;

const agentDirs = fs.readdirSync(AGENTS_DIR).filter(d => {
  try { return fs.statSync(path.join(AGENTS_DIR, d)).isDirectory(); } catch(e) { return false; }
});

for (const agentId of agentDirs) {
  const sd = path.join(AGENTS_DIR, agentId, 'sessions');
  if (!fs.existsSync(sd)) continue;

  for (const file of fs.readdirSync(sd).filter(f => f.endsWith('.jsonl'))) {
    const content = fs.readFileSync(path.join(sd, file), 'utf8');
    for (const line of content.split('\n')) {
      if (!line.includes('"usage"')) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'message' || !entry.message) continue;
        const msg = entry.message;
        const u = msg.usage || {};
        const c = u.cost || {};
        const day = entry.timestamp ? entry.timestamp.substring(0, 10) : '';
        const month = entry.timestamp ? entry.timestamp.substring(0, 7) : '';
        const provider = PROVIDER_MAP[msg.provider] || msg.provider || 'unknown';
        const isSetup = setupDays.has(day);

        // Only count current month
        if (month !== currentMonth) continue;

        let cost = 0;

        if (msg.provider === 'anthropic') {
          // Use reported cost * calibration correction factor
          const reported = c.total || 0;
          cost = reported * cal.anthropic.correctionFactor;
        } else if (msg.provider === 'qwen-portal') {
          // Use content char length * calibrated cost-per-char
          const chars = JSON.stringify(msg.content || '').length;
          cost = chars * cal.qwen.costPerChar;
        } else if (msg.provider === 'minimax-portal' || msg.provider === 'minimax') {
          // Use rate table estimate
          const model = msg.model || 'MiniMax-M2.5';
          const rate = MINIMAX_RATES[model] || { input: 0.30, output: 1.20 };
          let inputTokens = u.input || 0;
          let outputTokens = u.output || 0;
          if (inputTokens === 0 && outputTokens === 0) {
            const chars = JSON.stringify(msg.content || '').length;
            outputTokens = Math.round(chars / 4);
            inputTokens = outputTokens * 3;
          }
          cost = (inputTokens / 1e6) * rate.input + (outputTokens / 1e6) * rate.output;
        }
        // Ollama = $0, skip

        totalSessions++;

        // Agent tracking
        if (!agentData[agentId]) {
          agentData[agentId] = {
            name: AGENT_NAMES[agentId] || agentId,
            model: msg.model || 'unknown',
            provider: provider,
            cost: 0,
            setupCost: 0,
            steadyCost: 0,
            sessions: 0,
          };
        }
        agentData[agentId].cost += cost;
        agentData[agentId].sessions++;
        agentData[agentId].model = msg.model || agentData[agentId].model;
        agentData[agentId].provider = provider;
        if (isSetup) {
          agentData[agentId].setupCost += cost;
        } else {
          agentData[agentId].steadyCost += cost;
        }

        // Provider tracking
        if (provider && provider !== 'unknown' && provider !== 'undefined') {
          providerTotals[provider] = (providerTotals[provider] || 0) + cost;
        }

        // Daily tracking
        if (day) {
          if (!dailyCosts[day]) dailyCosts[day] = { total: 0, isSetup: isSetup };
          dailyCosts[day].total += cost;
        }
      } catch (e) {}
    }
  }
}

// ── Build 7-day trend ───────────────────────────────────
const trend = [];
for (let i = 6; i >= 0; i--) {
  const d = new Date(now); d.setDate(d.getDate() - i);
  const key = d.toISOString().substring(0, 10);
  trend.push(Math.round((dailyCosts[key] ? dailyCosts[key].total : 0) * 100) / 100);
}

// ── Calculate projections ───────────────────────────────
const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const dayOfMonth = now.getDate();
const apiTotal = Object.values(providerTotals).reduce((s, c) => s + c, 0);

// Steady-state projection (exclude setup days)
const setupDayCount = [...setupDays].filter(d => d.startsWith(currentMonth)).length;
const steadyDays = dayOfMonth - setupDayCount;
const steadyTotal = Object.values(agentData).reduce((s, a) => s + a.steadyCost, 0);
const setupTotal = Object.values(agentData).reduce((s, a) => s + a.setupCost, 0);
const steadyDailyAvg = steadyDays > 0 ? steadyTotal / steadyDays : 0;
const projectedSteadyState = steadyDailyAvg * daysInMonth;

// ── Build output ────────────────────────────────────────
const agents = Object.values(agentData)
  .sort((a, b) => b.cost - a.cost)
  .map(a => ({
    name: a.name,
    model: a.model,
    provider: a.provider,
    cost: Math.round(a.cost * 100) / 100,
    sessions: a.sessions,
    setupCost: Math.round(a.setupCost * 100) / 100,
    steadyCost: Math.round(a.steadyCost * 100) / 100,
  }));

const providers = Object.entries(providerTotals)
  .filter(([name]) => name && name !== 'undefined')
  .sort((a, b) => b[1] - a[1])
  .map(([name, cost]) => ({ name, cost: Math.round(cost * 100) / 100 }));

providers.push({ name: 'Claude Code (subscription)', cost: 100 });

const output = {
  period: currentMonth,
  daysElapsed: dayOfMonth,
  daysInMonth: daysInMonth,
  agents,
  providers,
  dailyTrend: trend,
  revenue: 500,
  apiTotal: Math.round(apiTotal * 100) / 100,
  setupCost: Math.round(setupTotal * 100) / 100,
  steadyStateCost: Math.round(steadyTotal * 100) / 100,
  steadyDailyAvg: Math.round(steadyDailyAvg * 100) / 100,
  projectedMonthly: Math.round(projectedSteadyState * 100) / 100,
  claudeCodeSubscription: 100,
  totalSessions: totalSessions,
  calibration: {
    anthropicFactor: cal.anthropic.correctionFactor,
    qwenCostPerChar: cal.qwen.costPerChar,
    lastCalibrated: cal.generatedAt || 'unknown',
  },
  calculatedAt: now.toISOString(),
};

console.log(JSON.stringify(output, null, 2));
