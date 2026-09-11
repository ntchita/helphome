import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { calculateWellnessMatch, rankWorkers } from './utils/matcher.ts';

const app = new Hono();

// Enable CORS for frontend
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://helphome-app.pages.dev', 'https://helphome.au', 'https://www.helphome.au'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// =====================================================================
// SINGLE SOURCE OF TRUTH (All data unified here)
// =====================================================================

// 1. UNIFIED WORKERS (Source for Dashboard, Register, ManagerHub, Verification)
const workers = [
  {
    id: 1, name: 'Jane Doe', role: 'Personal Care', bio: 'Experienced support worker who loves animals.',
    interests: ['dogs', 'music', 'outdoors'], skills: ['Personal Care', 'Medication Management', 'Companionship'],
    rate: 42, capacity: { booked: 22, total: 30 }, availability: 'Sat, Sun', checkins: [7, 8, 6, 7],
    lastCheckin: 'Today', status: 'Steady' as const, checks: 'NDIS Worker Screening · Police check · References', verificationStatus: 'verified' as const
  },
  {
    id: 2, name: 'Sarah Lee', role: 'Community Access', bio: 'Artist at heart, love cultural outings.',
    interests: ['music', 'art', 'reading'], skills: ['Community Access', 'Art Programs', 'Social Support'],
    rate: 38, capacity: { booked: 18, total: 30 }, availability: 'Mon, Wed, Sat', checkins: [8, 7, 8, 8],
    lastCheckin: 'Yesterday', status: 'Thriving' as const, checks: 'NDIS Worker Screening · Police check', verificationStatus: 'verified' as const
  },
  {
    id: 3, name: 'John Smith', role: 'Transport', bio: 'Former coach, great for active clients.',
    interests: ['fitness', 'outdoors', 'cooking'], skills: ['Transport', 'Fitness Coaching', 'Meal Prep'],
    rate: 40, capacity: { booked: 24, total: 30 }, availability: 'No openings this week', checkins: [5, 4, 6, 5],
    lastCheckin: '2 days ago', status: 'At Risk' as const, checks: 'NDIS Worker Screening · References', verificationStatus: 'pending' as const
  }
];

// 2. CLIENT PROFILE & INTERESTS
const clientProfile = { id: 'client-1', name: 'Demo Client', email: 'client@test.com', plan: 'starter', interests: ['dogs', 'music', 'outdoors'], needs: ['Personal Care', 'Companionship'] };
const interests = ['Dogs', 'Music', 'Outdoors', 'Art', 'Fitness', 'Cooking', 'Reading', 'Gardening'];

// 3. BOOKINGS & REQUESTS
let bookings = [
  { id: 'b1', clientName: 'Mark T.', workerId: '1', service: 'Personal Care', date: 'Fri 10:00', status: 'pending' },
  { id: 'b2', clientName: 'Sarah L.', workerId: '2', service: 'Community Access', date: 'Wed 13:00', status: 'accepted' },
  { id: 'b3', clientName: 'David W.', workerId: '3', service: 'Transport', date: 'Mon 09:00', status: 'declined' },
  { id: 'b4', clientName: 'Emma P.', workerId: '1', service: 'Personal Care', date: 'Thu 14:00', status: 'accepted' },
  { id: 'b5', clientName: 'Chris B.', workerId: '2', service: 'Community Access', date: 'Sat 11:00', status: 'pending' },
  { id: 'b6', clientName: 'Lisa M.', workerId: '3', service: 'Transport', date: 'Tue 15:00', status: 'accepted' },
];

let clientRequests = [
  { id: 1, client: 'Mark T.', worker: 'Jane Doe', service: 'Personal Care', when: 'Fri 10:00–14:00', matchPct: 85, status: 'accepted' },
  { id: 2, client: 'Priya K.', worker: 'Sarah Lee', service: 'Community Access', when: 'Sat 9:00–13:00', matchPct: 78, status: 'accepted' },
  { id: 3, client: 'Dana W.', worker: 'John Smith', service: 'Transport', when: 'Mon 8:00–12:00', matchPct: 72, status: 'declined' },
  { id: 4, client: 'Alex R.', worker: 'Jane Doe', service: 'Personal Care', when: 'Sun 9:00–12:00', matchPct: 64, status: 'pending' },
  { id: 5, client: 'Mei L.', worker: 'Sarah Lee', service: 'Community Access', when: 'Wed 13:00–16:00', matchPct: 81, status: 'accepted' },
  { id: 6, client: 'Tom B.', worker: 'John Smith', service: 'Transport', when: 'Tue 7:00–10:00', matchPct: 58, status: 'declined' },
];

