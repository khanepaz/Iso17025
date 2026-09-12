(async function () {
  if (!window.ISOAuth) return;
  var params = new URLSearchParams(location.search);
  var forceLogin = params.get('logout') === '1';
  await ISOAuth.initAuth();
  var session = ISOAuth.getSession();
  if (session && !forceLogin) {
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2500;background:#0f4c81;color:#fff;padding:8px 16px;font-family:Vazirmatn,sans-serif;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center';
    var dest = session.role === 'admin' ? 'admin/index.html' : 'dashboard.html';
    bar.innerHTML = '<span>وارد شده‌اید: <strong>' + session.username + '</strong></span><span><a href="' + dest + '" style="color:#7ee8d8;margin-left:12px">بازگشت به پنل</a> · <a href="#" id="gateLogout" style="color:#fecaca">خروج</a></span>';
    document.body.appendChild(bar);
    document.body.style.paddingTop = '40px';
    document.getElementById('gateLogout').onclick = function (e) { e.preventDefault(); ISOAuth.logout(); };
    return;
  }
  var gate = document.createElement('div');
  gate.id = 'loginGate';
  gate.className = 'auth-page';
  gate.style.cssText = 'position:fixed;inset:0;z-index:3000';
  gate.innerHTML = '<div class="auth-card"><div class="auth-logo">🔬</div><h1>ورود به سامانه ISO 17025</h1><p class="auth-sub">نام کاربری و رمز عبور خود را وارد کنید</p><form id="loginForm" class="auth-form"><div class="field"><label>نام کاربری</label><input id="username" required autocomplete="username"></div><div class="field"><label>رمز عبور</label><input id="password" type="password" required autocomplete="current-password"></div><p id="loginError" class="auth-error" hidden></p><button type="submit" class="btn btn-primary btn-full">ورود</button></form></div>';
  document.body.appendChild(gate);
  document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var res = ISOAuth.login(document.getElementById('username').value.trim(), document.getElementById('password').value);
    var err = document.getElementById('loginError');
    if (!res.ok) { err.textContent = res.error; err.hidden = false; return; }
    ISOAuth.afterLoginRedirect(res.user);
  });
})();
