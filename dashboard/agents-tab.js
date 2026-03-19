// AIMEE Mission Control — Agents Management Tab

function loadAgentsTab() {
  var env = getEnv();
  var hubUrl = env.apiUrls.hub || CONFIG.hubApiUrl;
  var content = document.getElementById('agents-mgmt-content');
  content.innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:8px 0">Loading agents...</div>';

  // Fetch both agents and tenants (for client dropdown)
  Promise.all([
    fetchJSON(hubUrl + '/api/agents', env.hubToken ? { token: env.hubToken } : undefined),
    fetchJSON(hubUrl + '/api/tenants', env.hubToken ? { token: env.hubToken } : undefined)
  ]).then(function(results) {
    var agentsRes = results[0];
    var tenantsRes = results[1];

    var agents = [];
    if (agentsRes.ok && agentsRes.data) {
      agents = Array.isArray(agentsRes.data) ? agentsRes.data
        : (agentsRes.data.agents || []);
    }

    var tenants = [];
    if (tenantsRes.ok && tenantsRes.data) {
      tenants = Array.isArray(tenantsRes.data) ? tenantsRes.data
        : (tenantsRes.data.tenants || []);
    }

    renderAgentList(agents, tenants);
  });
}

function renderAgentList(agents, tenants) {
  var content = document.getElementById('agents-mgmt-content');

  // Group agents by client
  var byClient = {};
  agents.forEach(function(a) {
    var clientKey = a.tenantId || a.tenant_id || a.clientId || a.client_id || 'unassigned';
    if (!byClient[clientKey]) byClient[clientKey] = [];
    byClient[clientKey].push(a);
  });

  // Build tenant name lookup
  var tenantNames = {};
  tenants.forEach(function(t) {
    tenantNames[t.id] = t.name || t.companyName || t.company_name || t.id;
  });

  var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
  html += '<span style="font-size:13px;color:#64748b">' + agents.length + ' agent' + (agents.length !== 1 ? 's' : '') + '</span>';
  html += '<button class="btn btn-primary" onclick="showAgentForm()">+ Add Agent</button>';
  html += '</div>';

  html += '<div id="agent-form-wrapper"></div>';

  if (agents.length === 0) {
    html += '<div style="color:#94a3b8;font-size:13px;padding:24px;text-align:center;background:#1e293b;border-radius:8px">No agents configured yet. Click "Add Agent" to create one.</div>';
  } else {
    // Store tenants for later use in form
    html += '<div id="agents-tab-data" style="display:none" data-tenants="' + encodeURIComponent(JSON.stringify(tenants)) + '"></div>';

    Object.keys(byClient).forEach(function(clientKey) {
      var clientAgents = byClient[clientKey];
      var clientName = tenantNames[clientKey] || (clientKey === 'unassigned' ? 'Unassigned' : clientKey);

      html += '<div style="margin-bottom:24px">';
      html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:8px">' + clientName + '</div>';
      html += '<div class="agent-grid">';

      clientAgents.forEach(function(a) {
        var status = a.status || 'active';
        var statusClass = 'status-' + (status === 'active' ? 'live' : status === 'configured' ? 'configured' : 'provisioned');
        var name = a.name || a.agentName || a.agent_name || a.id || 'Agent';
        var role = a.role || a.jobDescription || a.job_description || '';
        var model = a.model || a.modelTier || a.model_tier || '';
        var provider = a.provider || '';

        html += '<div class="card">';
        html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">';
        html += '<div class="card-label" style="font-size:14px;font-weight:700;color:var(--text);text-transform:none;letter-spacing:0">' + name + '</div>';
        html += '<span class="badge ' + statusClass + '">' + status + '</span>';
        html += '</div>';
        if (role) html += '<div style="font-size:12px;color:#94a3b8;margin-bottom:4px">' + role + '</div>';
        if (model) {
          html += '<div style="font-size:12px;color:#64748b;margin-top:6px">' + model;
          if (provider) html += ' · ' + provider;
          html += '</div>';
        }
        html += '</div>';
      });

      html += '</div></div>';
    });
  }

  content.innerHTML = html;
}

function showAgentForm() {
  var wrapper = document.getElementById('agent-form-wrapper');
  if (!wrapper) return;

  // Try to get tenants from stored data element
  var dataEl = document.getElementById('agents-tab-data');
  var tenants = [];
  if (dataEl) {
    try { tenants = JSON.parse(decodeURIComponent(dataEl.getAttribute('data-tenants') || '[]')); } catch(e) {}
  }

  var clientOptions = tenants.map(function(t) {
    var label = t.name || t.companyName || t.company_name || t.id;
    return '<option value="' + t.id + '">' + label + '</option>';
  }).join('');

  wrapper.innerHTML =
    '<div class="card form-card" style="margin-bottom:16px">' +
    '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:16px">New Agent</div>' +
    '<form onsubmit="submitAgent(event)">' +
    '<label>Client<select name="tenantId">' +
    '<option value="">— Select client —</option>' +
    clientOptions +
    '</select></label>' +
    '<label>Agent Name<input type="text" name="name" placeholder="e.g. Recruiter" required></label>' +
    '<label>Role<input type="text" name="role" placeholder="e.g. HR screening, scheduling"></label>' +
    '<label>Model Tier<select name="model">' +
    '<option value="claude-sonnet-4-6">Sonnet (balanced)</option>' +
    '<option value="claude-opus-4-6">Opus (powerful)</option>' +
    '<option value="claude-haiku-4-5">Haiku (fast/cheap)</option>' +
    '</select></label>' +
    '<label>Job Description<textarea name="jobDescription" rows="3" placeholder="Describe what this agent does..."></textarea></label>' +
    '<div class="form-actions">' +
    '<button type="submit" class="btn btn-primary">Create Agent</button>' +
    '<button type="button" class="btn btn-cancel" onclick="hideAgentForm()">Cancel</button>' +
    '</div>' +
    '</form>' +
    '</div>';
}

function hideAgentForm() {
  var wrapper = document.getElementById('agent-form-wrapper');
  if (wrapper) wrapper.innerHTML = '';
}

function submitAgent(e) {
  e.preventDefault();
  var form = e.target;
  var env = getEnv();
  var hubUrl = env.apiUrls.hub || CONFIG.hubApiUrl;

  var model = form.model.value;
  var providerMap = {
    'claude-sonnet-4-6': 'Anthropic',
    'claude-opus-4-6': 'Anthropic',
    'claude-haiku-4-5': 'Anthropic',
  };

  var payload = {
    name: form.name.value.trim(),
    role: form.role.value.trim(),
    model: model,
    provider: providerMap[model] || 'Anthropic',
    jobDescription: form.jobDescription.value.trim(),
    tenantId: form.tenantId.value || undefined,
    status: 'configured',
  };

  var submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';

  var opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
  if (env.hubToken) opts.headers['Authorization'] = 'Bearer ' + env.hubToken;

  fetch(hubUrl + '/api/agents', opts)
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function() {
      hideAgentForm();
      loadAgentsTab();
    })
    .catch(function(err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Agent';
      var errDiv = form.querySelector('.form-error') || document.createElement('div');
      errDiv.className = 'form-error';
      errDiv.style.cssText = 'color:#ef4444;font-size:12px;margin-top:8px';
      errDiv.textContent = 'Error: ' + err.message;
      if (!form.querySelector('.form-error')) form.appendChild(errDiv);
    });
}
