/* ===== Mobile Menu ===== */
const menuToggle = document.getElementById('menuToggle');
const nav = document.getElementById('nav');
const header = document.getElementById('header');

// Create overlay
const overlay = document.createElement('div');
overlay.className = 'nav-overlay';
document.body.appendChild(overlay);

function closeMenu() {
  menuToggle.classList.remove('active');
  nav.classList.remove('open');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

function openMenu() {
  menuToggle.classList.add('active');
  nav.classList.add('open');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

menuToggle.addEventListener('click', () => {
  if (nav.classList.contains('open')) closeMenu();
  else openMenu();
});

overlay.addEventListener('click', closeMenu);

// Close menu on link click
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    closeMenu();
    // Active state
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
  });
});

/* ===== Header scroll ===== */
window.addEventListener('scroll', () => {
  if (window.scrollY > 30) header.classList.add('scrolled');
  else header.classList.remove('scrolled');
});

/* ===== Clause accordion ===== */
function toggleClause(headerEl) {
  const card = headerEl.closest('.clause-card');
  const isOpen = card.classList.contains('open');

  // Close all
  document.querySelectorAll('.clause-card.open').forEach(c => {
    c.classList.remove('open');
  });

  if (!isOpen) card.classList.add('open');
}

/* ===== Filters ===== */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    document.querySelectorAll('.clause-card').forEach(card => {
      if (filter === 'all' || card.dataset.clause === filter) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  });
});

/* ===== Contact form (Netlify-ready) ===== */
function handleContact(e) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);
  const name = data.get('name');

  // For now show success (ready for Netlify Forms / Formspree / backend)
  alert(`متشکریم ${name}!\nدرخواست شما ثبت شد. به زودی با شما تماس خواهیم گرفت.\n\n(این فرم آماده اتصال به Netlify Forms یا API است)`);
  form.reset();
}

/* ===== Smooth active nav on scroll ===== */
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
        if (l.getAttribute('href') === `#${id}`) l.classList.add('active');
      });
    }
  });
});

/* ===== Netlify Forms ready comment ===== */
/*
  برای فعال‌سازی Netlify Forms:
  1. به تگ <form> اضافه کنید: netlify  یا  data-netlify="true"
  2. یک input مخفی: <input type="hidden" name="form-name" value="contact" />
  3. دیپلوی روی Netlify
*/
