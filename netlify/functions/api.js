/**
 * Netlify Function - ISO17025 users/companies JSON + checklist
 */
const OWNER = process.env.GITHUB_OWNER || 'khanepaz';
const REPO = process.env.GITHUB_REPO || 'Iso17025';
const PATH = 'data/users.json';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const TOKEN = process.env.GITHUB_TOKEN;

let CHECKLIST_CACHE = null;
function loadChecklist() {
  if (CHECKLIST_CACHE) return CHECKLIST_CACHE;
  const items = [];
  for (let i = 1; i <= 20; i++) {
    try {
      const part = require('./checklist/cl' + i + '.json');
      if (part && part.items) items.push.apply(items, part.items);
    } catch (e) {}
  }
  if (!items.length) {
    try {
      const one = require('./checklist.json');
      if (one && one.items) items.push.apply(items, one.items);
    } catch (e2) {}
  }
  CHECKLIST_CACHE = { items: items };
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
  if (res.status === 409) {
    const err = new Error('SHA_CONFLICT');
    err.code = 'SHA_CONFLICT';
    throw err;
  }
  if (!res.ok) throw new Error('GitHub PUT failed: ' + res.status + ' ' + (await res.text()));
  return res.json();
}

async function withWrite(mutator, message) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, sha } = await githubGetFile();
    if (!data.users) data.users = [];
    if (!data.companies) data.companies = [];
    defaultAdmin(data);
    const result = mutator(data);
    if (result && result.error) return result;
    try {
      await githubPutFile(data, sha, message);
      return { ok: true, data: data, extra: result && result.extra };
    } catch (e) {
      lastErr = e;
      if (e.code !== 'SHA_CONFLICT' && String(e.message || e).indexOf('SHA_CONFLICT') === -1) throw e;
    }
  }
  throw lastErr || new Error('write failed after retries');
}

function defaultAdmin(data) {
  if (!data.users) data.users = [];
  if (!data.companies) data.companies = [];
  if (!data.users.some(function (u) { return u.username === 'admin'; })) {
    data.users.unshift({
      id: 'admin-001', username: 'admin', password: 'Admin@17025',
      role: 'admin', companyId: null, createdAt: new Date().toISOString()
    });
  }
  return data;
}

