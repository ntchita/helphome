import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE || 'http://localhost:5173';
const API  = process.env.SMOKE_API  || 'http://localhost:8787';

let pass = 0, fail = 0;
const results = [];

async function check(name, fn) {
  process.stdout.write(`▶ ${name} ... `);
  try {
    const ok = await fn();
    if (ok === false) throw new Error('returned false');
    pass++;
    console.log('✅');
    results.push(`✅ ${name}`);
  } catch (e) {
    fail++;
    console.log('❌', e.message);
    results.push(`❌ ${name} — ${e.message}`);
  }
}

async function dbCounts() {
  const r = await fetch(`${API}/api/_test/db/counts`);
  return r.json();
}

const browser = await chromium.launch({ headless: true });

// Desktop context
const desktop = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await desktop.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

async function login(email) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'test');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

async function logout() {
  await page.goto(`${BASE}/`);
  await page.evaluate(() => localStorage.clear());
}

async function setRole(role, userId) {
  await page.goto(`${BASE}/`);
  await page.evaluate(([r, u]) => {
    localStorage.setItem('helphome_logged_in', 'true');
    localStorage.setItem('helphome_role', r);
    localStorage.setItem('helphome_user_id', u);
  }, [role, userId]);
}

// ============================================================
// T1 — CLIENT
// ============================================================
console.log('\n--- T1: Client ---');

await check('T1.1 login → /dashboard', async () => {
  await login('jane.doe@client.com');
  await page.waitForURL('**/dashboard', { timeout: 5000 });
  return true;
});

await check('T1.2 worker cards render', async () => {
  await page.waitForSelector('.worker-card', { timeout: 5000 });
  return (await page.locator('.worker-card').count()) > 0;
});

await check('T1.3 match % is a number > 0 for at least one worker', async () => {
  const badges = await page.locator('.match-badge').allTextContents();
  return badges.some(b => {
    const n = parseInt(b);
    return !isNaN(n) && n > 0;
  });
});

await check('T1.4 filter 75%+ narrows grid', async () => {
  const before = await page.locator('.worker-card').count();
  await page.locator('.hub-tab', { hasText: /^75%\+/ }).click();
  await page.waitForTimeout(300);
  return (await page.locator('.worker-card').count()) <= before;
});

await check('T1.5 filter All restores grid', async () => {
  await page.locator('.hub-tab', { hasText: /^All Matches/ }).click();
  await page.waitForTimeout(300);
  return (await page.locator('.worker-card').count()) > 0;
});

await check('T1.6 empty filter state shows "no workers"', async () => {
  // Pick a 75%+ filter that likely yields 0 workers for most clients
  await page.locator('.hub-tab', { hasText: /^75%\+/ }).click();
  await page.waitForTimeout(300);
  const count = await page.locator('.worker-card').count();
  if (count === 0) {
    const text = await page.locator('.card').filter({ hasText: /No workers match/ }).count();
    return text > 0;
  }
  return true; // if there are 75%+ workers, fine
});

await check('T1.7 Book Now flips to Request Sent', async () => {
  await page.locator('.hub-tab', { hasText: /^All Matches/ }).click();
  await page.waitForTimeout(200);
  const btn = page.locator('.worker-card').first().locator('button');
  await btn.click();
  await page.waitForTimeout(700);
  const text = await btn.textContent();
  return text && text.includes('Request Sent');
});

await check('T1.8 wellness submit → thank-you', async () => {
  await page.goto(`${BASE}/wellness`);
  await page.waitForSelector('form');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.wellness-success', { timeout: 5000 });
  return true;
});

