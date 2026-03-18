// AIMEE Mission Control — Dashboard Logic

// ── Auth check ──────────────────────────────────────────
// Authentication handled by Azure AD — no app-level password needed

// ── Detect hosting mode ─────────────────────────────────
// If running on Azure (not localhost), use snapshot.json for live data
var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.startsWith('172.') || location.hostname.startsWith('192.168.') || location.hostname.endsWith('.ts.net');

// ── View state ──────────────────────────────────────────
var currentView = localStorage.getItem('aimeeView') || CONFIG.defaultView;

function getEnv() {
  var env = JSON.parse(JSON.stringify(CONFIG[currentView] || CONFIG.live));
  // Rewrite API URLs for Tailscale access
  if (location.hostname.endsWith('.ts.net')) {
    var tsBase = location.protocol + '//' + location.hostname;
    env.apiUrls.paperclip = tsBase + ':3100';
    env.apiUrls.gateway = tsBase + ':18789';
    env.apiUrls.relay = tsBase + ':19090';
    env.apiUrls.hub = tsBase + ':9100';
  }
  return env;
}

function switchView(view) {
  currentView = view;
  localStorage.setItem('aimeeView', view);
  wireHeader();
  poll();
}

// ── Header wiring ───────────────────────────────────────
function wireHeader() {
  var env = getEnv();

  // Service links — use localhost when local, Tailscale when on ts.net, public subdomains when remote
  var pub = CONFIG.publicUrls || {};
  var isTailscale = location.hostname.endsWith('.ts.net');
  var tsBase = location.protocol + '//' + location.hostname;
  if (isTailscale) {
    document.getElementById('link-paperclip').href = tsBase + ':3100';
    document.getElementById('link-gateway').href = tsBase + ':18789/health';
    document.getElementById('link-hub').href = tsBase + ':9100/health';
  } else if (isLocal) {
    document.getElementById('link-paperclip').href = env.apiUrls.paperclip;
    document.getElementById('link-gateway').href = env.apiUrls.gateway + '/health';
    document.getElementById('link-hub').href = env.apiUrls.hub + '/health';
  } else {
    document.getElementById('link-paperclip').href = pub.paperclip || '#';
    document.getElementById('link-gateway').href = pub.gateway || '#';
    document.getElementById('link-hub').href = pub.hub || '#';
  }
  document.getElementById('link-about').href = pub.about || '#';

  // Update view selector
  document.getElementById('view-select').value = currentView;

  // Update view label
  var badge = document.getElementById('view-badge');
  if (currentView === 'live') {
    badge.textContent = 'LIVE';
    badge.className = 'view-badge live';
  } else {
    badge.textContent = 'DEMO';
    badge.className = 'view-badge demo';
  }
}

document.getElementById('btn-signout').addEventListener('click', function () {
  window.location.href = '/.auth/logout';
});

document.getElementById('view-select').addEventListener('change', function () {
  switchView(this.value);
});

// ── Fetch helper ────────────────────────────────────────
async function fetchJSON(url, options) {
  try {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 8000);
    var headers = { 'Content-Type': 'application/json' };
    if (options && options.token) {
      headers['Authorization'] = 'Bearer ' + options.token;
    }
    var res = await fetch(url, { signal: controller.signal, headers: headers });
    clearTimeout(timeout);
    if (!res.ok) return { ok: false, data: null, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { ok: true, data: data, error: null };
  } catch (err) {
    return { ok: false, data: null, error: err.message };
  }
}

