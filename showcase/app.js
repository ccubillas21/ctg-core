// CTG Showcase — Interactions

(function () {
  // ── Scroll-based sidebar highlighting ─────────────────
  var sections = document.querySelectorAll('.section');
  var navItems = document.querySelectorAll('.nav-item');
  var progressFill = document.getElementById('progress-fill');
  var progressLabel = document.getElementById('progress-label');

  function updateActiveSection() {
    var scrollPos = window.scrollY + 100;
    var activeIndex = 0;

    sections.forEach(function (section, i) {
      if (section.offsetTop <= scrollPos) {
        activeIndex = i;
      }
    });

    navItems.forEach(function (item, i) {
      item.classList.toggle('active', i === activeIndex);
    });

    var pct = ((activeIndex + 1) / sections.length) * 100;
    progressFill.style.width = pct + '%';
    progressLabel.textContent = (activeIndex + 1) + ' of ' + sections.length;
  }

  window.addEventListener('scroll', updateActiveSection);
  updateActiveSection();

  // ── Sidebar click to scroll ───────────────────────────
  navItems.forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      var sectionId = item.getAttribute('data-section');
      var target = document.getElementById(sectionId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ── Layer accordion (Section 2) ───────────────────────
  var layerCards = document.querySelectorAll('.layer-card');

  layerCards.forEach(function (card) {
    card.addEventListener('click', function () {
      var wasExpanded = card.classList.contains('expanded');

      // Close all
      layerCards.forEach(function (c) {
        c.classList.remove('expanded');
      });

      // Toggle clicked
      if (!wasExpanded) {
        card.classList.add('expanded');
      }
    });
  });

  // ── Org node expand (Section 3) ───────────────────────
  var orgNodes = document.querySelectorAll('.org-node');

  orgNodes.forEach(function (node) {
    node.addEventListener('click', function () {
      node.classList.toggle('expanded');
    });
  });
})();
