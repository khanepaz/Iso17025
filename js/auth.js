/**
 * احراز هویت مشترک ادمین و کاربر
 * منبع: data/users.json + localStorage
 */
const DATA_STORAGE = 'iso17025_data_v1';
const SESSION_KEY = 'iso17025_session';
const SHARED_JSON = 'data/users.json';
const DEFAULT_ADMIN = {
  id: 'admin-001',
  username: 'admin',
  password: 'Admin@17025',
  role: 'admin',
  companyId: null,
  createdAt: new Date().toISOString()
};
let _ready = null;
let _cache = null;
function emptyData() { return { users: [DEFAULT_ADMIN], companies: [] }; }
function readLocal() {
  try { const raw = localStorage.getItem(DATA_STORAGE); if (raw) return JSON.parse(raw); } catch (e) {}
  return null;
}
function writeLocal(data) {
  _cache = data;
  localStorage.setItem(DATA_STORAGE, JSON.stringify(data));
}
function mergeData(shared, local) {
  const userMap = {}, coMap = {};
  (shared && shared.users || []).concat(local && local.users || []).forEach(u => { if (u && u.username) userMap[u.username] = u; });
  (shared && shared.companies || []).concat(local && local.companies || []).forEach(c => { if (c && c.id) coMap[c.id] = c; });
  if (!userMap.admin) userMap.admin = DEFAULT_ADMIN;
  return { users: Object.values(userMap), companies: Object.values(coMap) };
}
async function initAuth() {
  if (_ready) return _ready;
  _ready = (async () => {
    let shared = null;
    try {
      const res = await fetch(SHARED_JSON + '?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) shared = await res.json();
    } catch (e) {}
    const merged = mergeData(shared || emptyData(), readLocal());
    writeLocal(merged);
    return merged;
  })();
  return _ready;
}
function loadData() {
  if (_cache) return _cache;
  const local = readLocal();
  if (local) { _cache = local; return local; }
  const initial = emptyData();
  writeLocal(initial);
  return initial;
}
function saveData(data) { writeLocal(data); }
function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function setSession(user) {
  if (!user) { sessionStorage.removeItem(SESSION_KEY); return; }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, username: user.username, role: user.role, companyId: user.companyId || null }));
}
function login(username, password) {
  const user = loadData().users.find(u => u.username === username && u.password === password);
  if (!user) return { ok: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
  setSession(user);
  return { ok: true, user };
}
function logout() { setSession(null); window.location.href = 'index.html'; }
function requireAuth(roles) {
  const session = getSession();
  if (!session) { window.location.href = 'index.html'; return null; }
  if (roles && roles.indexOf(session.role) === -1) {
    window.location.href = session.role === 'admin' ? 'admin/index.html' : 'dashboard.html';
    return null;
  }
  return session;
}
function afterLoginRedirect(user) {
  if (user.role === 'admin') { window.location.href = 'admin/index.html'; return; }
  const co = getCompany(user.companyId);
  window.location.href = (co && !co.setupComplete) ? 'setup.html' : 'dashboard.html';
}
function createLabUser(payload) {
  const data = loadData();
  if (data.users.some(u => u.username === payload.username)) return { ok: false, error: 'این نام کاربری قبلاً ثبت شده است' };
  const companyId = 'co-' + Date.now();
  const company = {
    id: companyId, name: payload.companyName || '', address: payload.address || '', phone: payload.phone || '',
    seniorManager: payload.seniorManager || '', technicalManager: payload.technicalManager || '',
    staffCount: 0, staff: [], matrices: { deputies: [], responsibilities: [] }, setupComplete: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  const user = { id: 'user-' + Date.now(), username: payload.username, password: payload.password, role: 'lab', companyId, createdAt: new Date().toISOString() };
  data.users.push(user); data.companies.push(company); saveData(data);
  return { ok: true, user, company, json: data };
}
function getCompany(companyId) {
  if (!companyId) return null;
  return loadData().companies.find(c => c.id === companyId) || null;
}
function updateCompany(companyId, updates) {
  const data = loadData();
  const idx = data.companies.findIndex(c => c.id === companyId);
  if (idx === -1) return { ok: false };
  data.companies[idx] = Object.assign({}, data.companies[idx], updates, { updatedAt: new Date().toISOString() });
  saveData(data);
  return { ok: true, company: data.companies[idx] };
}
function addStaff(companyId, staffMember) {
  const data = loadData();
  const co = data.companies.find(c => c.id === companyId);
  if (!co) return { ok: false };
  const member = {
    id: 'st-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    name: staffMember.name, position: staffMember.position || '', education: staffMember.education || '',
    role: staffMember.role || 'technical', deputies: [], authorizedMethods: [], notes: ''
  };
  co.staff = co.staff || []; co.staff.push(member); co.staffCount = co.staff.length; saveData(data);
  return { ok: true, member };
}
function listLabUsers() {
  const data = loadData();
  return data.users.filter(u => u.role === 'lab').map(u => Object.assign({}, u, { company: data.companies.find(c => c.id === u.companyId) }));
}
function exportJson() { return JSON.stringify(loadData(), null, 2); }
window.ISOAuth = { initAuth, loadData, saveData, login, logout, requireAuth, getSession, afterLoginRedirect, createLabUser, getCompany, updateCompany, addStaff, listLabUsers, exportJson };
