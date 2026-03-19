// AIMEE Mission Control — Memory Tab
var AGENT_NAMES = {
  worker: 'Dude', cto: 'Walter', jr: 'Bonny', maude: 'Maude',
  brandt: 'Brandt', smokey: 'Smokey', 'da-fino': 'Da Fino',
  donny: 'Donny', mailroom: 'Mailroom'
};
var memoryData = null;

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelector('[data-tab="' + tab + '"]').classList.add('active');

  var allSections = ['health-section', 'cost-section', 'kanban-section', 'activity-section',
                     'memory-section', 'clients-section', 'agents-mgmt-section', 'usage-section'];
  var dashSections = ['health-section', 'cost-section', 'kanban-section', 'activity-section'];

  // Hide all first
  allSections.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  if (tab === 'dashboard') {
    dashSections.forEach(function(id) { document.getElementById(id).style.display = ''; });
  } else if (tab === 'memory') {
    document.getElementById('memory-section').style.display = '';
    loadMemoryData();
  } else if (tab === 'clients') {
    document.getElementById('clients-section').style.display = '';
    if (typeof loadClients === 'function') loadClients();
  } else if (tab === 'agents-mgmt') {
    document.getElementById('agents-mgmt-section').style.display = '';
    if (typeof loadAgentsTab === 'function') loadAgentsTab();
  } else if (tab === 'usage') {
    document.getElementById('usage-section').style.display = '';
    if (typeof loadUsageTab === 'function') loadUsageTab();
  }
}

async function loadMemoryData() {
  if (memoryData) { renderMemory(memoryData); return; }
  var res = await fetchJSON('memory-snapshot.json');
  if (res.ok && res.data) { memoryData = res.data; renderMemory(memoryData); }
  else { document.getElementById('memory-content').innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:16px">No memory data available yet. Waiting for convert-sessions.py to run...</div>'; }
}

function renderMemory(data) {
  var filter = document.getElementById('memory-agent-filter').value;
  var stats = data.stats || {};
  document.getElementById('memory-stats').innerHTML =
    '<span>' + (stats.total_sessions || 0) + ' sessions</span>' +
    '<span>' + (stats.agents_active || 0) + ' agents</span>' +
    '<span>' + (stats.days_covered || 0) + ' days</span>';
  var select = document.getElementById('memory-agent-filter');
  if (select.options.length <= 1) {
    var agents = new Set();
    (data.daily || []).forEach(function(d) {
      (d.sessions || []).forEach(function(s) { agents.add(s.agent); });
    });
    Array.from(agents).sort().forEach(function(a) {
      var opt = document.createElement('option');
      opt.value = a; opt.textContent = AGENT_NAMES[a] || a;
      select.appendChild(opt);
    });
  }
  var html = '';
  (data.daily || []).forEach(function(day) {
    var sessions = day.sessions || [];
    if (filter !== 'all') { sessions = sessions.filter(function(s) { return s.agent === filter; }); }
    if (sessions.length === 0) return;
    html += '<div class="memory-day">';
    html += '<div class="memory-day-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
    html += '<span class="memory-date">' + day.date + '</span>';
    html += '<span class="memory-day-count">' + sessions.length + ' session' + (sessions.length > 1 ? 's' : '') + '</span>';
    html += '<span class="arrow">&#9660;</span></div>';
    if (day.summary) { html += '<div class="memory-summary">' + day.summary.replace(/\n/g, '<br>').substring(0, 500) + '</div>'; }
    html += '<div class="memory-sessions">';
    sessions.forEach(function(s) {
      html += '<div class="memory-card">';
      html += '<div class="memory-card-header"><span class="memory-agent">' + (AGENT_NAMES[s.agent] || s.agent) + '</span>';
      html += '<span class="memory-model">' + (s.model || '') + '</span></div>';
      html += '<div class="memory-card-meta"><span>' + (s.duration_minutes || 0) + 'min</span><span>' + (s.messages || 0) + ' msgs</span></div>';
      if (s.summary) { html += '<div class="memory-card-summary">' + s.summary + '</div>'; }
      html += '</div>';
    });
    html += '</div></div>';
  });
  document.getElementById('memory-content').innerHTML = html || '<div style="color:#94a3b8;font-size:13px;padding:16px">No sessions found.</div>';
}

document.getElementById('memory-agent-filter').addEventListener('change', function() {
  if (memoryData) renderMemory(memoryData);
});
