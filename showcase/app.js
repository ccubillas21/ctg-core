(function () {
  // ── Dynamic service links (localhost vs Tailscale) ──
  var isLocal = ['localhost', '127.0.0.1'].indexOf(location.hostname) !== -1;
  var base = isLocal ? 'http://localhost' : location.protocol + '//' + location.hostname;
  var portMap = { '4001': 4000, '3100': 3100, '18789': 18789 };
  document.querySelectorAll('.sidebar-link[href*="localhost"]').forEach(function (link) {
    var match = link.getAttribute('href').match(/:(\d+)/);
    if (match && portMap[match[1]]) {
      link.setAttribute('href', base + ':' + portMap[match[1]]);
    }
  });

  // ── Lucide icon initialization ──────────────────
  if (window.lucide) { lucide.createIcons(); }

  // ── Scroll-based sidebar highlighting ───────────
  var sections = document.querySelectorAll('.section');
  var navItems = document.querySelectorAll('.nav-item');
  var progressFill = document.getElementById('progress-fill');
  var progressLabel = document.getElementById('progress-label');

  function updateActiveSection() {
    var scrollPos = window.scrollY + 100;
    var activeIndex = 0;
    sections.forEach(function (section, i) {
      if (section.offsetTop <= scrollPos) { activeIndex = i; }
    });
    navItems.forEach(function (item, i) {
      item.classList.toggle('active', i === activeIndex);
    });
    var pct = ((activeIndex + 1) / sections.length) * 100;
    progressFill.style.width = pct + '%';
    var isEsProgress = document.querySelector('.lang-btn[data-lang="es"]') && document.querySelector('.lang-btn[data-lang="es"]').classList.contains('active');
    progressLabel.textContent = (activeIndex + 1) + (isEsProgress ? ' de ' : ' of ') + sections.length;
  }

  window.addEventListener('scroll', updateActiveSection);
  updateActiveSection();

  // ── Sidebar nav click ───────────────────────────
  navItems.forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.getElementById(item.getAttribute('data-section'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // ── Stack layers accordion (Section 2) ──────────
  var layerCards = document.querySelectorAll('.layer-card');
  layerCards.forEach(function (card) {
    card.addEventListener('click', function () {
      var wasExpanded = card.classList.contains('expanded');
      layerCards.forEach(function (c) { c.classList.remove('expanded'); });
      if (!wasExpanded) card.classList.add('expanded');
    });
  });

  // ── Org Chart v2 (3-layer) ──────────────────────
  var deptCards = document.querySelectorAll('[data-dept]');
  var expansions = document.querySelectorAll('.org-v2-expansion');
  var topLevelAgentCards = document.querySelectorAll('.org-v2-card[data-agent]');

  // Close all org chart state
  function resetOrgChart() {
    expansions.forEach(function (exp) {
      exp.classList.remove('expanded');
      exp.querySelectorAll('.org-v2-mini.expanded').forEach(function (m) {
        m.classList.remove('expanded');
      });
    });
    deptCards.forEach(function (c) { c.classList.remove('detail-open'); });
    topLevelAgentCards.forEach(function (c) { c.classList.remove('expanded'); });
  }

  // Dude/Walter — expand department + show their own detail
  deptCards.forEach(function (card) {
    card.addEventListener('click', function () {
      var deptId = card.getAttribute('data-dept');
      var target = document.getElementById('dept-' + deptId);
      var wasExpanded = target.classList.contains('expanded');

      resetOrgChart();

      if (!wasExpanded) {
        target.classList.add('expanded');
        card.classList.add('detail-open');
      }
    });
  });

  // Charlie/Bonny — toggle detail directly
  topLevelAgentCards.forEach(function (card) {
    if (card.hasAttribute('data-dept')) return; // skip Dude/Walter, handled above
    card.addEventListener('click', function () {
      var wasExpanded = card.classList.contains('expanded');
      resetOrgChart();
      if (!wasExpanded) {
        card.classList.add('expanded');
      }
    });
  });

  // Layer 3: agent/team detail
  document.addEventListener('click', function (e) {
    var mini = e.target.closest('.org-v2-mini');
    if (!mini) return;

    var parent = mini.closest('.org-v2-grid');
    if (!parent) return;

    var wasExpanded = mini.classList.contains('expanded');

    // Close siblings
    parent.querySelectorAll('.org-v2-mini.expanded').forEach(function (m) {
      m.classList.remove('expanded');
    });

    if (!wasExpanded) {
      mini.classList.add('expanded');
    }
  });

  // ── Dual-layer expand (Architecture + Deployment) ─
  document.addEventListener('click', function (e) {
    // Tech toggle (inner layer)
    var toggle = e.target.closest('.tech-toggle');
    if (toggle) {
      e.stopPropagation();
      var techDiv = toggle.nextElementSibling;
      techDiv.classList.toggle('expanded');
      var isEs = document.querySelector('.lang-btn[data-lang="es"]') && document.querySelector('.lang-btn[data-lang="es"]').classList.contains('active');
      if (techDiv.classList.contains('expanded')) {
        toggle.textContent = isEs ? 'Detalles T\u00e9cnicos \u25b4' : 'Technical Details \u25b4';
      } else {
        toggle.textContent = isEs ? 'Detalles T\u00e9cnicos \u25be' : 'Technical Details \u25be';
      }
      return;
    }

    // Service card (outer layer)
    var service = e.target.closest('.arch-v2-service');
    if (service) {
      var wasExpanded = service.classList.contains('expanded');
      var container = service.closest('.arch-row') || service.parentElement;
      var isEs = document.querySelector('.lang-btn[data-lang="es"]') && document.querySelector('.lang-btn[data-lang="es"]').classList.contains('active');
      container.querySelectorAll('.arch-v2-service.expanded').forEach(function (s) {
        s.classList.remove('expanded');
        s.querySelectorAll('.service-tech.expanded').forEach(function (t) { t.classList.remove('expanded'); });
        s.querySelectorAll('.tech-toggle').forEach(function (t) { t.textContent = isEs ? 'Detalles T\u00e9cnicos \u25be' : 'Technical Details \u25be'; });
      });
      if (!wasExpanded) service.classList.add('expanded');
      return;
    }

    // Deploy step (outer layer)
    var step = e.target.closest('.deploy-v2-step');
    if (step) {
      var wasExpanded = step.classList.contains('expanded');
      var isEsDeploy = document.querySelector('.lang-btn[data-lang="es"]') && document.querySelector('.lang-btn[data-lang="es"]').classList.contains('active');
      step.parentElement.querySelectorAll('.deploy-v2-step.expanded').forEach(function (s) {
        s.classList.remove('expanded');
        s.querySelectorAll('.step-tech.expanded').forEach(function (t) { t.classList.remove('expanded'); });
        s.querySelectorAll('.tech-toggle').forEach(function (t) { t.textContent = isEsDeploy ? 'Detalles T\u00e9cnicos \u25be' : 'Technical Details \u25be'; });
      });
      if (!wasExpanded) step.classList.add('expanded');
      return;
    }
  });

  // ── Pricing toggle (individual expand/collapse) ─
  // Hero and secondary cards use inline onclick handlers

  // ── Opportunity accordion ───────────────────────
  var oppCards = document.querySelectorAll('.opp-card');
  oppCards.forEach(function (card) {
    var header = card.querySelector('.opp-card-header');
    if (header) {
      header.addEventListener('click', function () {
        card.classList.toggle('expanded');
      });
    }
  });

  // ── Language toggle ─────────────────────────────
  var langBtns = document.querySelectorAll('.lang-btn');

  function switchLang(lang) {
    // Update buttons
    langBtns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-lang') === lang); });

    // Swap text content
    var elements = document.querySelectorAll('[data-es]');
    elements.forEach(function(el) {
      if (!el.getAttribute('data-en')) {
        el.setAttribute('data-en', el.innerHTML);
      }
      if (lang === 'es') {
        el.innerHTML = el.getAttribute('data-es');
      } else {
        el.innerHTML = el.getAttribute('data-en');
      }
    });

    // Update progress label
    if (progressLabel) {
      var current = progressLabel.textContent.match(/\d+/g);
      if (current && current.length === 2) {
        progressLabel.textContent = current[0] + (lang === 'es' ? ' de ' : ' of ') + current[1];
      }
    }

    // Update tech toggle buttons text based on language
    document.querySelectorAll('.tech-toggle').forEach(function(t) {
      var techDiv = t.nextElementSibling;
      if (techDiv && techDiv.classList.contains('expanded')) {
        t.textContent = lang === 'es' ? 'Detalles T\u00e9cnicos \u25b4' : 'Technical Details \u25b4';
      }
    });

    // Re-init Lucide icons (they get destroyed when innerHTML changes)
    if (window.lucide) { lucide.createIcons(); }
  }

  langBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchLang(btn.getAttribute('data-lang'));
    });
  });

})();
