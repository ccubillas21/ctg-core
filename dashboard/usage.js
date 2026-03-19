// AIMEE Mission Control — Usage & Spending Tab

function loadUsageTab() {
  var env = getEnv();
  var hubUrl = env.apiUrls.hub || CONFIG.hubApiUrl;
  var content = document.getElementById('usage-content');
  content.innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:8px 0">Loading usage data...</div>';

  fetchJSON(hubUrl + '/api/usage', env.hubToken ? { token: env.hubToken } : undefined)
    .then(function(res) {
      if (!res.ok || !res.data) {
        content.innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:24px;text-align:center;background:#1e293b;border-radius:8px">No usage data available. Hub API may not be running or /api/usage endpoint not implemented yet.</div>';
        return;
      }
      renderUsageTab(res.data);
    });
}

function renderUsageTab(data) {
  var content = document.getElementById('usage-content');

  // Normalize data — expect either flat array of usage records or {clients:[]} or {tenants:[]}
  var clients = [];
  if (Array.isArray(data)) {
    clients = data;
  } else if (data.clients && Array.isArray(data.clients)) {
    clients = data.clients;
  } else if (data.tenants && Array.isArray(data.tenants)) {
    clients = data.tenants;
  } else if (data.usage && Array.isArray(data.usage)) {
    clients = data.usage;
  }

  if (clients.length === 0) {
    content.innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:24px;text-align:center;background:#1e293b;border-radius:8px">No usage data found. Agents need to log sessions for usage to appear here.</div>';
    return;
  }

  // Calculate grand total
  var grandTotal = clients.reduce(function(sum, c) {
    return sum + (c.totalCost || c.total_cost || 0);
  }, 0);

  var html = '';

  // Summary bar
  html += '<div class="card" style="margin-bottom:24px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
  html += '<div>';
  html += '<div class="card-label">Total Spend (MTD)</div>';
  html += '<div style="font-size:28px;font-weight:700;color:var(--text)">$' + grandTotal.toFixed(2) + '</div>';
  html += '</div>';
  html += '<div style="text-align:right">';
  html += '<div class="card-label">Clients</div>';
  html += '<div style="font-size:28px;font-weight:700;color:var(--text)">' + clients.length + '</div>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  // Per-client cards
  html += '<div style="display:flex;flex-direction:column;gap:16px">';
  clients.forEach(function(c) {
    var clientName = c.name || c.clientName || c.client_name || c.tenantName || c.tenant_name || c.id || 'Unknown';
    var totalCost = c.totalCost || c.total_cost || 0;
    var agents = c.agents || c.agentBreakdown || c.agent_breakdown || [];
    var models = c.models || c.modelDistribution || c.model_distribution || [];
    var pct = grandTotal > 0 ? (totalCost / grandTotal * 100) : 0;

    html += '<div class="card">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
    html += '<div style="font-size:14px;font-weight:700;color:var(--text)">' + clientName + '</div>';
    html += '<div style="font-size:18px;font-weight:700;color:var(--accent)">$' + totalCost.toFixed(2) + '</div>';
    html += '</div>';

    // Percentage bar
    html += '<div class="usage-bar-bg" style="margin-bottom:12px">';
    html += '<div class="usage-bar" style="width:' + pct.toFixed(1) + '%"></div>';
    html += '</div>';
    html += '<div style="font-size:11px;color:#64748b;margin-bottom:12px">' + pct.toFixed(1) + '% of total spend</div>';

    // Per-agent breakdown
    if (agents.length > 0) {
      var agentMax = Math.max.apply(null, agents.map(function(a) { return a.cost || a.totalCost || a.total_cost || 0; }));
      html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:8px">Per Agent</div>';
      agents.forEach(function(a) {
        var agentName = a.name || a.agentName || a.agent_name || 'Agent';
        var agentCost = a.cost || a.totalCost || a.total_cost || 0;
        var agentPct = agentMax > 0 ? (agentCost / agentMax * 100) : 0;
        var agentModel = a.model || '';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
        html += '<div style="width:120px;font-size:12px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + agentName + '</div>';
        if (agentModel) html += '<div style="width:140px;font-size:11px;color:#94a3b8">' + agentModel + '</div>';
        html += '<div class="usage-bar-bg" style="flex:1">';
        html += '<div class="usage-bar" style="width:' + agentPct.toFixed(1) + '%;height:1rem;background:var(--accent)"></div>';
        html += '</div>';
        html += '<div style="width:60px;font-size:12px;font-weight:600;text-align:right;color:var(--text)">$' + agentCost.toFixed(2) + '</div>';
        html += '</div>';
      });
    }

    // Model distribution
    if (models.length > 0) {
      html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-top:12px;margin-bottom:8px">Model Distribution</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      models.forEach(function(m) {
        var modelName = m.model || m.name || 'Unknown';
        var modelPct = m.pct || m.percentage || 0;
        html += '<span class="badge" style="background:#1e293b;color:#94a3b8">' + modelName + ' ' + modelPct.toFixed(0) + '%</span>';
      });
      html += '</div>';
    }

    html += '</div>';
  });
  html += '</div>';

  content.innerHTML = html;
}
