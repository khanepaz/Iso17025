/**
 * Netlify Function — مدیریت داده کاربران/شرکت‌ها روی GitHub
 * Env: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO
 */
const OWNER = process.env.GITHUB_OWNER || 'khanepaz';
const REPO = process.env.GITHUB_REPO || 'Iso17025';
const PATH = 'data/users.json';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const TOKEN = process.env.GITHUB_TOKEN;

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
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );
  if (res.status === 404) return { data: { users: [], companies: [] }, sha: null };
  if (!res.ok) throw new Error('GitHub GET failed: ' + res.status + ' ' + (await res.text()));
  const file = await res.json();
  const content = Buffer.from(file.content, 'base64').toString('utf8');
  return { data: JSON.parse(content), sha: file.sha };
}

async function githubPutFile(data, sha, message) {
  const body = {
    message: message || 'update users.json via Netlify',
    content: Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64'),
    branch: BRANCH
  };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
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
      id: 'admin-001',
      username: 'admin',
      password: 'Admin@17025',
      role: 'admin',
      companyId: null,
      createdAt: new Date().toISOString()
    });
  }
  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (!TOKEN) return json(500, { ok: false, error: 'GITHUB_TOKEN در Netlify تنظیم نشده است' });

  try {
    if (event.httpMethod === 'GET') {
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
      if (!p.username || !p.password) return json(400, { ok: false, error: 'username/password الزامی است' });
      if (data.users.some(u => u.username === p.username))
        return json(400, { ok: false, error: 'نام کاربری تکراری است' });
      const companyId = 'co-' + Date.now();
      const company = {
        id: companyId,
        name: p.companyName || '',
        address: p.address || '',
        phone: p.phone || '',
        seniorManager: p.seniorManager || '',
        technicalManager: p.technicalManager || '',
        logoDataUrl: '',
        staff: [],
        matrices: { deputies: [], raci: [] },
        setupComplete: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const user = {
        id: 'user-' + Date.now(),
        username: p.username,
        password: p.password,
        role: 'lab',
        companyId,
        createdAt: new Date().toISOString()
      };
      data.users.push(user);
      data.companies.push(company);
      await githubPutFile(data, sha, 'add lab user ' + p.username);
      return json(200, { ok: true, user: { id: user.id, username: user.username, role: user.role, companyId }, company });
    }

    if (action === 'updateCompany') {
      const { companyId, updates } = body;
      const idx = data.companies.findIndex(c => c.id === companyId);
      if (idx === -1) return json(404, { ok: false, error: 'شرکت یافت نشد' });
      const { id, ...safe } = updates || {};
      data.companies[idx] = { ...data.companies[idx], ...safe, id: companyId, updatedAt: new Date().toISOString() };
      await githubPutFile(data, sha, 'update company ' + companyId);
      return json(200, { ok: true, company: data.companies[idx] });
    }

    if (action === 'upsertStaff') {
      const { companyId, staff } = body;
      const co = data.companies.find(c => c.id === companyId);
      if (!co) return json(404, { ok: false, error: 'شرکت یافت نشد' });
      co.staff = co.staff || [];
      if (!staff.id) {
        staff.id = 'st-' + Date.now();
        co.staff.push(staff);
      } else {
        const i = co.staff.findIndex(s => s.id === staff.id);
        if (i >= 0) co.staff[i] = { ...co.staff[i], ...staff };
        else co.staff.push(staff);
      }
      co.updatedAt = new Date().toISOString();
      await githubPutFile(data, sha, 'upsert staff ' + companyId);
      return json(200, { ok: true, staff: co.staff });
    }

    if (action === 'deleteStaff') {
      const { companyId, staffId } = body;
      const co = data.companies.find(c => c.id === companyId);
      if (!co) return json(404, { ok: false, error: 'شرکت یافت نشد' });
      co.staff = (co.staff || []).filter(s => s.id !== staffId);
      co.updatedAt = new Date().toISOString();
      await githubPutFile(data, sha, 'delete staff ' + staffId);
      return json(200, { ok: true, staff: co.staff });
    }

    if (action === 'saveMatrices') {
      const { companyId, matrices } = body;
      const co = data.companies.find(c => c.id === companyId);
      if (!co) return json(404, { ok: false, error: 'شرکت یافت نشد' });
      co.matrices = { ...(co.matrices || {}), ...(matrices || {}) };
      co.updatedAt = new Date().toISOString();
      await githubPutFile(data, sha, 'save matrices ' + companyId);
      return json(200, { ok: true, matrices: co.matrices });
    }

    if (action === 'changePassword') {
      const { username, oldPassword, newPassword } = body;
      const u = data.users.find(x => x.username === username);
      if (!u || u.password !== oldPassword) return json(400, { ok: false, error: 'رمز فعلی اشتباه است' });
      if (!newPassword || newPassword.length < 6) return json(400, { ok: false, error: 'رمز جدید حداقل ۶ کاراکتر' });
      u.password = newPassword;
      await githubPutFile(data, sha, 'change password ' + username);
      return json(200, { ok: true });
    }

    if (action === 'saveAll') {
      const incoming = body.data;
      if (!incoming || !Array.isArray(incoming.users)) return json(400, { ok: false, error: 'data نامعتبر' });
      await githubPutFile(incoming, sha, 'admin saveAll');
      return json(200, { ok: true });
    }

    return json(400, { ok: false, error: 'action ناشناخته: ' + action });
  } catch (e) {
    return json(500, { ok: false, error: String(e.message || e) });
  }
};
