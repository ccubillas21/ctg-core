// AIMEE Mission Control — Clients Tab

var clientsLoaded = false;

function loadClients() {
  var env = getEnv();
  var hubUrl = env.apiUrls.hub || CONFIG.hubApiUrl;
  var content = document.getElementById('clients-content');
  content.innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:8px 0">Loading clients...</div>';

  fetchJSON(hubUrl + '/api/tenants', env.hubToken ? { token: env.hubToken } : undefined)
    .then(function(res) {
      var clients = [];
      if (res.ok && res.data) {
        // Handle both flat array and wrapped {tenants:[]} response
        if (Array.isArray(res.data)) {
          clients = res.data;
        } else if (res.data.tenants && Array.isArray(res.data.tenants)) {
          clients = res.data.tenants;
        }
      }
      renderClientList(clients);
    });
}

function renderClientList(clients) {
  var content = document.getElementById('clients-content');
  var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
  html += '<span style="font-size:13px;color:#64748b">' + clients.length + ' client' + (clients.length !== 1 ? 's' : '') + '</span>';
  html += '<button class="btn btn-primary" onclick="showClientForm()">+ Onboard Client</button>';
  html += '</div>';

  html += '<div id="client-form-wrapper"></div>';

  if (clients.length === 0) {
    html += '<div style="color:#94a3b8;font-size:13px;padding:24px;text-align:center;background:#1e293b;border-radius:8px">No clients onboarded yet. Click "Onboard Client" to get started.</div>';
  } else {
    html += '<div class="client-grid">';
    clients.forEach(function(c) {
      var status = c.status || 'provisioned';
      var statusClass = 'status-' + status;
      var name = c.name || c.companyName || c.company_name || c.id || 'Unknown';
      var email = c.contactEmail || c.contact_email || c.email || '';
      var slack = c.slackWorkspace || c.slack_workspace || '';
      var ip = c.tailscaleIp || c.tailscale_ip || '';
      var created = c.createdAt || c.created_at || '';

      html += '<div class="card" style="position:relative">';
      html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">';
      html += '<div class="card-label" style="font-size:14px;font-weight:700;color:var(--text);text-transform:none;letter-spacing:0">' + name + '</div>';
      html += '<span class="badge ' + statusClass + '">' + status + '</span>';
      html += '</div>';

      if (email) html += '<div style="font-size:12px;color:#94a3b8;margin-bottom:4px">' + email + '</div>';
      if (slack) html += '<div style="font-size:12px;color:#94a3b8;margin-bottom:4px">Slack: ' + slack + '</div>';
      if (ip) html += '<div style="font-size:12px;color:#94a3b8;margin-bottom:4px">Tailscale: ' + ip + '</div>';
      if (created) html += '<div style="font-size:11px;color:#64748b;margin-top:8px">' + new Date(created).toLocaleDateString() + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  content.innerHTML = html;
}

function showClientForm() {
  var wrapper = document.getElementById('client-form-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML =
    '<div class="card form-card" style="margin-bottom:16px">' +
    '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:16px">New Client</div>' +
    '<form onsubmit="submitClient(event)">' +
    '<label>Company Name<input type="text" name="name" placeholder="Acme Corp" required></label>' +
    '<label>Contact Email<input type="email" name="email" placeholder="contact@acme.com"></label>' +
    '<label>Slack Workspace<input type="text" name="slack" placeholder="acme.slack.com"></label>' +
    '<label>Tailscale IP<input type="text" name="ip" placeholder="100.x.x.x"></label>' +
    '<div class="form-actions">' +
    '<button type="submit" class="btn btn-primary">Create Client</button>' +
    '<button type="button" class="btn btn-cancel" onclick="hideClientForm()">Cancel</button>' +
    '</div>' +
    '</form>' +
    '</div>';
}

function hideClientForm() {
  var wrapper = document.getElementById('client-form-wrapper');
  if (wrapper) wrapper.innerHTML = '';
}

function submitClient(e) {
  e.preventDefault();
  var form = e.target;
  var env = getEnv();
  var hubUrl = env.apiUrls.hub || CONFIG.hubApiUrl;

  var payload = {
    name: form.name.value.trim(),
    contactEmail: form.email.value.trim(),
    slackWorkspace: form.slack.value.trim(),
    tailscaleIp: form.ip.value.trim(),
    status: 'provisioned',
  };

  var submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';

  var opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
  if (env.hubToken) opts.headers['Authorization'] = 'Bearer ' + env.hubToken;

  fetch(hubUrl + '/api/tenants', opts)
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function() {
      hideClientForm();
      loadClients();
    })
    .catch(function(err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Client';
      var wrapper = document.getElementById('client-form-wrapper');
      if (wrapper) {
        var errDiv = wrapper.querySelector('.form-error') || document.createElement('div');
        errDiv.className = 'form-error';
        errDiv.style.cssText = 'color:#ef4444;font-size:12px;margin-top:8px';
        errDiv.textContent = 'Error: ' + err.message;
        if (!wrapper.querySelector('.form-error')) form.appendChild(errDiv);
      }
    });
}
