/**
 * Auth & User Management Layer
 * - Frontend gate + localStorage for demo
 * - Ready to swap with Netlify Identity + Functions
 */

const AUTH_STORAGE = 'iso17025_auth_v1';
const DATA_STORAGE = 'iso17025_data_v1';
const SESSION_KEY = 'iso17025_session';

const DEFAULT_ADMIN = {
  id: 'admin-001',
  username: 'admin',
  password: 'Admin@17025',
  role: 'admin',
  companyId: null,
  createdAt: new Date().toISOString()
};

function loadData() {
  try {
    const raw = localStorage.getItem(DATA_STORAGE);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const initial = { users: [DEFAULT_ADMIN], companies: [] };
  saveData(initial);
  return initial;
}

function saveData(data) {
  localStorage.setItem(DATA_STORAGE, JSON.stringify(data));
}

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function setSession(user) {
  if (!user) {
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    id: user.id,
    username: user.username,
    role: user.role,
    companyId: user.companyId
  }));
}

function login(username, password) {
  const data = loadData();
  const user = data.users.find(u => u.username === username && u.password === password);
  if (!user) return { ok: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
  setSession(user);
  return { ok: true, user };
}

function logout() {
  setSession(null);
  window.location.href = 'login.html';
}

function requireAuth(roles) {
  const session = getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  if (roles && !roles.includes(session.role)) {
    window.location.href = session.role === 'admin' ? 'admin/index.html' : 'dashboard.html';
    return null;
  }
  return session;
}

function createLabUser(payload) {
  const data = loadData();
  if (data.users.some(u => u.username === payload.username)) {
    return { ok: false, error: 'این نام کاربری قبلاً ثبت شده است' };
  }
  const companyId = 'co-' + Date.now();
  const userId = 'user-' + Date.now();
  const company = {
    id: companyId,
    name: payload.companyName || '',
    address: payload.address || '',
    phone: payload.phone || '',
    seniorManager: payload.seniorManager || '',
    technicalManager: payload.technicalManager || '',
    staffCount: 0,
    staff: [],
    matrices: { deputies: [], responsibilities: [] },
    setupComplete: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const user = {
    id: userId,
    username: payload.username,
    password: payload.password,
    role: 'lab',
    companyId,
    createdAt: new Date().toISOString()
  };
  data.users.push(user);
  data.companies.push(company);
  saveData(data);
  return { ok: true, user, company };
}

function getCompany(companyId) {
  const data = loadData();
  return data.companies.find(c => c.id === companyId) || null;
}

function updateCompany(companyId, updates) {
  const data = loadData();
  const idx = data.companies.findIndex(c => c.id === companyId);
  if (idx === -1) return { ok: false };
  data.companies[idx] = { ...data.companies[idx], ...updates, updatedAt: new Date().toISOString() };
  saveData(data);
  return { ok: true, company: data.companies[idx] };
}

function addStaff(companyId, staffMember) {
  const data = loadData();
  const co = data.companies.find(c => c.id === companyId);
  if (!co) return { ok: false };
  const member = {
    id: 'st-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    name: staffMember.name,
    position: staffMember.position || '',
    education: staffMember.education || '',
    role: staffMember.role || 'technical',
    deputies: staffMember.deputies || [],
    authorizedMethods: staffMember.authorizedMethods || [],
    notes: staffMember.notes || ''
  };
  co.staff.push(member);
  co.staffCount = co.staff.length;
  co.updatedAt = new Date().toISOString();
  saveData(data);
  return { ok: true, member };
}

function listLabUsers() {
  const data = loadData();
  return data.users
    .filter(u => u.role === 'lab')
    .map(u => {
      const co = data.companies.find(c => c.id === u.companyId);
      return { ...u, company: co };
    });
}

window.ISOAuth = {
  loadData, saveData, login, logout, requireAuth, getSession,
  createLabUser, getCompany, updateCompany, addStaff, listLabUsers
};
