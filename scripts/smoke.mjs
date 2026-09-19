const BASE = process.env.SMOKE_API || 'http://localhost:8787';
await fetch(`${BASE}/api/_test/cleanup`, { method: 'POST' }).catch(() => {});
let pass = 0, fail = 0;
const results = [];

async function login(email) {
  const r = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test' }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`login failed for ${email}`);
  return j.userId;
}

async function api(path, { method = 'GET', userId, body } = {}) {
  const headers = {};
  if (userId) headers['x-user-id'] = userId;
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

async function check(name, fn) {
  try {
    const ok = await fn();
    if (ok === false) throw new Error('returned false');
    pass++;
    results.push(`✅ ${name}`);
  } catch (e) {
    fail++;
    results.push(`❌ ${name} — ${e.message}`);
  }
}

const clientId = await login('jane.doe@client.com');
const miaId = await login('mia.chen@worker.com');
const sarahId = await login('sarah.johnson@helphome-worker.com');
const toniaId = await login('tonia@helphome.au');
const adminId = await login('admin@carework.au');

await check('GET /', async () => (await api('/')).data.message === 'CareWork API Active');
await check('GET /api/demo-accounts returns 5', async () => (await api('/api/demo-accounts')).data.length === 5);

// Client
await check('GET /api/workers (independent only)', async () => {
  const d = (await api('/api/workers', { userId: clientId })).data;
  return Array.isArray(d) && d.length > 0 && d.every(w => w.wellnessMatch !== undefined);
});
await check('GET /api/client-profile', async () => {
  const d = (await api('/api/client-profile', { userId: clientId })).data;
  return d.id && d.name === 'Jane Doe';
});
await check('POST /api/bookings (client books)', async () => {
  const w = (await api('/api/workers', { userId: clientId })).data[0];
  const r = await api('/api/bookings', { method: 'POST', userId: clientId, body: { workerId: w.id } });
  return r.status === 201 && r.data.ok;
});
await check('POST /api/wellness', async () => {
  const r = await api('/api/wellness', { method: 'POST', userId: clientId, body: { logType: 'mood', score: 8 } });
  return r.status === 201 && r.data.success;
});

// Worker (Mia — independent only)
await check('GET /api/worker-hub (Mia, 1 context)', async () => {
  const d = (await api('/api/worker-hub', { userId: miaId })).data;
  return Array.isArray(d.contexts) && d.contexts.length === 1 && d.contexts[0] === 'independent';
});
await check('GET /api/checkins (Mia)', async () => Array.isArray((await api('/api/checkins', { userId: miaId })).data));
await check('POST /api/checkins (Mia)', async () => {
  const r = await api('/api/checkins', { method: 'POST', userId: miaId, body: { type: 'load', score: 6 } });
  return r.status === 201;
});

// Worker (Sarah — dual)
await check('GET /api/worker-hub (Sarah, 2 contexts)', async () => {
  const d = (await api('/api/worker-hub', { userId: sarahId })).data;
  return Array.isArray(d.contexts) && d.contexts.length === 2;
});
await check('POST /api/worker-hub/flag-support (Sarah)', async () => {
  const r = await api('/api/worker-hub/flag-support', { method: 'POST', userId: sarahId });
  return r.status === 200;
});

// Coordinator
await check('GET /api/roster (Tonia, 20)', async () => (await api('/api/roster', { userId: toniaId })).data.length === 20);
await check('GET /api/requests (Tonia)', async () => Array.isArray((await api('/api/requests', { userId: toniaId })).data));
await check('GET /api/verification (Tonia, 20)', async () => (await api('/api/verification', { userId: toniaId })).data.length === 20);
await check('POST /api/roster/:id/welfare-chat', async () => {
  const roster = (await api('/api/roster', { userId: toniaId })).data;
  const r = await api(`/api/roster/${roster[0].id}/welfare-chat`, { method: 'POST', userId: toniaId });
  return r.status === 200;
});

// Admin
await check('GET /api/admin/kpis', async () => (await api('/api/admin/kpis', { userId: adminId })).data.length === 6);
await check('GET /api/admin/alerts', async () => Array.isArray((await api('/api/admin/alerts', { userId: adminId })).data));
await check('GET /api/admin/activity', async () => Array.isArray((await api('/api/admin/activity', { userId: adminId })).data));
await check('GET /api/admin/people', async () => (await api('/api/admin/people', { userId: adminId })).data.length === 3);
await check('GET /api/admin/health', async () => (await api('/api/admin/health', { userId: adminId })).data.length === 4);
await check('GET /api/verification (admin, >= 32)', async () => (await api('/api/verification', { userId: adminId })).data.length >= 32);
await check('GET /api/roster (admin, 20)', async () => (await api('/api/roster', { userId: adminId })).data.length === 20);
await check('GET /api/charts/trend', async () => (await api('/api/charts/trend', { userId: adminId })).data.length === 7);
await check('GET /api/charts/status', async () => (await api('/api/charts/status', { userId: adminId })).data.length === 3);
await check('GET /api/charts/revenue', async () => (await api('/api/charts/revenue')).data.length === 6);

// Register (dedup)
await check('POST /api/auth/register (dedup)', async () => {
  const email = `smoke-${Date.now()}@test.com`;
  const r1 = await api('/api/auth/register', { method: 'POST', body: { door: 'client', name: 'Smoke', email, password: 'test1234', interests: ['dogs'] } });
  const r2 = await api('/api/auth/register', { method: 'POST', body: { door: 'client', name: 'Smoke', email, password: 'test1234', interests: ['dogs'] } });
  return r1.status === 201 && r2.status === 200 && r2.data.alreadyExists === true;
});

// Auth guard
await check('Unauthenticated blocked', async () => {
  const r = await api('/api/roster');
  return r.status === 401;
});
await check('Wrong role blocked', async () => {
  const r = await api('/api/roster', { userId: clientId });
  return r.status === 403;
});

// ============================================================
// AUTH 1D + 1E — registration, verification, password reset
// ============================================================
console.log('\n--- Auth: registration + verification + reset ---');

const uniqueEmail = `smoke-auth-${Date.now()}@test.com`;
const originalPassword = 'test1234';
const newPassword = 'newpass5678';
let verifyToken = null;
let resetToken = null;

await check('POST /api/auth/register returns devToken', async () => {
  const r = await api('/api/auth/register', {
    method: 'POST',
    body: { door: 'client', name: 'Smoke Auth', email: uniqueEmail, password: originalPassword, interests: ['dogs'] },
  });
  if (r.status !== 201) return false;
  if (!r.data.devToken) return false;
  verifyToken = r.data.devToken;
  return true;
});

await check('POST /api/login blocked before verify', async () => {
  const r = await api('/api/login', {
    method: 'POST',
    body: { email: uniqueEmail, password: originalPassword },
  });
  return r.status === 403 && r.data.needsVerification === true;
});

await check('GET /api/verify-email/:token succeeds', async () => {
  const r = await api(`/api/verify-email/${verifyToken}`);
  return r.data.ok === true;
});

await check('POST /api/login succeeds after verify', async () => {
  const r = await api('/api/login', {
    method: 'POST',
    body: { email: uniqueEmail, password: originalPassword },
  });
  return r.status === 200 && r.data.ok === true && !!r.data.token;
});

await check('POST /api/auth/forgot-password returns devToken', async () => {
  const r = await api('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: uniqueEmail },
  });
  if (r.status !== 200) return false;
  if (!r.data.devToken) return false;
  resetToken = r.data.devToken;
  return true;
});

await check('POST /api/auth/reset-password succeeds', async () => {
  const r = await api('/api/auth/reset-password', {
    method: 'POST',
    body: { token: resetToken, password: newPassword },
  });
  return r.status === 200 && r.data.ok === true;
});

await check('POST /api/login works with new password', async () => {
  const r = await api('/api/login', {
    method: 'POST',
    body: { email: uniqueEmail, password: newPassword },
  });
  return r.status === 200 && r.data.ok === true;
});

await check('POST /api/login fails with old password', async () => {
  const r = await api('/api/login', {
    method: 'POST',
    body: { email: uniqueEmail, password: originalPassword },
  });
  return r.status === 401;
});

await check('POST /api/auth/forgot-password for unknown email is silent', async () => {
  const r = await api('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: 'nobody-here@nowhere.test' },
  });
  return r.status === 200 && r.data.ok === true && r.data.devToken === undefined;
});

console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);