// 4. WORKER HUB & CHECKINS
const workerHub = {
  workerId: '1', name: 'Jane Doe', role: 'Support Worker · Personal Care',
  capacity: { booked: 22, total: 30 },
  request: { id: 'r1', client: 'Mark T.', service: 'Personal Care', when: 'Fri 10:00–14:00', matchedOn: 'dogs', matchPct: 85, status: 'pending' as 'pending' | 'accepted' | 'declined' }
};

let checkinHistory = [
  { day: 'Mon', score: 6 }, { day: 'Tue', score: 7 }, { day: 'Wed', score: 5 }, { day: 'Thu', score: 7 },
];

// 5. ADMIN DASHBOARD DATA
const kpis = [
  { label: 'Active clients', value: '12', trend: '+3 this month', up: true },
  { label: 'Active workers', value: '3', trend: 'Pilot capacity', up: true },
  { label: 'Managers', value: '2', trend: '+1 pending invite', up: true },
  { label: 'Bookings this week', value: '6', trend: '↑ from 4 last week', up: true },
  { label: 'Acceptance rate', value: '67%', trend: '4 of 6 accepted', up: false },
  { label: 'Avg wellness match', value: '78%', trend: '↑ from 71%', up: true },
];

let alerts = [
  { id: 1, icon: '🔴', level: 'danger', text: 'John Smith — wellbeing At Risk. Welfare chat scheduled by manager.', action: 'View in Manager Hub', link: '/manager', dismissed: false },
  { id: 2, icon: '🟡', level: 'warn', text: '1 verification pending — John Smith (Transport). Background check awaiting review.', action: 'Open Verification Queue', link: '/verification', dismissed: false },
  { id: 3, icon: '🟡', level: 'warn', text: '2 client requests declined this week. Auto re-match offered to clients.', action: 'View Client Requests', link: '/requests', dismissed: false },
  { id: 4, icon: '🔵', level: 'info', text: 'Worker capacity at 71% average across roster. No overload flags.', action: 'View Manager Hub', link: '/manager', dismissed: false },
];

const activity = [
  { time: 'Today 11:42', event: 'Jane Doe accepted booking — Mark T. · Personal Care · Fri 10:00', icon: '✅' },
  { time: 'Today 10:15', event: 'Jane Doe submitted wellbeing check-in — Load & Energy: 7/10', icon: '💚' },
  { time: 'Today 09:30', event: 'Manager scheduled welfare chat with John Smith', icon: '📞' },
  { time: 'Yesterday', event: 'Mei L. booked Sarah Lee — Community Access · Wed 13:00', icon: '📋' },
  { time: 'Yesterday', event: 'Sarah Lee submitted wellbeing check-in — Feeling Supported: 8/10', icon: '💚' },
  { time: 'Mon', event: 'John Smith declined booking — Dana W. · Transport (no penalty applied)', icon: '↩️' },
  { time: 'Mon', event: 'New worker application received — John Smith (Transport)', icon: '🆕' },
  { time: 'Mon', event: 'Tom B. booking declined by John Smith — auto re-match triggered', icon: '🔄' },
];

const people = [
  { label: 'Clients', count: 12, detail: '2 new this week · 4 active bookings', link: '/requests', linkLabel: 'Client Requests →' },
  { label: 'Workers', count: 3, detail: '1 flagged (At Risk) · avg 71% capacity', link: '/manager', linkLabel: 'Manager Hub →' },
  { label: 'Managers', count: 2, detail: '1 active · 1 pending invite', link: '', linkLabel: 'Roster view post-pilot' },
];

const platformHealth = [
  { label: 'Worker capacity', pct: 71 },
  { label: 'Booking acceptance', pct: 67, warn: true },
  { label: 'Wellness engagement', pct: 83 },
  { label: 'Client satisfaction', pct: 92 },
];

// 6. CHARTS DATA
const wellnessTrend = [
  { day: 'Mon', score: 6.2 }, { day: 'Tue', score: 6.5 }, { day: 'Wed', score: 6.4 },
  { day: 'Thu', score: 6.8 }, { day: 'Fri', score: 7.1 }, { day: 'Sat', score: 7.0 }, { day: 'Sun', score: 7.4 },
];

