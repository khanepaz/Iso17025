/**
 * Auth + tenant data — مسیرها نسبت به ریشه سایت محاسبه می‌شوند
 * تا در /modules/ و /admin/ هم درست کار کند.
 */
const SESSION_KEY = 'iso17025_session';
const DEFAULT_ADMIN = {
  id: 'admin-001', username: 'admin', password: 'Admin@17025',
  role: 'admin', companyId: null, createdAt: new Date().toISOString()
};
let _cache = null;

/** ریشهٔ سایت: / یا /Iso17025/ */
function siteRoot() {
  try {
    var parts = location.pathname.split('/').filter(Boolean);
    if (parts.length && /\./.test(parts[parts.length - 1])) parts.pop();
    if (parts.length && (parts[parts.length - 1] === 'modules' || parts[parts.length - 1] === 'admin')) {
      parts.pop();
    }
    return parts.length ? '/' + parts.join('/') + '/' : '/';
  } catch (e) {
    return '/';
  }
}
function siteUrl(rel) {
  rel = String(rel || '').replace(/^\//, '');
  return siteRoot() + rel;
}
function apiUrl() {
  return '/.netlify/functions/api';
}

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
}
function setSession(user) {
  if (!user) { sessionStorage.removeItem(SESSION_KEY); return; }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    id: user.id,
    username: user.username,
    role: user.role,
    companyId: user.companyId != null ? String(user.companyId) : null
  }));
}

async function apiGet() {
  try {
    const res = await fetch(apiUrl(), { cache: 'no-store' });
    const text = await res.text();
    if (res.ok) {
      try {
        const j = JSON.parse(text);
        if (j.ok && j.data) return j.data;
      } catch (e) {}
    }
  } catch (e) {}
  try {
    const url = siteUrl('data/users.json') + '?t=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { users: [DEFAULT_ADMIN], companies: [] };
}

async function apiPost(action, payload) {
  let res;
  try {
    res = await fetch(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action }, payload || {}))
    });
  } catch (e) {
    throw new Error('ارتباط با سرور برقرار نشد. سایت را از دامنه Netlify باز کنید.');
  }
  const text = await res.text();
  let j;
  try { j = JSON.parse(text); }
  catch (e) {
    if (res.status === 404) throw new Error('Function پیدا نشد (404). از دامنه Netlify استفاده کنید و Redeploy بزنید.');
    throw new Error('پاسخ سرور JSON نیست (کد ' + res.status + ').');
  }
  if (!res.ok || !j.ok) throw new Error(j.error || ('خطای سرور ' + res.status));
  return j;
}

async function initAuth() {
  const data = await apiGet();
  if (!data.users) data.users = [];
  if (!data.companies) data.companies = [];
  if (!data.users.some(function (u) { return u.username === 'admin'; })) {
    data.users.unshift(Object.assign({}, DEFAULT_ADMIN));
  }
  data.companies.forEach(function (c) {
    if (c && c.id != null) c.id = String(c.id);
    if (c && !Array.isArray(c.staff)) c.staff = [];
  });
  data.users.forEach(function (u) {
    if (u && u.companyId != null) u.companyId = String(u.companyId);
  });
  _cache = data;
  return data;
}
function loadData() { return _cache || { users: [DEFAULT_ADMIN], companies: [] }; }
async function refresh() { return initAuth(); }

function login(username, password) {
  const user = loadData().users.find(function (u) {
    return u.username === username && u.password === password;
  });
  if (!user) return { ok: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
  setSession(user);
  return { ok: true, user: user };
}
function logout() {
  setSession(null);
  window.location.href = siteUrl('index.html') + '?logout=1';
}
function requireAuth(roles) {
  const session = getSession();
  if (!session) {
    window.location.href = siteUrl('index.html') + '?logout=1';
    return null;
  }
  if (roles && roles.indexOf(session.role) === -1) {
    window.location.href = session.role === 'admin'
      ? siteUrl('admin/index.html')
      : siteUrl('dashboard.html');
    return null;
  }
  return session;
}
function afterLoginRedirect(user) {
  if (user.role === 'admin') {
    window.location.href = siteUrl('admin/index.html');
    return;
  }
  const co = getCompany(user.companyId);
  window.location.href = co && !co.setupComplete
    ? siteUrl('setup.html')
    : siteUrl('dashboard.html');
}
function getCompany(companyId) {
  if (companyId == null || companyId === '') return null;
  const id = String(companyId);
  return loadData().companies.find(function (c) { return String(c.id) === id; }) || null;
}
function listLabUsers() {
  const data = loadData();
  return data.users.filter(function (u) { return u.role === 'lab'; }).map(function (u) {
    return Object.assign({}, u, { company: getCompany(u.companyId) });
  });
}

async function createLabUser(payload) {
  const r = await apiPost('createLabUser', { payload: payload }); await refresh(); return r;
}
async function updateLabUser(payload) {
  const r = await apiPost('updateLabUser', { payload: payload }); await refresh(); return r;
}
async function deleteLabUser(username) {
  const r = await apiPost('deleteLabUser', { username: username }); await refresh(); return r;
}
async function updateCompany(companyId, updates) {
  const r = await apiPost('updateCompany', { companyId: String(companyId), updates: updates }); await refresh(); return r;
}
async function upsertStaff(companyId, staff) {
  const r = await apiPost('upsertStaff', { companyId: String(companyId), staff: staff }); await refresh(); return r;
}
async function deleteStaff(companyId, staffId) {
  const r = await apiPost('deleteStaff', { companyId: String(companyId), staffId: staffId }); await refresh(); return r;
}
async function saveMatrices(companyId, matrices) {
  const r = await apiPost('saveMatrices', { companyId: String(companyId), matrices: matrices }); await refresh(); return r;
}
async function saveChecklist(companyId, answers) {
  const r = await apiPost('saveChecklist', { companyId: String(companyId), answers: answers }); await refresh(); return r;
}
async function changePassword(username, oldPassword, newPassword) {
  return apiPost('changePassword', { username: username, oldPassword: oldPassword, newPassword: newPassword });
}

window.ISOAuth = {
  initAuth: initAuth, refresh: refresh, loadData: loadData, login: login, logout: logout,
  requireAuth: requireAuth, getSession: getSession, afterLoginRedirect: afterLoginRedirect,
  getCompany: getCompany, listLabUsers: listLabUsers, createLabUser: createLabUser,
  updateLabUser: updateLabUser, deleteLabUser: deleteLabUser,
  updateCompany: updateCompany, upsertStaff: upsertStaff, deleteStaff: deleteStaff,
  saveMatrices: saveMatrices, saveChecklist: saveChecklist, changePassword: changePassword,
  siteRoot: siteRoot, siteUrl: siteUrl
};
