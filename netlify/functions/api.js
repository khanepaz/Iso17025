/**
 * Netlify Function - ISO17025 users + NACI checklist
 */
const OWNER = process.env.GITHUB_OWNER || 'khanepaz';
const REPO = process.env.GITHUB_REPO || 'Iso17025';
const PATH = 'data/users.json';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const TOKEN = process.env.GITHUB_TOKEN;

let CHECKLIST_CACHE = null;
function loadChecklist() {
  if (CHECKLIST_CACHE) return CHECKLIST_CACHE;
  try { CHECKLIST_CACHE = require('./checklist.json'); }
  catch (e) { CHECKLIST_CACHE = { items: [] }; }
  return CHECKLIST_CACHE;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};
function json(status, body) {
  return { statusCode: status, headers: cors, body: JSON.stringify(body) };
}

async function githubGetFile() {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}`,
    { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }
  );
  if (res.status === 404) return { data: { users: [], companies: [] }, sha: null };
  if (!res.ok) throw new Error('GitHub GET failed: ' + res.status + ' ' + (await res.text()));
  const file = await res.json();
  return { data: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')), sha: file.sha };
}

async function githubPutFile(data, sha, message) {
  const body = {
    message: message || 'update users.json',
    content: Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64'),
    branch: BRANCH
  };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('GitHub PUT failed: ' + res.status + ' ' + (await res.text()));
  return res.json();
}

function defaultAdmin(data) {
  if (!data.users) data.users = [];
  if (!data.companies) data.companies = [];
  if (!data.users.some(u => u.username === 'admin')) {
    data.users.unshift({
      id: 'admin-001', username: 'admin', password: 'Admin@17025',
      role: 'admin', companyId: null, createdAt: new Date().toISOString()
    });
  }
  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (!TOKEN) return json(500, { ok: false, error: 'GITHUB_TOKEN missing' });
  try {
    if (event.httpMethod === 'GET') {
      const qs = event.queryStringParameters || {};
      if (qs.checklist === '1') return json(200, { ok: true, checklist: loadChecklist() });
      const { data } = await githubGetFile();
      defaultAdmin(data);
      return json(200, { ok: true, data });
    }
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
    const body = JSON.parse(event.body || '{}');
    const action = body.action;
    const { data, sha } = await githubGetFile();
    defaultAdmin(data);

    if (action === 'createLabUser') {
      const p = body.payload || {};
      if (!p.username || !p.password) return json(400, { ok: false, error: 'username/password required' });
      if (data.users.some(u => u.username === p.username)) return json(400, { ok: false, error: 'duplicate username' });
      const companyId = 'co-' + Date.now();
      data.companies.push({
        id: companyId, name: p.companyName || '', address: p.address || '', phone: p.phone || '',
        seniorManager: p.seniorManager || '', technicalManager: p.technicalManager || '',
        logoDataUrl: '', staff: [], matrices: { deputies: [], raci: [] }, checklist: {},
        setupComplete: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      data.users.push({
        id: 'user-' + Date.now(), username: p.username, password: p.password,
        role: 'lab', companyId, createdAt: new Date().toISOString()
      });
      await githubPutFile(data, sha, 'add lab user ' + p.username);
      return json(200, { ok: true });
    }
    if (action === 'updateLabUser') {
      const p = body.payload || {};
      const u = data.users.find(x => x.username === p.username && x.role === 'lab');
      if (!u) return json(404, { ok: false, error: 'user not found' });
      if (p.password && p.password.length >= 4) u.password = p.password;
      const co = data.companies.find(c => c.id === u.companyId);
      if (co) {
        if (p.companyName != null) co.name = p.companyName;
        if (p.address != null) co.address = p.address;
        if (p.phone != null) co.phone = p.phone;
        if (p.seniorManager != null) co.seniorManager = p.seniorManager;
        if (p.technicalManager != null) co.technicalManager = p.technicalManager;
        co.updatedAt = new Date().toISOString();
      }
      await githubPutFile(data, sha, 'update lab user');
      return json(200, { ok: true });
    }
    if (action === 'deleteLabUser') {
      const u = data.users.find(x => x.username === body.username && x.role === 'lab');
      if (!u) return json(404, { ok: false, error: 'user not found' });
      data.users = data.users.filter(x => x.username !== body.username);
      if (u.companyId) data.companies = data.companies.filter(c => c.id !== u.companyId);
      await githubPutFile(data, sha, 'delete lab user');
      return json(200, { ok: true });
    }
    if (action === 'updateCompany') {
      const idx = data.companies.findIndex(c => c.id === body.companyId);
      if (idx === -1) return json(404, { ok: false, error: 'company not found' });
      const { id, ...safe } = body.updates || {};
      data.companies[idx] = { ...data.companies[idx], ...safe, id: body.companyId, updatedAt: new Date().toISOString() };
      await githubPutFile(data, sha, 'update company');
      return json(200, { ok: true, company: data.companies[idx] });
    }
    if (action === 'upsertStaff') {
      const co = data.companies.find(c => c.id === body.companyId);
      if (!co) return json(404, { ok: false, error: 'company not found' });
      co.staff = co.staff || [];
      const staff = body.staff || {};
      if (!staff.id) { staff.id = 'st-' + Date.now(); co.staff.push(staff); }
      else {
        const i = co.staff.findIndex(s => s.id === staff.id);
        if (i >= 0) co.staff[i] = { ...co.staff[i], ...staff }; else co.staff.push(staff);
      }
      co.updatedAt = new Date().toISOString();
      await githubPutFile(data, sha, 'upsert staff');
      return json(200, { ok: true, staff: co.staff });
    }
    if (action === 'deleteStaff') {
      const co = data.companies.find(c => c.id === body.companyId);
      if (!co) return json(404, { ok: false, error: 'company not found' });
      co.staff = (co.staff || []).filter(s => s.id !== body.staffId);
      co.updatedAt = new Date().toISOString();
      await githubPutFile(data, sha, 'delete staff');
      return json(200, { ok: true, staff: co.staff });
    }
    if (action === 'saveMatrices') {
      const co = data.companies.find(c => c.id === body.companyId);
      if (!co) return json(404, { ok: false, error: 'company not found' });
      co.matrices = { ...(co.matrices || {}), ...(body.matrices || {}) };
      co.updatedAt = new Date().toISOString();
      await githubPutFile(data, sha, 'save matrices');
      return json(200, { ok: true });
    }
    if (action === 'saveChecklist') {
      const co = data.companies.find(c => c.id === body.companyId);
      if (!co) return json(404, { ok: false, error: 'company not found' });
      co.checklist = body.answers || {};
      co.updatedAt = new Date().toISOString();
      await githubPutFile(data, sha, 'save checklist');
      return json(200, { ok: true });
    }
    if (action === 'changePassword') {
      const u = data.users.find(x => x.username === body.username);
      if (!u || u.password !== body.oldPassword) return json(400, { ok: false, error: 'wrong password' });
      if (!body.newPassword || body.newPassword.length < 6) return json(400, { ok: false, error: 'weak password' });
      u.password = body.newPassword;
      await githubPutFile(data, sha, 'change password');
      return json(200, { ok: true });
    }
    return json(400, { ok: false, error: 'unknown action: ' + action });
  } catch (e) {
    return json(500, { ok: false, error: String(e.message || e) });
  }
};
