// AIMEE Mission Control — Team Activity Panel (Plaza Feed)
var ACTIVITY_AGENT_NAMES = {
  worker: 'Dude', cto: 'Walter', jr: 'Bonny', maude: 'Maude',
  brandt: 'Brandt', smokey: 'Smokey', 'da-fino': 'Da Fino',
  donny: 'Donny', mailroom: 'Mailroom'
};

async function loadActivity() {
  var res = await fetchJSON('feed.json');
  if (res.ok && res.data && res.data.posts && res.data.posts.length > 0) { renderActivity(res.data.posts); }
  else { document.getElementById('activity-content').innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:8px 0">No plaza posts yet. Agents will share discoveries here.</div>'; }
}

function renderActivity(posts) {
  var html = '<div class="activity-feed">';
  posts.slice(0, 10).forEach(function(p) {
    var name = ACTIVITY_AGENT_NAMES[p.agent] || p.agent;
    var tags = (p.tags || []).map(function(t) { return '<span class="activity-tag">' + t + '</span>'; }).join('');
    html += '<div class="activity-item" onclick="this.classList.toggle(\'expanded\')">';
    html += '<div class="activity-header"><span class="activity-agent">' + name + '</span>';
    html += '<span class="activity-topic">' + (p.topic || '') + '</span>';
    html += '<span class="activity-date">' + (p.date || '') + '</span></div>';
    html += '<div class="activity-summary">' + (p.summary || '').substring(0, 100) + '</div>';
    if (tags) html += '<div class="activity-tags">' + tags + '</div>';
    if (p.summary && p.summary.length > 100) { html += '<div class="activity-full">' + p.summary + '</div>'; }
    html += '</div>';
  });
  html += '</div>';
  document.getElementById('activity-content').innerHTML = html;
}

loadActivity();
