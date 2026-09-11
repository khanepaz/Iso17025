/**
 * ISO 17025 Interactive Guide
 * - Accordion + nested sub-clauses
 * - Interactive checklists with localStorage (ready for future Netlify Identity user sync)
 * - Progress tracking
 * - Search / filter
 * Architecture note: localStorage can later be replaced/synced with Netlify Identity + Functions
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'iso17025_progress_v1';
  let progress = loadProgress();

  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');
  const header = document.getElementById('header');
  const clausesList = document.getElementById('clausesList');
  const progressBar = document.getElementById('overallProgress');
  const progressText = document.getElementById('progressText');
  const searchInput = document.getElementById('clauseSearch');

  const overlay = document.createElement('div');
  overlay.className = 'nav-overlay';
  document.body.appendChild(overlay);

  function closeMenu() {
    menuToggle?.classList.remove('active');
    nav?.classList.remove('open');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  }
  function openMenu() {
    menuToggle?.classList.add('active');
    nav?.classList.add('open');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  menuToggle?.addEventListener('click', () => {
    nav?.classList.contains('open') ? closeMenu() : openMenu();
  });
  overlay.addEventListener('click', closeMenu);
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      closeMenu();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) header?.classList.add('scrolled');
    else header?.classList.remove('scrolled');
  });

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }
  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    updateProgressUI();
  }
  function isChecked(id) {
    return !!progress[id];
  }
  function toggleCheck(id) {
    progress[id] = !progress[id];
    saveProgress();
  }
  function getTotalChecklistItems() {
    let total = 0;
    (window.ISO17025_DATA?.clauses || []).forEach(c => {
      c.subs.forEach(s => {
        total += (s.checklist || []).length;
      });
    });
    return total;
  }
  function getCompletedCount() {
    return Object.values(progress).filter(Boolean).length;
  }
  function updateProgressUI() {
    const total = getTotalChecklistItems();
    const done = getCompletedCount();
    const pct = total ? Math.round((done / total) * 100) : 0;
    if (progressBar) progressBar.style.width = pct + '%';
    if (progressText) progressText.textContent = done + ' از ' + total + ' مورد تکمیل شده (' + pct + '٪)';
  }

  function toPersianNum(str) {
    const map = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹', '.': '.' };
    return String(str).replace(/[0-9.]/g, d => map[d] || d);
  }

  function renderClauses(filterText, filterClause) {
    filterText = filterText || '';
    filterClause = filterClause || 'all';
    if (!clausesList || !window.ISO17025_DATA) return;
    const data = window.ISO17025_DATA.clauses;
    clausesList.innerHTML = '';

    data.forEach(clause => {
      if (filterClause !== 'all' && clause.id !== filterClause) return;

      const searchLower = filterText.trim().toLowerCase();
      let matchSearch = !searchLower;
      if (searchLower) {
        const blob = JSON.stringify(clause).toLowerCase();
        matchSearch = blob.includes(searchLower);
      }
      if (!matchSearch) return;

      const card = document.createElement('article');
      card.className = 'clause-card';
      card.dataset.clause = clause.id;

      let subsHtml = '';
      clause.subs.forEach(sub => {
        let reqs = (sub.requirements || []).map(r => '<li>' + r + '</li>').join('');
        let impl = (sub.implementation || []).map(i => '<li>' + i + '</li>').join('');
        let docs = (sub.docs || []).map(d => '<li>' + d + '</li>').join('');
        let checks = (sub.checklist || []).map(item => {
          const checked = isChecked(item.id) ? ' checked' : '';
          return '<label class="check-item"><input type="checkbox" data-id="' + item.id + '"' + checked + '><span>' + item.text + '</span></label>';
        }).join('');
        let exampleHtml = '';
        if (sub.example) {
          exampleHtml = '<div class="sub-section example-box"><h5>📌 ' + sub.example.title + '</h5><p>' + sub.example.content + '</p></div>';
        }

        subsHtml += '<div class="sub-clause">' +
          '<div class="sub-header" data-toggle-sub><h4>' + toPersianNum(sub.id) + ' — ' + sub.title + '</h4><span class="sub-toggle">▼</span></div>' +
          '<div class="sub-body">' +
          '<div class="sub-section"><h5>الزامات استاندارد</h5><ul class="req-list">' + reqs + '</ul></div>' +
          '<div class="sub-section"><h5>نحوه پیاده‌سازی</h5><ul>' + impl + '</ul></div>' +
          exampleHtml +
          '<div class="sub-section"><h5>مستندات موردنیاز</h5><ul class="docs-list">' + docs + '</ul></div>' +
          '<div class="sub-section checklist-section"><h5>چک‌لیست آمادگی (تعاملی)</h5><div class="checklist">' + checks + '</div></div>' +
          '</div></div>';
      });

      card.innerHTML = '<div class="clause-header" data-toggle-main>' +
        '<div class="clause-num">' + toPersianNum(clause.id) + '</div>' +
        '<div class="clause-title"><h3>' + clause.title + '</h3><span>' + clause.subtitle + '</span></div>' +
        '<span class="clause-toggle">+</span></div>' +
        '<div class="clause-body"><div class="subs-container">' + subsHtml + '</div></div>';

      clausesList.appendChild(card);
    });

    bindClauseEvents();
    updateProgressUI();
  }

  function bindClauseEvents() {
    document.querySelectorAll('[data-toggle-main]').forEach(header => {
      header.addEventListener('click', () => {
        const card = header.closest('.clause-card');
        const wasOpen = card.classList.contains('open');
        document.querySelectorAll('.clause-card.open').forEach(c => c.classList.remove('open'));
        if (!wasOpen) card.classList.add('open');
      });
    });

    document.querySelectorAll('[data-toggle-sub]').forEach(header => {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        header.closest('.sub-clause').classList.toggle('open');
      });
    });

    document.querySelectorAll('.checklist input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        toggleCheck(cb.dataset.id);
      });
    });
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderClauses(searchInput?.value || '', btn.dataset.filter || 'all');
    });
  });

  searchInput?.addEventListener('input', () => {
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    renderClauses(searchInput.value, activeFilter);
  });

  window.handleContact = function (e) {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    const name = data.get('name') || '';
    alert('متشکریم ' + name + '!\nدرخواست شما ثبت شد.\n\n(آماده اتصال به Netlify Forms / Functions)');
    form.reset();
  };

  window.resetProgress = function () {
    if (confirm('تمام پیشرفت چک‌لیست پاک شود؟')) {
      progress = {};
      saveProgress();
      const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
      renderClauses(searchInput?.value || '', activeFilter);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderClauses();
    const sections = document.querySelectorAll('section[id]');
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY + 100;
      sections.forEach(sec => {
        const top = sec.offsetTop;
        const height = sec.offsetHeight;
        const id = sec.getAttribute('id');
        if (scrollY >= top && scrollY < top + height) {
          document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.remove('active');
            if (l.getAttribute('href') === '#' + id) l.classList.add('active');
          });
        }
      });
    });
  });

  window.ISO17025 = {
    getProgress: () => Object.assign({}, progress),
    setProgress: (p) => { progress = p; saveProgress(); },
    resetProgress: window.resetProgress
  };
})();