const revenue = [
  { month: 'Apr', amount: 420 }, { month: 'May', amount: 610 }, { month: 'Jun', amount: 580 },
  { month: 'Jul', amount: 760 }, { month: 'Aug', amount: 940 }, { month: 'Sep', amount: 1180 },
];

// 7. AUTH & STUBS
const accounts: Record<string, { role: string; password: string }> = {
  'client@test.com': { role: 'client', password: 'test' },
  'worker@test.com': { role: 'worker', password: 'test' },
  'manager@test.com': { role: 'manager', password: 'test' },
  'admin@test.com': { role: 'admin', password: 'test' },
};

const demoAccounts = [
  { label: 'Client', email: 'client@test.com' },
  { label: 'Worker', email: 'worker@test.com' },
  { label: 'Manager', email: 'manager@test.com' },
  { label: 'Admin', email: 'admin@test.com' },
];

const signups: any[] = [];
const clientWellnessLogs: any[] = [];
const welfareChats: Record<string, boolean> = {};

// =====================================================================
// ROUTES
// =====================================================================

app.get('/', (c) => c.json({ message: 'HelpHome API Active', version: '2.0.0' }));

// --- Workers & Matching ---
app.get('/api/workers', (c) => {
  const profile = { interests: clientProfile.interests, needs: clientProfile.needs };
  const ranked = rankWorkers(workers as any, profile);
  return c.json(ranked.map((w: any) => ({
    ...w,
    capacityPct: Math.round((w.capacity.booked / w.capacity.total) * 100),
    wellnessMatchScore: calculateWellnessMatch(w, profile),
    wellnessMatch: calculateWellnessMatch(w, profile),
    platformFee: 0.0,
    totalCost: w.rate,
  })));
});

app.get('/api/interests', (c) => c.json(interests));
app.get('/api/client-profile', (c) => c.json(clientProfile));

// --- Bookings & Requests ---
app.get('/api/bookings', (c) => c.json(bookings));
app.post('/api/bookings', async (c) => {
  const body = await c.req.json();
  const worker = workers.find((w) => w.id === Number(body.workerId));
  const profile = { interests: clientProfile.interests, needs: clientProfile.needs };
  const matchScore = worker ? calculateWellnessMatch(worker as any, profile) : 0;
  bookings.push({
    id: `b${Date.now()}`,
    clientName: body.clientId || 'Demo Client',
    workerId: String(body.workerId),
    service: body.serviceType || 'Standard Support',
    date: 'New request',
    status: 'pending',
  });
  clientRequests.push({
    id: Date.now(),
    client: body.clientId || 'Demo Client',
    worker: worker ? worker.name : 'Unknown',
    service: body.serviceType || 'Standard Support',
    when: 'New request',
    matchPct: matchScore,
    status: 'pending',
  });
  return c.json({ ok: true, matchScore }, 201);
});

app.get('/api/requests', (c) => c.json(clientRequests));

// --- Worker Hub ---
app.get('/api/worker-hub', (c) => c.json(workerHub));
app.get('/api/checkins', (c) => c.json(checkinHistory));
app.post('/api/checkins', async (c) => {
  const body = await c.req.json();
  const entry = { day: 'Today', score: Number(body.score) };
  const last = checkinHistory[checkinHistory.length - 1];
  if (last && last.day === 'Today') checkinHistory[checkinHistory.length - 1] = entry;
  else {
    checkinHistory.push(entry);
    if (checkinHistory.length > 4) checkinHistory.shift();
  }
  return c.json({ ok: true, entry }, 201);
});
app.post('/api/worker-hub/decision', async (c) => {
  const body = await c.req.json();
  workerHub.request.status = body.decision === 'accept' ? 'accepted' : 'declined';
  return c.json({ ok: true });
});

// --- Manager Hub Roster (Derived from unified workers) ---
app.get('/api/roster', (c) => c.json(workers.map((w) => ({
  id: String(w.id), name: w.name, role: `Support Worker · ${w.role}`, capacity: w.capacity,
  availability: w.availability, checkins: [...w.checkins], lastCheckin: w.lastCheckin,
}))));
app.post('/api/roster/:id/welfare-chat', (c) => {
  welfareChats[c.req.param('id')] = true;
  return c.json({ ok: true });
});

