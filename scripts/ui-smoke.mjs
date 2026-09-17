import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8787';
let pass = 0, fail = 0;
const results = [];

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

async function dbCounts() {
  const r = await fetch(`${API}/api/_test/db/counts`);
  return r.json();
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

async function login(email) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  // click the demo role button matching email
  await page.getByRole('button', { name: /CareWork Client|Independent Worker|Coordinator Worker|Coordinator Admin|CareWork Admin/i }).first().click().catch(() => {});
  // direct email/password fill to be safe
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'test');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

async function logout() {
  await page.evaluate(() => localStorage.clear());
}

const before = await dbCounts();

// T1 — Client
await check('T1 client login → dashboard', async () => {
  await login('jane.doe@client.com');
  await page.waitForURL('**/dashboard', { timeout: 5000 });
  return page.url().includes('/dashboard');
});
await check('T1 dashboard shows workers', async () => {
  await page.waitForSelector('.worker-card', { timeout: 5000 });
  return (await page.locator('.worker-card').count()) > 0;
});
await check('T1 wellness page loads', async () => {
  await page.goto(`${BASE}/wellness`);
  await page.waitForSelector('form', { timeout: 5000 });
  return true;
});
await check('T1 wellness submit', async () => {
  await page.click('button[type="submit"]');
  await page.waitForSelector('.wellness-success', { timeout: 5000 });
  return true;
});
await logout();

// T2 — Independent worker
await check('T2 worker login → my-hub', async () => {
  await login('mia.chen@worker.com');
  await page.waitForURL('**/my-hub', { timeout: 5000 });
  return page.url().includes('/my-hub');
});
await check('T2 my-hub renders', async () => {
  await page.waitForSelector('.hub-card', { timeout: 5000 });
  return true;
});
await logout();

// T3 — Dual worker
await check('T3 dual worker → 2 tabs', async () => {
  await login('sarah.johnson@helphome-worker.com');
  await page.waitForURL('**/my-hub', { timeout: 5000 });
  await page.waitForSelector('.hub-tab', { timeout: 5000 });
  return (await page.locator('.hub-tab').count()) >= 2;
});
await logout();

// T4 — Coordinator
await check('T4 coordinator login → /coordinator', async () => {
  await login('tonia@helphome.au');
  await page.waitForURL('**/coordinator', { timeout: 5000 });
  return page.url().includes('/coordinator');
});
await check('T4 coordinator hub shows 20 workers', async () => {
  await page.waitForSelector('.hub-card', { timeout: 5000 });
  const n = await page.locator('.hub-card').count();
  return n === 20;
});
await check('T4 verification page loads', async () => {
  await page.goto(`${BASE}/verification`);
  await page.waitForSelector('.queue-row', { timeout: 5000 });
  return (await page.locator('.queue-row').count()) > 0;
});
await logout();

// T5 — Admin
await check('T5 admin login → /admin', async () => {
  await login('admin@carework.au');
  await page.waitForURL('**/admin', { timeout: 5000 });
  return page.url().includes('/admin');
});
await check('T5 admin dashboard KPIs', async () => {
  await page.waitForSelector('.kpi-card', { timeout: 5000 });
  return (await page.locator('.kpi-card').count()) === 6;
});
await check('T5 admin coordinator hub loads', async () => {
  await page.goto(`${BASE}/coordinator`);
  await page.waitForSelector('.hub-card', { timeout: 5000 });
  return (await page.locator('.hub-card').count()) === 20;
});
await check('T5 admin verification loads 32', async () => {
  await page.goto(`${BASE}/verification`);
  await page.waitForSelector('.queue-row', { timeout: 5000 });
  return (await page.locator('.queue-row').count()) === 32;
});
await check('T5 admin client requests loads', async () => {
  await page.goto(`${BASE}/requests`);
  await page.waitForSelector('.queue-row, .card', { timeout: 5000 });
  return true;
});
await logout();

// T6 — Register
await check('T6 register door selection', async () => {
  await page.goto(`${BASE}/register`);
  await page.waitForSelector('.door-card', { timeout: 5000 });
  return (await page.locator('.door-card').count()) === 3;
});
await check('T6 register client flow', async () => {
  const email = `ui-smoke-${Date.now()}@test.com`;
  await page.locator('.door-card').first().click();
  await page.fill('input[placeholder="Your name"]', 'UI Smoke');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'testtest');
  await page.locator('input[placeholder="Re-enter password"]').fill('testtest');
  await page.selectOption('select', 'ndis');
  await page.waitForTimeout(200);
  await page.selectOption('select >> nth=1', 'PlanCare');
  // pick first interest chip
  await page.locator('.chip').first().click();
  await page.click('button[type="submit"]');
  await page.waitForSelector('.worker-grid', { timeout: 5000 });
  return true;
});
await logout();

// Session guard
await check('Session guard bounces invalid user', async () => {
  await page.goto(`${BASE}/login`);
  await page.evaluate(() => {
    localStorage.setItem('helphome_logged_in', 'true');
    localStorage.setItem('helphome_role', 'client');
    localStorage.setItem('helphome_user_id', 'bogus-id');
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL('**/login', { timeout: 5000 });
  return page.url().includes('/login');
});

const after = await dbCounts();

console.log('\n--- UI smoke results ---');
console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);

console.log('\n--- DB counts ---');
console.log('before:', JSON.stringify(before));
console.log('after: ', JSON.stringify(after));

const growth = {
  signupLeads: after.signupLeads - before.signupLeads,
  wellnessLogs: after.wellnessLogs - before.wellnessLogs,
};
console.log('growth:', JSON.stringify(growth));
console.log('expected signupLeads +1, wellnessLogs +1');

if (errors.length) {
  console.log('\n--- Console / page errors ---');
  errors.slice(0, 10).forEach(e => console.log(' -', e));
}

await browser.close();
process.exit(fail ? 1 : 0);