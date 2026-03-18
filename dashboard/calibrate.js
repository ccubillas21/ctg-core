#!/usr/bin/env node
// Calculate calibration factors from real invoices vs session logs

const fs = require('fs');
const path = require('path');
const AGENTS_DIR = path.join(process.env.HOME, '.openclaw', 'agents');

let anthropic = { sessions: 0, reportedCost: 0, totalTokens: 0, byAgent: {} };
let qwen = { sessions: 0, contentChars: 0, byAgent: {} };

const agentDirs = fs.readdirSync(AGENTS_DIR).filter(d => {
  return fs.statSync(path.join(AGENTS_DIR, d)).isDirectory();
});

for (const agent of agentDirs) {
  const sd = path.join(AGENTS_DIR, agent, 'sessions');
  if (!fs.existsSync(sd)) continue;

  for (const f of fs.readdirSync(sd).filter(x => x.endsWith('.jsonl'))) {
    const content = fs.readFileSync(path.join(sd, f), 'utf8');
    for (const line of content.split('\n')) {
      if (!line.includes('"usage"')) continue;
      try {
        const e = JSON.parse(line);
        if (e.type !== 'message' || !e.message) continue;
        const m = e.message;
        const u = m.usage || {};
        const c = u.cost || {};

        if (m.provider === 'anthropic') {
          anthropic.sessions++;
          anthropic.reportedCost += c.total || 0;
          anthropic.totalTokens += u.totalTokens || 0;
          if (!anthropic.byAgent[agent]) anthropic.byAgent[agent] = { sessions: 0, cost: 0 };
          anthropic.byAgent[agent].sessions++;
          anthropic.byAgent[agent].cost += c.total || 0;
        } else if (m.provider === 'qwen-portal') {
          qwen.sessions++;
          const chars = JSON.stringify(m.content || '').length;
          qwen.contentChars += chars;
          if (!qwen.byAgent[agent]) qwen.byAgent[agent] = { sessions: 0, chars: 0 };
          qwen.byAgent[agent].sessions++;
          qwen.byAgent[agent].chars += chars;
        }
      } catch (e) {}
    }
  }
}

const REAL_ANTHROPIC = 368.45;
const REAL_QWEN = 97.97;

console.log('=== Calibration Factors ===\n');

console.log('Anthropic:');
console.log('  Sessions:', anthropic.sessions);
console.log('  Log reported cost: $' + anthropic.reportedCost.toFixed(2));
console.log('  Real invoice cost: $' + REAL_ANTHROPIC);
console.log('  Correction factor: ' + (REAL_ANTHROPIC / Math.max(anthropic.reportedCost, 0.01)).toFixed(2) + 'x');
console.log('  Avg cost/session: $' + (REAL_ANTHROPIC / Math.max(anthropic.sessions, 1)).toFixed(4));

console.log('\n  Per-agent Anthropic distribution:');
for (const [a, d] of Object.entries(anthropic.byAgent).sort((a, b) => b[1].cost - a[1].cost)) {
  const pct = (d.cost / Math.max(anthropic.reportedCost, 0.01) * 100).toFixed(1);
  const realCost = (d.cost / Math.max(anthropic.reportedCost, 0.01)) * REAL_ANTHROPIC;
  console.log('    ' + a + ': ' + d.sessions + ' sess, $' + realCost.toFixed(2) + ' (' + pct + '%)');
}

console.log('\nQwen:');
console.log('  Sessions:', qwen.sessions);
console.log('  Content chars:', qwen.contentChars);
console.log('  Real invoice cost: $' + REAL_QWEN);
console.log('  Cost/session: $' + (REAL_QWEN / Math.max(qwen.sessions, 1)).toFixed(4));
console.log('  Cost/1K chars: $' + (REAL_QWEN / Math.max(qwen.contentChars / 1000, 0.01)).toFixed(4));

console.log('\n  Per-agent Qwen distribution:');
for (const [a, d] of Object.entries(qwen.byAgent).sort((a, b) => b[1].chars - a[1].chars)) {
  const pct = (d.chars / Math.max(qwen.contentChars, 1) * 100).toFixed(1);
  const realCost = (d.chars / Math.max(qwen.contentChars, 1)) * REAL_QWEN;
  console.log('    ' + a + ': ' + d.sessions + ' sess, $' + realCost.toFixed(2) + ' (' + pct + '%)');
}

// Write calibration file
const calibration = {
  generatedAt: new Date().toISOString(),
  anthropic: {
    invoiceTotal: REAL_ANTHROPIC,
    logReportedTotal: Math.round(anthropic.reportedCost * 100) / 100,
    correctionFactor: Math.round((REAL_ANTHROPIC / Math.max(anthropic.reportedCost, 0.01)) * 100) / 100,
    sessions: anthropic.sessions,
  },
  qwen: {
    invoiceTotal: REAL_QWEN,
    costPerChar: REAL_QWEN / Math.max(qwen.contentChars, 1),
    sessions: qwen.sessions,
    totalChars: qwen.contentChars,
  },
  setupDays: ['2026-03-12', '2026-03-13'],
};

fs.writeFileSync(path.join(__dirname, 'calibration.json'), JSON.stringify(calibration, null, 2));
console.log('\nCalibration written to calibration.json');
