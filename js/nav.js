/** نوار ناوبری مشترک صفحات کاربر */
function renderAppNav(active) {
  var base = '';
  if (location.pathname.indexOf('/modules/') !== -1 || location.pathname.indexOf('/admin/') !== -1) {
    base = '../';
  }
  var links = [
    { id: 'dashboard', href: base + 'dashboard.html', label: 'داشبورد' },
    { id: 'guide', href: base + 'index.html', label: 'راهنمای بندبه‌بند' },
    { id: 'audit', href: base + 'modules/audit-checklist.html', label: 'چک‌لیست ممیزی NACI' },
    { id: 'forms', href: base + 'modules/forms.html', label: 'فرم‌ها و PDF' },
    { id: 'staff', href: base + 'modules/staff.html', label: 'پرسنل' },
    { id: 'raci', href: base + 'modules/responsibilities.html', label: 'ماتریس RACI' },
    { id: 'setup', href: base + 'setup.html', label: 'اطلاعات شرکت' }
  ];
  var html = '<nav class="app-nav" style="background:#0b3a63;padding:8px 12px;overflow-x:auto;white-space:nowrap">';
  links.forEach(function (l) {
    var on = l.id === active;
    html += '<a href="' + l.href + '" style="display:inline-block;margin:0 6px;padding:6px 10px;border-radius:8px;color:' +
      (on ? '#0f4c81' : '#e2e8f0') + ';background:' + (on ? '#7ee8d8' : 'transparent') +
      ';text-decoration:none;font-size:0.82rem;font-weight:' + (on ? '700' : '500') + '">' + l.label + '</a>';
  });
  html += '</nav>';
  var el = document.getElementById('appNav');
  if (el) el.innerHTML = html;
  else {
    var d = document.createElement('div');
    d.id = 'appNav';
    d.innerHTML = html;
    var hdr = document.querySelector('.app-header');
    if (hdr && hdr.nextSibling) hdr.parentNode.insertBefore(d, hdr.nextSibling);
    else document.body.insertBefore(d, document.body.firstChild);
  }
}
window.renderAppNav = renderAppNav;