function cleanStaff(staff) {
  const s = Object.assign({}, staff || {});
  if (!s.id || String(s.id).trim() === '') delete s.id;
  s.name = String(s.name || '').trim();
  s.position = String(s.position || '').trim();
  s.education = String(s.education || '').trim();
  s.role = s.role || 'technical';
  return s;
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
      return json(200, { ok: true, data: data });
    }
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
    const body = JSON.parse(event.body || '{}');
    const action = body.action;

    if (action === 'createLabUser') {
      const p = body.payload || {};
      if (!p.username || !p.password) return json(400, { ok: false, error: 'username/password required' });
      const r = await withWrite(function (data) {
        if (data.users.some(function (u) { return u.username === p.username; })) {
          return { error: { status: 400, body: { ok: false, error: 'duplicate username' } } };
        }
        const companyId = 'co-' + Date.now();
        data.companies.push({
          id: companyId, name: p.companyName || '', address: p.address || '', phone: p.phone || '',
          seniorManager: p.seniorManager || '', technicalManager: p.technicalManager || '',
          logoDataUrl: '', staff: [], matrices: { deputies: [], raci: [] }, checklist: {},
          setupComplete: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
        data.users.push({
          id: 'user-' + Date.now(), username: p.username, password: p.password,
          role: 'lab', companyId: companyId, createdAt: new Date().toISOString()
        });
        return {};
      }, 'add lab user ' + p.username);
      if (r.error) return json(r.error.status, r.error.body);
      return json(200, { ok: true });
    }

    if (action === 'updateLabUser') {
      const p = body.payload || {};
      const r = await withWrite(function (data) {
        const u = data.users.find(function (x) { return x.username === p.username && x.role === 'lab'; });
        if (!u) return { error: { status: 404, body: { ok: false, error: 'user not found' } } };
        if (p.password && p.password.length >= 4) u.password = p.password;
        const co = data.companies.find(function (c) { return c.id === u.companyId; });
        if (co) {
          if (p.companyName != null) co.name = p.companyName;
          if (p.address != null) co.address = p.address;
          if (p.phone != null) co.phone = p.phone;
          if (p.seniorManager != null) co.seniorManager = p.seniorManager;
          if (p.technicalManager != null) co.technicalManager = p.technicalManager;
          co.updatedAt = new Date().toISOString();
        }
        return {};
      }, 'update lab user');
      if (r.error) return json(r.error.status, r.error.body);
      return json(200, { ok: true });
    }

    if (action === 'deleteLabUser') {
      const r = await withWrite(function (data) {
        const u = data.users.find(function (x) { return x.username === body.username && x.role === 'lab'; });
        if (!u) return { error: { status: 404, body: { ok: false, error: 'user not found' } } };
        data.users = data.users.filter(function (x) { return x.username !== body.username; });
        data.companies = data.companies.filter(function (c) { return c.id !== u.companyId; });
        return {};
      }, 'delete lab user');
      if (r.error) return json(r.error.status, r.error.body);
      return json(200, { ok: true });
    }

    if (action === 'updateCompany') {
      const r = await withWrite(function (data) {
        const idx = data.companies.findIndex(function (c) { return c.id === body.companyId; });
        if (idx === -1) return { error: { status: 404, body: { ok: false, error: 'company not found' } } };
        const updates = body.updates || {};
        const protectedKeys = { id: 1, staff: 1, matrices: 1, checklist: 1, createdAt: 1 };
        const safe = {};
        Object.keys(updates).forEach(function (k) {
          if (!protectedKeys[k]) safe[k] = updates[k];
        });
        if (Array.isArray(updates.staff)) safe.staff = updates.staff;
        if (updates.matrices && typeof updates.matrices === 'object') {
          safe.matrices = Object.assign({}, data.companies[idx].matrices || {}, updates.matrices);
        }
        data.companies[idx] = Object.assign({}, data.companies[idx], safe, {
          id: body.companyId, updatedAt: new Date().toISOString()
        });
        return { extra: { company: data.companies[idx] } };
      }, 'update company');
      if (r.error) return json(r.error.status, r.error.body);
      return json(200, { ok: true, company: r.extra && r.extra.company });
    }

    if (action === 'upsertStaff') {
      const r = await withWrite(function (data) {
        const co = data.companies.find(function (c) { return c.id === body.companyId; });
        if (!co) return { error: { status: 404, body: { ok: false, error: 'company not found' } } };
        co.staff = Array.isArray(co.staff) ? co.staff : [];
        const staff = cleanStaff(body.staff);
        if (!staff.name || !staff.position) {
          return { error: { status: 400, body: { ok: false, error: 'نام و سمت الزامی است' } } };
        }
        if (!staff.id) {
          staff.id = 'st-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
          co.staff.push(staff);
        } else {
          const i = co.staff.findIndex(function (s) { return s.id === staff.id; });
          if (i >= 0) co.staff[i] = Object.assign({}, co.staff[i], staff);
          else co.staff.push(staff);
        }
        co.updatedAt = new Date().toISOString();
        return { extra: { staff: co.staff } };
      }, 'upsert staff');
      if (r.error) return json(r.error.status, r.error.body);
      return json(200, { ok: true, staff: r.extra && r.extra.staff });
    }

    if (action === 'deleteStaff') {
      const r = await withWrite(function (data) {
        const co = data.companies.find(function (c) { return c.id === body.companyId; });
        if (!co) return { error: { status: 404, body: { ok: false, error: 'company not found' } } };
        co.staff = (co.staff || []).filter(function (s) { return s.id !== body.staffId; });
        if (co.matrices && Array.isArray(co.matrices.deputies)) {
          co.matrices.deputies = co.matrices.deputies.filter(function (d) {
            return d.personId !== body.staffId && d.deputyId !== body.staffId;
          });
        }
        co.updatedAt = new Date().toISOString();
        return { extra: { staff: co.staff } };
      }, 'delete staff');
      if (r.error) return json(r.error.status, r.error.body);
      return json(200, { ok: true, staff: r.extra && r.extra.staff });
    }

    if (action === 'saveMatrices') {
      const r = await withWrite(function (data) {
        const co = data.companies.find(function (c) { return c.id === body.companyId; });
        if (!co) return { error: { status: 404, body: { ok: false, error: 'company not found' } } };
        co.matrices = Object.assign({}, co.matrices || {}, body.matrices || {});
        co.updatedAt = new Date().toISOString();
        return {};
      }, 'save matrices');
      if (r.error) return json(r.error.status, r.error.body);
      return json(200, { ok: true });
    }

    if (action === 'saveChecklist') {
      const r = await withWrite(function (data) {
        const co = data.companies.find(function (c) { return c.id === body.companyId; });
        if (!co) return { error: { status: 404, body: { ok: false, error: 'company not found' } } };
        co.checklist = body.answers || {};
        co.updatedAt = new Date().toISOString();
        return {};
      }, 'save checklist');
      if (r.error) return json(r.error.status, r.error.body);
      return json(200, { ok: true });
    }

    if (action === 'changePassword') {
      const r = await withWrite(function (data) {
        const u = data.users.find(function (x) { return x.username === body.username; });
        if (!u || u.password !== body.oldPassword) {
          return { error: { status: 400, body: { ok: false, error: 'wrong password' } } };
        }
        if (!body.newPassword || body.newPassword.length < 6) {
          return { error: { status: 400, body: { ok: false, error: 'weak password' } } };
        }
        u.password = body.newPassword;
        return {};
      }, 'change password');
      if (r.error) return json(r.error.status, r.error.body);
      return json(200, { ok: true });
    }

    return json(400, { ok: false, error: 'unknown action: ' + action });
  } catch (e) {
    return json(500, { ok: false, error: String(e.message || e) });
  }
};
