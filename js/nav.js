/** نوار ناوبری مشترک — فشرده و مناسب موبایل */
function renderAppNav(active) {
  var base = '';
  if (location.pathname.indexOf('/modules/') !== -1 || location.pathname.indexOf('/admin/') !== -1) {
    base = '../';
  }
  var links = [
    { id: 'dashboard', href: base + 'dashboard.html', label: 'داشبورد' },
    { id: 'guide', href: base + 'index.html', label: 'راهنما' },
    { id: 'audit', href: base + 'modules/audit-checklist.html', label: 'ممیزی' },
    { id: 'forms', href: base + 'modules/forms.html', label: 'فرم‌ها' },
    { id: 'staff', href: base + 'modules/staff.html', label: 'پرسنل' },
    { id: 'raci', href: base + 'modules/responsibilities.html', label: 'RACI' },
    { id: 'setup', href: base + 'setup.html', label: 'شرکت' }
  ];
  var html = '<nav class="app-nav" aria-label="منوی اصلی">';
  links.forEach(function (l) {
    var on = l.id === active;
    html += '<a href="' + l.href + '" class="' + (on ? 'nav-active' : '') + '"' +
      (on ? ' aria-current="page"' : '') +
      ' style="color:' + (on ? '#0f4c81' : '#e2e8f0') +
      ';background:' + (on ? '#7ee8d8' : 'transparent') + '">' + l.label + '</a>';
  });
  html += '</nav>';
  var el = document.getElementById('appNav');
  if (el) {
    el.innerHTML = html;
  } else {
    var d = document.createElement('div');
    d.id = 'appNav';
    d.innerHTML = html;
    var hdr = document.querySelector('.app-header');
    if (hdr && hdr.nextSibling) hdr.parentNode.insertBefore(d, hdr.nextSibling);
    else document.body.insertBefore(d, document.body.firstChild);
  }
}
window.renderAppNav = renderAppNav;