// --- Admin Dashboard ---
app.get('/api/admin/kpis', (c) => {
  const accepted = clientRequests.filter((r) => r.status === 'accepted').length;
  const total = clientRequests.length;
  const acceptancePct = total ? Math.round((accepted / total) * 100) : 0;
  
  return c.json(kpis.map((k) => {
    if (k.label === 'Acceptance rate') {
      return { ...k, value: `${acceptancePct}%`, trend: `${accepted} of ${total} accepted`, up: acceptancePct >= 60 };
    }
    if (k.label === 'Bookings this week') {
      return { ...k, value: String(total) };
    }
    return k;
  }));
});
app.get('/api/admin/alerts', (c) => c.json(alerts));
app.post('/api/admin/alerts/:id/dismiss', (c) => {
  const alert = alerts.find((a) => a.id === Number(c.req.param('id')));
  if (alert) alert.dismissed = true;
  return c.json({ ok: true });
});
app.get('/api/admin/activity', (c) => c.json(activity));
app.get('/api/admin/people', (c) => c.json(people));
app.get('/api/admin/health', (c) => {
  const accepted = clientRequests.filter((r) => r.status === 'accepted').length;
  const total = clientRequests.length;
  const acceptancePct = total ? Math.round((accepted / total) * 100) : 0;
  const avgCapacity = Math.round(workers.reduce((a, w) => a + Math.round((w.capacity.booked / w.capacity.total) * 100), 0) / workers.length);
  
  return c.json(platformHealth.map((h) => {
    if (h.label === 'Worker capacity') return { ...h, pct: avgCapacity };
    if (h.label === 'Booking acceptance') return { ...h, pct: acceptancePct, warn: acceptancePct < 60 };
    return h;
  }));
});

// --- Charts ---
app.get('/api/charts/trend', (c) => c.json(wellnessTrend));
app.get('/api/charts/status', (c) => c.json([
  { label: 'Accepted', value: clientRequests.filter((r) => r.status === 'accepted').length, color: '#00D68F' },
  { label: 'Pending', value: clientRequests.filter((r) => r.status === 'pending').length, color: '#F39C12' },
  { label: 'Declined', value: clientRequests.filter((r) => r.status === 'declined').length, color: '#DC3545' },
]));
app.get('/api/charts/revenue', (c) => c.json(revenue));

// --- Verification Queue (Derived from unified workers) ---
app.get('/api/verification', (c) => c.json(workers.map((w) => ({
  id: w.id, name: w.name, checks: w.checks, status: w.verificationStatus,
}))));
app.post('/api/verification/:id/toggle', (c) => {
  const worker = workers.find((w) => w.id === Number(c.req.param('id')));
  if (!worker) return c.json({ success: false, message: 'Worker not found' }, 404);
  worker.verificationStatus = worker.verificationStatus === 'verified' ? 'pending' : 'verified';
  return c.json({ id: worker.id, name: worker.name, checks: worker.checks, status: worker.verificationStatus });
});
app.get('/api/verification/activity', (c) => c.json([
  'Jane Doe accepted a booking request — Thu 9:00',
  'Sarah Lee submitted a wellness check (4/5) — Wed',
  'New worker application received: John Smith — Mon',
]));
app.get('/api/verification/stats', (c) => c.json([
  { value: String(workers.length), label: 'active support workers' },
  { value: String(bookings.length), label: 'bookings this week' },
  { value: String(checkinHistory.length), label: 'wellness check-ins this week' },
]));

// --- Auth ---
app.get('/api/demo-accounts', (c) => c.json(demoAccounts));
app.post('/api/login', async (c) => {
  const body = await c.req.json();
  const account = accounts[body.email];
  if (account && account.password === body.password) return c.json({ ok: true, role: account.role });
  return c.json({ ok: false }, 401);
});

// --- Stubs ---
app.post('/api/auth/register', async (c) => {
  const body = await c.req.json();
  signups.push({ id: signups.length + 1, ...body, createdAt: new Date().toISOString() });
  return c.json({ success: true, message: 'Registered (pilot waitlist)' }, 201);
});
app.post('/api/wellness', async (c) => {
  const body = await c.req.json();
  clientWellnessLogs.push({ id: clientWellnessLogs.length + 1, ...body, at: new Date().toISOString() });
  return c.json({ success: true, message: 'Wellness check recorded' }, 201);
});

export default app;