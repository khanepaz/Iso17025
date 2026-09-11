(async function () {
  if (!window.ISOAuth) return;
  await ISOAuth.initAuth();
  const session = ISOAuth.getSession();
  if (session) {
    ISOAuth.afterLoginRedirect(session);
    return;
  }
  const gate = document.createElement('div');
  gate.id = 'loginGate';
  gate.className = 'auth-page';
  gate.style.cssText = 'position:fixed;inset:0;z-index:3000';
  gate.innerHTML =
    '<div class="auth-card">' +
    '<div class="auth-logo">🔬</div>' +
    '<h1>ورود به سامانه ISO 17025</h1>' +
    '<p class="auth-sub">یک فرم برای ادمین و کاربر — نقش بعد از ورود مشخص می‌شود</p>' +
    '<form id="loginForm" class="auth-form">' +
    '<div class="field"><label>نام کاربری</label><input id="username" required></div>' +
    '<div class="field"><label>رمز عبور</label><input id="password" type="password" required></div>' +
    '<p id="loginError" class="auth-error" hidden></p>' +
    '<button type="submit" class="btn btn-primary btn-full">ورود</button>' +
    '</form></div>';
  document.body.appendChild(gate);
  document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const res = ISOAuth.login(
      document.getElementById('username').value.trim(),
      document.getElementById('password').value
    );
    const err = document.getElementById('loginError');
    if (!res.ok) {
      err.textContent = res.error;
      err.hidden = false;
      return;
    }
    ISOAuth.afterLoginRedirect(res.user);
  });
})();