// ── Time formatting ─────────────────────────────────────
function timeAgo(isoString) {
  if (!isoString) return 'never';
  var diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 0) return 'just now';
  if (diff < 60) return Math.floor(diff) + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function formatUptime(seconds) {
  if (!seconds) return '—';
  var h = Math.floor(seconds / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  if (h > 24) return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  return h + 'h ' + m + 'm';
}

// ── Error banner ────────────────────────────────────────
var banner = document.getElementById('error-banner');

function showError(msg) {
  banner.textContent = msg;
  banner.classList.add('visible');
}

function clearError() {
  banner.classList.remove('visible');
}

// ── Expand/collapse ─────────────────────────────────────
function toggleExpand(id) {
  document.getElementById(id).classList.toggle('expanded');
}

// ── Snapshot support (Azure hosting) ────────────────────
var cachedSnapshot = null;

async function loadSnapshot() {
  var snap = await fetchJSON('snapshot.json');
  if (snap.ok && snap.data) {
    cachedSnapshot = snap.data;
    return snap.data;
  }
  return null;
}

// ── Health Section ──────────────────────────────────────
async function fetchHealth() {
  var env = getEnv();
  var results = { services: {}, agents: [], relay: {}, hub: {}, liveAgents: env.agents || [] };
  var anyOk = false;

  // Live view — use snapshot.json (updated every 1 min by sync.sh)
  if (currentView === 'live' && cachedSnapshot) {
    var snap = cachedSnapshot;
    results.services = snap.services || {};
    results.relay = snap.relay || {};
    results.agents = snap.agents || [];
    results._anyOk = snap._anyOk || false;
    results._snapshotTime = snap.timestamp;
    return results;
  }

  // Demo view on Azure — mock healthy status
  if (!isLocal && currentView === 'demo') {
    results.services = { paperclip: 'healthy', gateway: 'healthy', relay: 'healthy' };
    results._anyOk = true;
    return results;
  }

  // Demo view locally — hit APIs directly
  var gwHealth = await fetchJSON(env.apiUrls.gateway + '/health');
  if (gwHealth.ok) {
    results.services.gateway = 'healthy';
    anyOk = true;
  } else {
    results.services.gateway = 'unreachable';
  }

  var pcHealth = await fetchJSON(env.apiUrls.paperclip + '/api/health');
  if (pcHealth.ok) {
    results.services.paperclip = 'healthy';
    anyOk = true;
  } else {
    results.services.paperclip = 'unreachable';
  }

  var relayStatus = await fetchJSON(env.apiUrls.relay + '/status');
  if (relayStatus.ok && relayStatus.data) {
    results.services.relay = 'healthy';
    if (relayStatus.data.agents) results.agents = relayStatus.data.agents;
    anyOk = true;
  } else {
    results.services.relay = 'unreachable';
  }

  var relayHealth = await fetchJSON(env.apiUrls.relay + '/health');
  if (relayHealth.ok && relayHealth.data) {
    results.relay = relayHealth.data;
    anyOk = true;
  }

  if (env.companyId) {
    var pcAgents = await fetchJSON(env.apiUrls.paperclip + '/api/companies/' + env.companyId + '/agents');
    if (pcAgents.ok && Array.isArray(pcAgents.data)) {
      results.agents = pcAgents.data;
    }
  }

  if (env.hubToken && env.companyId) {
    var hubHealth = await fetchJSON(
      env.apiUrls.hub + '/api/tenants/' + env.companyId + '/health',
      { token: env.hubToken }
    );
    if (hubHealth.ok) results.hub = hubHealth.data;
  }

  results._anyOk = anyOk;
  return results;
}

function renderHealth(data) {
  var env = getEnv();

  // Services Card
  var serviceList = [
    { key: 'paperclip', name: 'Paperclip' },
    { key: 'gateway', name: 'Gateway' },
    { key: 'relay', name: 'Parent Relay' },
  ];

  var healthyCount = 0;
  var servicesHTML = '';
  serviceList.forEach(function (svc) {
    var status = data.services[svc.key] || 'unknown';
    var dotClass = status === 'healthy' ? 'dot-healthy' : status === 'unreachable' ? 'dot-down' : 'dot-degraded';
    if (status === 'healthy') healthyCount++;
    servicesHTML += '<div class="service-row"><span class="dot ' + dotClass + '"></span><span class="name">' + svc.name + '</span><span class="status">' + status + '</span></div>';
  });

  // Show snapshot age if using snapshot
  var snapNote = '';
  if (data._snapshotTime) {
    snapNote = '<div class="card-sub" style="margin-top:6px;font-style:italic">Snapshot: ' + timeAgo(data._snapshotTime) + '</div>';
  }

  document.getElementById('services-content').innerHTML =
    '<div class="card-value">' + healthyCount + '/' + serviceList.length + '</div>' +
    '<div class="card-sub" style="margin-bottom:8px">' + (healthyCount === serviceList.length ? 'All healthy' : 'Issues detected') + '</div>' +
    servicesHTML + snapNote;

  // Agents Card
  var configAgents = data.liveAgents || [];
  var liveAgentMap = {};
  (data.agents || []).forEach(function (a) {
    liveAgentMap[a.name] = a;
  });

  var agentHTML = '';
  configAgents.forEach(function (a) {
    var live = liveAgentMap[a.id] || liveAgentMap[a.name] || {};
    var isActive = live.status === 'active' || data._anyOk;
    var dotClass = isActive ? 'dot-healthy' : 'dot-degraded';
    var lastAct = live.lastActivity ? timeAgo(live.lastActivity) : '';
    agentHTML += '<div class="service-row"><span class="dot ' + dotClass + '"></span><span class="name">' + a.name + '</span><span class="status" style="font-size:11px">' + a.model + (lastAct ? ' · ' + lastAct : '') + '</span></div>';
  });

  document.getElementById('agents-content').innerHTML =
    '<div class="card-value">' + configAgents.length + '</div>' +
    '<div class="card-sub" style="margin-bottom:8px">' + configAgents.length + ' registered agents</div>' +
    '<div style="max-height:200px;overflow-y:auto">' + agentHTML + '</div>';

  // Uptime Card
  var relay = data.relay;
  var uptimeSec = relay.uptime || 0;
  var pct = uptimeSec > 0 ? '99.9' : '0';
  var circumference = 2 * Math.PI * 22;
  var offset = circumference - (parseFloat(pct) / 100) * circumference;

  document.getElementById('uptime-content').innerHTML =
    '<div class="ring-container">' +
    '<svg viewBox="0 0 56 56">' +
    '<circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" stroke-width="4"/>' +
    '<circle cx="28" cy="28" r="22" fill="none" stroke="#22c55e" stroke-width="4" ' +
    'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" ' +
    'transform="rotate(-90 28 28)" stroke-linecap="round"/>' +
    '</svg>' +
    '<div><div class="card-value" style="font-size:24px">' + pct + '%</div>' +
    '<div class="card-sub">Running ' + formatUptime(uptimeSec) + '</div>' +
    '<div class="card-sub">' + (relay.checkinCount || 0) + ' check-ins</div></div>' +
    '</div>';

  // Relay Card
  document.getElementById('relay-content').innerHTML =
    '<div class="card-value" style="font-size:20px">' + (relay.lastCheckinStatus || (relay.status === 'ok' ? 'ok' : 'unknown')) + '</div>' +
    '<div class="card-sub">Last: ' + timeAgo(relay.lastCheckin) + '</div>' +
    '<div class="card-sub">Hub: ' + (relay.parentHub || 'not configured') + '</div>' +
    '<div class="card-sub">' + (relay.checkinCount || 0) + ' total check-ins</div>';
}

// ── Cost Section ────────────────────────────────────────
function renderCosts() {
  // Use snapshot costs for live view, mock costs for demo
  var costs;
  if (currentView === 'live' && cachedSnapshot && cachedSnapshot.costs) {
    costs = cachedSnapshot.costs;
  } else {
    costs = CONFIG.mockCosts[currentView] || CONFIG.mockCosts.demo;
  }

  var totalCost = costs.providers.reduce(function (sum, p) { return sum + p.cost; }, 0);
  var revenue = costs.revenue || CONFIG.revenue;
  var margin = revenue > 0 ? ((revenue - totalCost) / revenue * 100).toFixed(1) : '—';

  // Hide revenue/margin for demo (client) view — clients see usage only
  var isClientView = currentView === 'demo';
  document.getElementById('summary-revenue').style.display = isClientView ? 'none' : '';
  document.getElementById('summary-margin').style.display = isClientView ? 'none' : '';
  document.getElementById('summary-projected').style.display = isClientView ? 'none' : '';
  document.getElementById('cost-revenue').textContent = '$' + revenue;
  document.getElementById('cost-total').textContent = '$' + (costs.apiTotal || totalCost).toFixed(2);
  document.getElementById('cost-margin').textContent = totalCost > 0 ? margin + '%' : '—';

  // Show projected monthly cost (steady state + CC subscription)
  if (costs.projectedMonthly) {
    document.getElementById('cost-projected').textContent = '$' + (costs.projectedMonthly + (costs.claudeCodeSubscription || 0)).toFixed(0);
  }

  // Show setup vs steady state breakdown
  var breakdownEl = document.getElementById('cost-breakdown');
  if (breakdownEl && costs.setupCost !== undefined) {
    breakdownEl.innerHTML =
      '<span>Setup/R&D: $' + (costs.setupCost || 0).toFixed(0) + '</span>' +
      '<span style="margin-left:12px">Steady: $' + (costs.steadyStateCost || 0).toFixed(0) + '</span>' +
      '<span style="margin-left:12px">~$' + (costs.steadyDailyAvg || 0).toFixed(0) + '/day</span>';
  }

  // Update period label
  var periodLabel = document.getElementById('cost-period');
  if (periodLabel && costs.period) {
    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var parts = costs.period.split('-');
    var mIdx = parseInt(parts[1]) - 1;
    periodLabel.textContent = monthNames[mIdx] + ' ' + parts[0] + ' (day ' + (costs.daysElapsed || '?') + '/' + (costs.daysInMonth || '?') + ')';
  }

  // Session count
  var totalSessions = 0;
  if (costs.agents) costs.agents.forEach(function (a) { totalSessions += (a.sessions || 0); });
  var sessionsEl = document.getElementById('cost-sessions');
  if (sessionsEl) sessionsEl.textContent = totalSessions.toLocaleString() + ' sessions';

  // Per Agent
  var agentHTML = '';
  costs.agents.forEach(function (a) {
    var pct = totalCost > 0 ? (a.cost / totalCost * 100).toFixed(0) : 0;
    var sessions = a.sessions ? ' · ' + a.sessions + ' sess' : '';
    agentHTML +=
      '<div class="cost-row">' +
      '<span class="name">' + a.name + '</span>' +
      '<span class="model">' + a.model + sessions + '</span>' +
      '<span class="amount">$' + a.cost.toFixed(2) + '</span>' +
      '<div class="bar-container"><div class="bar" style="width:' + pct + '%"></div></div>' +
      '<span class="pct">' + pct + '%</span>' +
      '</div>';
  });
  document.getElementById('agent-costs').innerHTML = agentHTML || '<div style="color:#94a3b8;font-size:13px;padding:8px 0">No session data found</div>';

  // Per Provider
  var providerHTML = '';
  costs.providers.forEach(function (p) {
    var pct = totalCost > 0 ? (p.cost / totalCost * 100).toFixed(0) : 0;
    providerHTML +=
      '<div class="cost-row">' +
      '<span class="name">' + p.name + '</span>' +
      '<span class="model"></span>' +
      '<span class="amount">$' + p.cost.toFixed(2) + '</span>' +
      '<div class="bar-container"><div class="bar" style="width:' + pct + '%"></div></div>' +
      '<span class="pct">' + pct + '%</span>' +
      '</div>';
  });
  document.getElementById('provider-costs').innerHTML = providerHTML;

  // Sparkline
  renderSparkline('sparkline', costs.dailyTrend);
}

function renderSparkline(svgId, values) {
  var svg = document.getElementById(svgId);
  if (!values || values.length === 0 || values.every(function (v) { return v === 0; })) {
    svg.innerHTML = '<text x="100" y="28" text-anchor="middle" fill="#94a3b8" font-size="11">No cost data yet</text>';
    document.getElementById('sparkline-labels').innerHTML = '';
    return;
  }

  var min = Math.min.apply(null, values);
  var max = Math.max.apply(null, values);
  var range = max - min || 1;
  var padding = 5;
  var w = 200;
  var h = 50;

  var points = values.map(function (v, i) {
    var x = (i / (values.length - 1)) * (w - padding * 2) + padding;
    var y = h - padding - ((v - min) / range) * (h - padding * 2);
    return x + ',' + y;
  }).join(' ');

  svg.innerHTML =
    '<polyline points="' + points + '" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<polyline points="' + padding + ',' + h + ' ' + points + ' ' + (w - padding) + ',' + h + '" fill="url(#grad)" stroke="none"/>' +
    '<defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4F46E5" stop-opacity="0.15"/><stop offset="100%" stop-color="#4F46E5" stop-opacity="0"/></linearGradient></defs>';

  var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var today = new Date().getDay();
  var labels = [];
  for (var i = 0; i < 7; i++) {
    labels.push(days[(today - 6 + i + 7) % 7]);
  }
  document.getElementById('sparkline-labels').innerHTML = labels.map(function (d) {
    return '<span>' + d + '</span>';
  }).join('');
}

// ── Polling loop ────────────────────────────────────────
async function poll() {
  // Load snapshot for live data (sync.sh updates every 1 min)
  if (currentView === 'live') {
    await loadSnapshot();
  }

  var health = await fetchHealth();
  if (health._anyOk) {
    clearError();
  } else if (!cachedSnapshot && currentView === 'live') {
    showError('No snapshot data available. Waiting for sync.sh to run...');
  } else if (currentView === 'demo' && isLocal) {
    showError('Demo services unreachable — check that the stack is running. Retrying in ' + (CONFIG.pollIntervalMs / 1000) + 's...');
  } else {
    clearError();
  }
  renderHealth(health);
  renderCosts();
}

// ── Initialize ──────────────────────────────────────────
wireHeader();
poll();
setInterval(poll, CONFIG.pollIntervalMs);