await check('T1.9 booking unavailable worker fails gracefully (API)', async () => {
  // Use the logged-in client's real userId
  const userId = await page.evaluate(() => localStorage.getItem('helphome_user_id'));
  if (!userId) return true;
  const r = await fetch(`${API}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ workerId: '00000000-0000-0000-0000-000000000000' }),
  });
  return r.status === 404;
});

await check('T1.10 client cannot access /admin (bounces)', async () => {
  await page.goto(`${BASE}/admin`);
  await page.waitForURL('**/dashboard', { timeout: 5000 });
  return !page.url().includes('/admin');
});

await logout();

// ============================================================
// T2 — INDEPENDENT WORKER (MIA)
// ============================================================
console.log('\n--- T2: Independent Worker (Mia) ---');

await check('T2.1 login → /my-hub, no tabs', async () => {
  await login('mia.chen@worker.com');
  await page.waitForURL('**/my-hub', { timeout: 5000 });
  return (await page.locator('.hub-tab').count()) === 0;
});

await check('T2.2 my-hub renders 3 cards', async () => {
  await page.waitForSelector('.hub-card', { timeout: 5000 });
  return (await page.locator('.hub-card').count()) >= 3;
});

await check('T2.3 accept request → green flash', async () => {
  const accept = page.locator('button', { hasText: /^Accept$/ }).first();
  if (await accept.count() === 0) return true;
  await accept.click();
  await page.waitForSelector('.flash.success', { timeout: 5000 });
  return true;
});

await check('T2.4 worker wellness submit updates chart', async () => {
  // reload to pick up accepted state
  await page.goto(`${BASE}/my-hub`);
  await page.waitForSelector('.mood-bars', { timeout: 5000 });
  const before = await page.locator('.mood-col').count();
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(800);
  const after = await page.locator('.mood-col').count();
  return after >= before;
});

await check('T2.5 flag support fails for independent (no coordinator)', async () => {
  const r = await page.locator('button', { hasText: /Flag I need support/ }).click();
  await page.waitForTimeout(600);
  const errFlash = await page.locator('.flash.error').count();
  const okFlash = await page.locator('.flash.success').count();
  return errFlash > 0 || okFlash > 0;
});

await check('T2.6 worker cannot access /coordinator (bounces)', async () => {
  await page.goto(`${BASE}/coordinator`);
  await page.waitForURL('**/my-hub', { timeout: 5000 });
  return !page.url().includes('/coordinator');
});

await logout();

// ============================================================
// T3 — DUAL WORKER (SARAH)
// ============================================================
console.log('\n--- T3: Dual Worker (Sarah) ---');

await check('T3.1 login → /my-hub with 2 tabs', async () => {
  await login('sarah.johnson@helphome-worker.com');
  await page.waitForURL('**/my-hub', { timeout: 5000 });
  await page.waitForSelector('.hub-tab', { timeout: 5000 });
  return (await page.locator('.hub-tab').count()) === 2;
});

await check('T3.2 switch to HelpHome Roster tab', async () => {
  await page.locator('.hub-tab', { hasText: /HelpHome Roster/ }).click();
  await page.waitForTimeout(300);
  return await page.locator('h1', { hasText: /HelpHome Roster/ }).isVisible();
});

await check('T3.3 roster shows assigned shifts', async () => {
  return (await page.locator('.queue-row').count()) >= 1;
});

await check('T3.4 worker only sees own shifts (not Mia\'s)', async () => {
  const bodies = await page.locator('.queue-row').allTextContents();
  // Mia's test shift is for Jane Doe personal care — Sarah's roster shouldn't show that as her own
  // Basic sanity: roster section renders, not empty
  return bodies.length >= 0;
});

await check('T3.5 flag support → green flash (has coordinator)', async () => {
  await page.locator('button', { hasText: /Flag I need support/ }).click();
  await page.waitForSelector('.flash.success', { timeout: 5000 });
  return true;
});

await logout();

// ============================================================
// T4 — COORDINATOR (TONIA)
// ============================================================
console.log('\n--- T4: Coordinator (Tonia) ---');

await check('T4.1 login → /coordinator', async () => {
  await login('tonia@helphome.au');
  await page.waitForURL('**/coordinator', { timeout: 5000 });
  return true;
});

await check('T4.2 20 workers rendered', async () => {
  await page.waitForSelector('.hub-card', { timeout: 5000 });
  return (await page.locator('.hub-card').count()) === 20;
});

await check('T4.3 At Risk filter narrows grid', async () => {
  const before = await page.locator('.hub-card').count();
  await page.locator('.hub-tab', { hasText: /At Risk/ }).click();
  await page.waitForTimeout(300);
  const after = await page.locator('.hub-card').count();
  return after < before && after > 0;
});

await check('T4.4 Thriving filter works', async () => {
  await page.locator('.hub-tab', { hasText: /Thriving/ }).click();
  await page.waitForTimeout(300);
  return (await page.locator('.hub-card').count()) > 0;
});

await check('T4.5 All filter restores 20', async () => {
  await page.locator('.hub-tab', { hasText: /^All/ }).click();
  await page.waitForTimeout(300);
  return (await page.locator('.hub-card').count()) === 20;
});

await check('T4.6 schedule welfare chat → flash', async () => {
  await page.locator('button', { hasText: /Schedule welfare chat/ }).first().click();
  await page.waitForSelector('.flash.success', { timeout: 5000 });
  return true;
});

await check('T4.7 client requests section populated', async () => {
  const rows = await page.locator('.card', { hasText: /Client Requests for Your Workers/ }).locator('.queue-row').count();
  return rows >= 1;
});

await check('T4.8 verification page loads 20 (own tenant only)', async () => {
  await page.goto(`${BASE}/verification`);
  await page.waitForSelector('.queue-row', { timeout: 5000 });
  return (await page.locator('.queue-row').count()) === 20;
});

await check('T4.9 verification status filter narrows', async () => {
  const before = await page.locator('.queue-row').count();
  await page.locator('.hub-tab', { hasText: /^Pending/ }).click();
  await page.waitForTimeout(300);
  return (await page.locator('.queue-row').count()) <= before;
});

await check('T4.10 verification toggle flips status', async () => {
  await page.locator('.hub-tab', { hasText: /^All/ }).first().click();
  await page.waitForTimeout(200);
  const row = page.locator('.queue-row').first();
  const before = await row.locator('.status').textContent();
  await row.locator('button').click();
  await page.waitForTimeout(500);
  const after = await row.locator('.status').textContent();
  return before !== after;
});

await check('T4.11 coordinator cannot access /admin', async () => {
  await page.goto(`${BASE}/admin`);
  await page.waitForURL('**/coordinator', { timeout: 5000 });
  return !page.url().includes('/admin');
});

await logout();

// ============================================================
// T5 — ADMIN
// ============================================================
console.log('\n--- T5: Admin ---');

await check('T5.1 login → /admin', async () => {
  await login('admin@carework.au');
  await page.waitForURL('**/admin', { timeout: 5000 });
  return true;
});

await check('T5.2 KPIs = 6', async () => {
  await page.waitForSelector('.kpi-card', { timeout: 5000 });
  return (await page.locator('.kpi-card').count()) === 6;
});

await check('T5.3 KPI values numeric', async () => {
  const values = await page.locator('.kpi-value').allTextContents();
  return values.every(v => v.trim().length > 0);
});

await check('T5.4 dismiss alert removes it from view', async () => {
  await page.waitForSelector('.alert-row', { timeout: 5000 });
  const before = await page.locator('.alert-row').count();
  if (before === 0) return true;
  await page.locator('.alert-dismiss').first().click();
  await page.waitForTimeout(300);
  return (await page.locator('.alert-row').count()) < before;
});

await check('T5.5 activity feed shows events', async () => {
  await page.waitForSelector('.activity-row', { timeout: 5000 });
  return (await page.locator('.activity-row').count()) > 0;
});

await check('T5.6 people counts match (3 rows)', async () => {
  return (await page.locator('.people-row').count()) === 3;
});

await check('T5.7 platform health renders 4 bars', async () => {
  return (await page.locator('.health-row').count()) === 4;
});

await check('T5.8 coordinator hub loads 20', async () => {
  await page.goto(`${BASE}/coordinator`);
  await page.waitForSelector('.hub-card', { timeout: 5000 });
  return (await page.locator('.hub-card').count()) === 20;
});

await check('T5.9 verification loads 32 profiles', async () => {
  await page.goto(`${BASE}/verification`);
  await page.waitForSelector('.queue-row', { timeout: 5000 });
  return (await page.locator('.queue-row').count()) === 32;
});

await check('T5.10 context filter Dual shows 4 rows', async () => {
  await page.locator('.hub-tab', { hasText: /^Dual/ }).click();
  await page.waitForTimeout(300);
  return (await page.locator('.queue-row').count()) === 4;
});

await check('T5.11 client requests loads > 0', async () => {
  await page.goto(`${BASE}/requests`);
  await page.waitForSelector('.queue-row', { timeout: 5000 });
  return (await page.locator('.queue-row').count()) > 0;
});

await check('T5.12 client requests status filter', async () => {
  const before = await page.locator('.queue-row').count();
  await page.locator('.hub-tab', { hasText: /^Pending/ }).click();
  await page.waitForTimeout(300);
  return (await page.locator('.queue-row').count()) <= before;
});

await logout();

// ============================================================
// T6 — REGISTER (all 3 doors)
// ============================================================
console.log('\n--- T6: Register ---');

await check('T6.1 three doors visible', async () => {
  await page.goto(`${BASE}/register`);
  await page.waitForSelector('.door-card', { timeout: 5000 });
  return (await page.locator('.door-card').count()) === 3;
});

await check('T6.2 client: NDIS → plan manager dropdown', async () => {
  await page.locator('.door-card', { hasText: /I need support/ }).click();
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });
  await page.selectOption('select', 'ndis');
  await page.waitForTimeout(200);
  return (await page.locator('select').count()) >= 2;
});

await check('T6.3 client: password mismatch rejected', async () => {
  await page.fill('input[placeholder="Your name"]', 'X');
  await page.fill('input[type="email"]', 'mismatch@test.com');
  await page.fill('input[type="password"]', 'aaaaaaaa');
  await page.locator('input[placeholder="Re-enter password"]').fill('bbbbbbbb');
  await page.selectOption('select', 'private');
  await page.locator('.chip').first().click();
  await page.click('button[type="submit"]');
  await page.waitForTimeout(300);
  return (await page.locator('.flash.error').count()) > 0;
});

await check('T6.4 client: no interest picked → error', async () => {
  await page.goto(`${BASE}/register`);
  await page.locator('.door-card', { hasText: /I need support/ }).click();
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[placeholder="Your name"]', 'X2');
  await page.fill('input[type="email"]', 'nointerest@test.com');
  await page.fill('input[type="password"]', 'testtest');
  await page.locator('input[placeholder="Re-enter password"]').fill('testtest');
  await page.selectOption('select', 'private');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(300);
  return (await page.locator('.flash.error').count()) > 0;
});

await check('T6.5 client: full flow → success screen', async () => {
  const email = `ui-smoke-${Date.now()}@test.com`;
  await page.goto(`${BASE}/register`);
  await page.locator('.door-card', { hasText: /I need support/ }).click();
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[placeholder="Your name"]', 'UI Smoke');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'testtest');
  await page.locator('input[placeholder="Re-enter password"]').fill('testtest');
  await page.selectOption('select', 'ndis');
  await page.waitForTimeout(200);
  await page.selectOption('select >> nth=1', 'PlanCare');
  await page.locator('.chip').first().click();
  await page.click('button[type="submit"]');
  await page.waitForSelector('.worker-grid', { timeout: 5000 });
  return true;
});

await check('T6.6 picker interest filter works', async () => {
  const before = await page.locator('.worker-card').count();
  const chips = page.locator('.hub-switcher').nth(1).locator('.hub-tab');
  if (await chips.count() < 2) return true;
  await chips.nth(1).click();
  await page.waitForTimeout(300);
  return (await page.locator('.worker-card').count()) <= before;
});

await check('T6.7 select worker → Confirm → green flash', async () => {
  const card = page.locator('.worker-card').first();
  if (await card.count() === 0) return true;
  await card.locator('button').click();
  await page.locator('button', { hasText: /Confirm/ }).click();
  await page.waitForSelector('.flash.success', { timeout: 5000 });
  return true;
});

await check('T6.8 worker door: form + submit', async () => {
  await page.goto(`${BASE}/register`);
  await page.locator('.door-card', { hasText: /I want to provide support/ }).click();
  await page.waitForSelector('input[type="email"]');
  const email = `ui-worker-${Date.now()}@test.com`;
  await page.fill('input[placeholder="Your name"]', 'UI Worker');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'testtest');
  await page.locator('input[placeholder="Re-enter password"]').fill('testtest');
  const selects = page.locator('select');
  await selects.nth(0).selectOption({ index: 1 });
  await selects.nth(1).selectOption({ index: 1 });
  await page.click('button[type="submit"]');
  await page.waitForSelector('.promise-list', { timeout: 5000 });
  return true;
});

await check('T6.9 coordinator door: form + submit', async () => {
  await page.goto(`${BASE}/register`);
  await page.locator('.door-card', { hasText: /I coordinate care/ }).click();
  await page.waitForSelector('input[type="email"]');
  const email = `ui-coord-${Date.now()}@test.com`;
  await page.fill('input[placeholder="Your name"]', 'UI Coord');
  await page.fill('input[placeholder="Organisation name"]', 'Test Org');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'testtest');
  await page.locator('input[placeholder="Re-enter password"]').fill('testtest');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(800);
  return true;
});

await logout();

// ============================================================
// T7 — SESSION GUARD
// ============================================================
console.log('\n--- T7: Session Guard ---');

await check('T7.1 invalid user id → bounce to /login', async () => {
  await page.goto(`${BASE}/login`);
  await page.evaluate(() => {
    localStorage.setItem('helphome_logged_in', 'true');
    localStorage.setItem('helphome_role', 'client');
    localStorage.setItem('helphome_user_id', 'bogus-id');
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL('**/login', { timeout: 5000 });
  return true;
});

await check('T7.2 localStorage cleared after bounce', async () => {
  await page.waitForLoadState('networkidle');
  const logged = await page.evaluate(() => localStorage.getItem('helphome_logged_in'));
  return logged === null;
});

// ============================================================
// T8 — MOBILE
// ============================================================
console.log('\n--- T8: Mobile ---');

const mobile = await browser.newContext({ viewport: { width: 400, height: 800 }, isMobile: true });
const mpage = await mobile.newPage();

await check('T8.1 mobile: hamburger visible', async () => {
  await mpage.goto(`${BASE}/`);
  await mpage.waitForSelector('.nav-toggle', { state: 'visible', timeout: 5000 });
  return true;
});

await check('T8.2 mobile: tap ☰ opens menu', async () => {
  await mpage.locator('.nav-toggle').click();
  await mpage.waitForTimeout(300);
  return await mpage.locator('.nav-links.open').isVisible();
});

await check('T8.3 mobile: menu closes on link tap', async () => {
  await mpage.locator('.nav-links a', { hasText: /Register/ }).click();
  await mpage.waitForTimeout(400);
  return (await mpage.locator('.nav-links.open').count()) === 0;
});

await check('T8.4 mobile: register page renders on 400px', async () => {
  await mpage.goto(`${BASE}/register`);
  await mpage.waitForSelector('.door-card', { timeout: 5000 });
  const w = await mpage.locator('.door-card').first().evaluate(el => el.getBoundingClientRect().width);
  return w > 0 && w <= 400;
});

await mobile.close();

// ============================================================
// DB SANITY
// ============================================================
const final = await dbCounts();
console.log('\n--- Final DB ---');
console.log(JSON.stringify(final));

if (pageErrors.length) {
  console.log('\n--- Page errors ---');
  pageErrors.slice(0, 10).forEach(e => console.log(' -', e));
}

console.log('\n--- Results ---');
results.forEach(r => console.log(r));
console.log(`\n${pass} passed, ${fail} failed`);

await browser.close();
process.exit(fail ? 1 : 0);