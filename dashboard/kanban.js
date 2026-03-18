// AIMEE Mission Control — Kanban Board

// ── Data layer ──────────────────────────────────────────
function loadCards() {
  var stored = localStorage.getItem('aimeeKanban');
  if (stored) {
    try { return JSON.parse(stored); } catch (e) { /* fall through */ }
  }
  // Seed with demo cards
  var cards = CONFIG.seedKanban.slice();
  saveCards(cards);
  return cards;
}

function saveCards(cards) {
  localStorage.setItem('aimeeKanban', JSON.stringify(cards));
}

function nextId(cards) {
  return cards.reduce(function (max, c) { return Math.max(max, c.id); }, 0) + 1;
}

// ── Rendering ───────────────────────────────────────────
var COLUMNS = ['planned', 'building', 'testing', 'deployed'];

function renderKanban() {
  var cards = loadCards();

  COLUMNS.forEach(function (col) {
    var list = document.getElementById('list-' + col);
    var count = document.querySelector('[data-count="' + col + '"]');
    var colCards = cards.filter(function (c) { return c.column === col; });

    count.textContent = colCards.length;

    list.innerHTML = colCards.map(function (card) {
      return '<div class="kanban-card" data-id="' + card.id + '" onclick="toggleCard(this)">' +
        '<div class="kanban-card-title">' + escapeHTML(card.title) + '</div>' +
        '<div class="kanban-card-meta">' +
        '<span class="priority-tag ' + card.priority + '">' + card.priority + '</span>' +
        '<span>' + escapeHTML(card.assignee) + '</span>' +
        '<span>' + card.created + '</span>' +
        '</div>' +
        (card.notes ? '<div class="kanban-card-notes">' + escapeHTML(card.notes) + '</div>' : '') +
        '</div>';
    }).join('');
  });

  initSortable();
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toggleCard(el) {
  el.classList.toggle('expanded');
}

// ── Drag and Drop (SortableJS) ──────────────────────────
var sortables = [];

function initSortable() {
  // Destroy existing instances
  sortables.forEach(function (s) { s.destroy(); });
  sortables = [];

  COLUMNS.forEach(function (col) {
    var el = document.getElementById('list-' + col);
    var s = new Sortable(el, {
      group: 'kanban',
      animation: 150,
      ghostClass: 'card-ghost',
      dragClass: 'kanban-card',
      onEnd: function (evt) {
        var cardId = parseInt(evt.item.getAttribute('data-id'));
        var newColumn = evt.to.id.replace('list-', '');
        var cards = loadCards();
        var card = cards.find(function (c) { return c.id === cardId; });
        if (card) {
          card.column = newColumn;
          saveCards(cards);
        }
        // Update counts
        COLUMNS.forEach(function (c) {
          var count = document.querySelector('[data-count="' + c + '"]');
          var listEl = document.getElementById('list-' + c);
          count.textContent = listEl.children.length;
        });
      }
    });
    sortables.push(s);
  });
}

// ── Add Card Form ───────────────────────────────────────
function showAddForm(column) {
  var form = document.getElementById('form-' + column);

  // Toggle if already visible
  if (form.classList.contains('visible')) {
    form.classList.remove('visible');
    form.innerHTML = '';
    return;
  }

  // Hide all other forms
  COLUMNS.forEach(function (c) {
    var f = document.getElementById('form-' + c);
    f.classList.remove('visible');
    f.innerHTML = '';
  });

  form.innerHTML =
    '<input type="text" id="new-title-' + column + '" placeholder="Card title">' +
    '<input type="text" id="new-assignee-' + column + '" placeholder="Assignee" value="Charlie">' +
    '<select id="new-priority-' + column + '">' +
    '<option value="P1">P1 — Critical</option>' +
    '<option value="P2" selected>P2 — Normal</option>' +
    '<option value="P3">P3 — Low</option>' +
    '</select>' +
    '<textarea id="new-notes-' + column + '" placeholder="Notes (optional)"></textarea>' +
    '<div class="add-form-actions">' +
    '<button class="btn btn-primary" onclick="addCard(\'' + column + '\')">Add</button>' +
    '<button class="btn btn-cancel" onclick="hideAddForm(\'' + column + '\')">Cancel</button>' +
    '</div>';

  form.classList.add('visible');
  document.getElementById('new-title-' + column).focus();
}

function hideAddForm(column) {
  var form = document.getElementById('form-' + column);
  form.classList.remove('visible');
  form.innerHTML = '';
}

function addCard(column) {
  var title = document.getElementById('new-title-' + column).value.trim();
  if (!title) return;

  var assignee = document.getElementById('new-assignee-' + column).value.trim() || 'Charlie';
  var priority = document.getElementById('new-priority-' + column).value;
  var notes = document.getElementById('new-notes-' + column).value.trim();

  var cards = loadCards();
  cards.push({
    id: nextId(cards),
    title: title,
    assignee: assignee,
    priority: priority,
    notes: notes,
    column: column,
    created: new Date().toISOString().split('T')[0],
  });
  saveCards(cards);
  hideAddForm(column);
  renderKanban();
}

// ── Initialize ──────────────────────────────────────────
renderKanban();
