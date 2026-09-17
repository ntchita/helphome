import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/connection.ts';
import { calculateWellnessMatch, rankWorkers } from './utils/matcher.ts';

const app = new Hono();

const hoursBetween = (a: Date | string, b: Date | string) =>
  (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;

const formatWhen = (a: Date | string, b: Date | string) => {
  const s = new Date(a);
  const e = new Date(b);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${days[s.getDay()]} ${pad(s.getHours())}:${pad(s.getMinutes())}–${pad(e.getHours())}:${pad(e.getMinutes())}`;
};

const timeAgo = (d: Date | string, now: number) => {
  const diff = Math.floor((now - new Date(d).getTime()) / 86_400_000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
};

// Enable CORS for frontend
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://helphome-app.pages.dev'],
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

// 7. STUBS
const signups: any[] = [];
const clientWellnessLogs: any[] = [];
const welfareChats: Record<string, boolean> = {};

// =====================================================================
// ROUTES
// =====================================================================
app.get('/', (c) => c.json({ message: 'CareWork API Active', version: '2.0.0' }));

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

// --- Client Requests (DB-backed, tenant-scoped) ---
app.get('/api/requests', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'coordinator' && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  // coordinator → own tenant's shifts; admin → all shifts
  const base = db
    .select({
      shift: schema.shifts,
      clientName: schema.clientProfiles.fullName,
      workerName: schema.users.fullName,
    })
    .from(schema.shifts)
    .leftJoin(schema.clientProfiles, eq(schema.shifts.clientId, schema.clientProfiles.id))
    .leftJoin(schema.workerProfiles, eq(schema.shifts.workerId, schema.workerProfiles.id))
    .leftJoin(schema.users, eq(schema.workerProfiles.userId, schema.users.id));

  const rows = user.role === 'admin'
    ? await base
    : await base.where(eq(schema.shifts.tenantId, user.tenantId!));

  const fmtWhen = (a: Date | string, b: Date | string) => {
    const s = new Date(a);
    const e = new Date(b);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${days[s.getDay()]} ${pad(s.getHours())}:${pad(s.getMinutes())}–${pad(e.getHours())}:${pad(e.getMinutes())}`;
  };

  const mapped = rows.map((r) => ({
    id: r.shift.id,
    client: r.clientName || 'Client',
    worker: r.workerName || 'Unassigned',
    service: r.shift.serviceType || 'Support',
    when: fmtWhen(r.shift.startTime, r.shift.endTime),
    matchPct: r.shift.matchScore || 0,
    status: r.shift.status === 'offered' ? 'pending'
           : r.shift.status === 'cancelled' ? 'declined'
           : r.shift.status === 'accepted' || r.shift.status === 'in_progress' || r.shift.status === 'completed' ? 'accepted'
           : r.shift.status,
  }));

  return c.json(mapped);
});

// --- Worker Hub (DB-backed, returns both contexts) ---
app.get('/api/worker-hub', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'worker') return c.json({ error: 'Not a worker' }, 403);

  const profiles = await db.select().from(schema.workerProfiles).where(eq(schema.workerProfiles.userId, user.id));
  const indProfile = profiles.find((p) => p.workerType === 'independent');
  const coordProfile = profiles.find((p) => p.workerType === 'coordinator');

  const contexts: string[] = [];
  if (coordProfile) contexts.push('coordinator');
  if (indProfile) contexts.push('independent');

  // --- marketplace ---
  let marketplace: any = null;
  if (indProfile) {
    const rows = await db
      .select({ shift: schema.shifts, clientName: schema.clientProfiles.fullName })
      .from(schema.shifts)
      .leftJoin(schema.clientProfiles, eq(schema.shifts.clientId, schema.clientProfiles.id))
      .where(and(eq(schema.shifts.workerId, indProfile.id), eq(schema.shifts.status, 'offered')))
      .orderBy(desc(schema.shifts.createdAt))
      .limit(1);

    const bookedShifts = await db.select().from(schema.shifts).where(
      and(eq(schema.shifts.workerId, indProfile.id), inArray(schema.shifts.status, ['accepted', 'in_progress', 'completed']))
    );
    const booked = bookedShifts.reduce((sum, sh) => sum + hoursBetween(sh.startTime, sh.endTime), 0);

    let request = null;
    if (rows[0]) {
      const sh = rows[0].shift;
      request = {
        id: sh.id,
        client: rows[0].clientName || 'Client',
        service: sh.serviceType || 'Support',
        when: formatWhen(sh.startTime, sh.endTime),
        matchedOn: (sh.matchedOn || []).join(', '),
        matchPct: sh.matchScore || 0,
        status: sh.status,
      };
    }

    marketplace = {
      profileId: indProfile.id,
      capacity: { booked: Math.round(booked), total: indProfile.capacityTotal },
      request,
    };
  }

  // --- roster ---
  let roster: any = null;
  if (coordProfile) {
    const rows = await db
      .select({ shift: schema.shifts, clientName: schema.clientProfiles.fullName })
      .from(schema.shifts)
      .leftJoin(schema.clientProfiles, eq(schema.shifts.clientId, schema.clientProfiles.id))
      .where(and(
        eq(schema.shifts.workerId, coordProfile.id),
        inArray(schema.shifts.status, ['offered', 'accepted', 'in_progress'])
      ))
      .orderBy(desc(schema.shifts.startTime));

    const shifts = rows.map((r) => ({
      id: r.shift.id,
      client: r.clientName || 'Client',
      service: r.shift.serviceType || 'Support',
      when: formatWhen(r.shift.startTime, r.shift.endTime),
      status: r.shift.status === 'offered' ? 'pending' : r.shift.status,
      location: r.shift.locationAddress || '',
    }));

    const booked = rows
      .filter((r) => r.shift.status === 'accepted' || r.shift.status === 'in_progress')
      .reduce((sum, r) => sum + hoursBetween(r.shift.startTime, r.shift.endTime), 0);

    let coordinatorName = 'Coordinator';
    let coordinatorEmail = '';
    if (coordProfile.tenantId) {
      const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, coordProfile.tenantId)).limit(1);
      if (tenant) coordinatorName = tenant.name;
      const [coord] = await db.select().from(schema.users).where(and(eq(schema.users.tenantId, coordProfile.tenantId), eq(schema.users.role, 'coordinator'))).limit(1);
      if (coord) coordinatorEmail = coord.email;
    }

    roster = {
      profileId: coordProfile.id,
      coordinatorName,
      coordinatorEmail,
      capacity: { booked: Math.round(booked), total: coordProfile.capacityTotal },
      shifts,
    };
  }

  return c.json({
    workerId: user.id,
    name: user.fullName || 'Worker',
    role: coordProfile?.skills?.[0] ? `Support Worker · ${coordProfile.skills[0]}` : 'Support Worker',
    contexts,
    marketplace,
    roster,
  });
});

// --- Check-ins (DB-backed, worker only) ---
app.get('/api/checkins', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.wellnessLogs)
    .where(and(eq(schema.wellnessLogs.userId, userId), eq(schema.wellnessLogs.audience, 'worker')))
    .orderBy(desc(schema.wellnessLogs.createdAt))
    .limit(4);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const entries = rows
    .map((r) => {
      const d = new Date(r.createdAt);
      const isToday =
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();
      return { day: isToday ? 'Today' : dayNames[d.getDay()], score: r.score ?? 0 };
    })
    .reverse();

  return c.json(entries);
});

app.post('/api/checkins', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const body = await c.req.json();

  // Resolve tenantId from the user's coordinator profile (null for pure independents)
  const profiles = await db.select().from(schema.workerProfiles).where(eq(schema.workerProfiles.userId, userId));
  const coordProfile = profiles.find((p) => p.workerType === 'coordinator');
  const tenantId = coordProfile?.tenantId ?? null;

  await db.insert(schema.wellnessLogs).values({
    tenantId,
    userId,
    audience: 'worker',
    logType: String(body.type || 'load'),
    score: Number(body.score) || 0,
    notes: body.notes || null,
  });

  return c.json({ ok: true, entry: { day: 'Today', score: Number(body.score) || 0 } }, 201);
});

app.post('/api/worker-hub/decision', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const body = await c.req.json();
  const requestId = String(body.requestId || '');
  if (!requestId) return c.json({ error: 'Missing requestId' }, 400);

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);

  const profiles = await db.select().from(schema.workerProfiles).where(eq(schema.workerProfiles.userId, user.id));
  const indProfile = profiles.find((p) => p.workerType === 'independent');
  if (!indProfile) return c.json({ error: 'No marketplace profile' }, 403);

  const [shift] = await db.select().from(schema.shifts).where(eq(schema.shifts.id, requestId)).limit(1);
  if (!shift) return c.json({ error: 'Shift not found' }, 404);
  if (shift.workerId !== indProfile.id) return c.json({ error: 'Not your shift' }, 403);
  if (shift.status !== 'offered') return c.json({ error: 'Shift not open' }, 409);

  const newStatus = body.decision === 'accept' ? 'accepted' : 'declined';
  const declinedReason = body.decision === 'decline' ? (body.reason || 'Declined by worker') : null;

  await db.update(schema.shifts)
    .set({ status: newStatus, declinedReason })
    .where(eq(schema.shifts.id, requestId));

  return c.json({ ok: true, status: newStatus });
});

// --- Worker Roster (HelpHome-assigned shifts; hidden from independent-only workers) ---
app.get('/api/worker-roster', (c) => c.json({
  coordinatorName: 'HelpHome',
  coordinatorEmail: 'tonia@helphome.au',
  shifts: [
    { id: 'h1', client: 'Mark T.', service: 'Personal Care', when: 'Fri 10:00–14:00', status: 'confirmed', location: 'Bondi' },
    { id: 'h2', client: 'Priya K.', service: 'Community Access', when: 'Sat 9:00–13:00', status: 'confirmed', location: 'Parramatta' },
    { id: 'h3', client: 'Dana W.', service: 'Transport', when: 'Mon 8:00–12:00', status: 'pending', location: 'Chatswood' },
  ],
}));

// --- Coordinator Hub Roster (DB-backed, tenant-scoped) ---
app.get('/api/roster', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'coordinator' && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
  if (!user.tenantId) return c.json({ error: 'No tenant' }, 403);

  const rows = await db
    .select({ profile: schema.workerProfiles, fullName: schema.users.fullName })
    .from(schema.workerProfiles)
    .leftJoin(schema.users, eq(schema.workerProfiles.userId, schema.users.id))
    .where(and(
      eq(schema.workerProfiles.tenantId, user.tenantId),
      eq(schema.workerProfiles.workerType, 'coordinator')
    ));

  const now = Date.now();
  const hour = 3_600_000;

  const roster = await Promise.all(rows.map(async (r) => {
    const wl = await db
      .select()
      .from(schema.wellnessLogs)
      .where(and(
        eq(schema.wellnessLogs.userId, r.profile.userId),
        eq(schema.wellnessLogs.audience, 'worker')
      ))
      .orderBy(desc(schema.wellnessLogs.createdAt))
      .limit(4);

    const checkins = wl.map((w) => w.score ?? 0).reverse();
    const lastCheckin = wl.length > 0 ? timeAgo(wl[0].createdAt, now) : 'No check-ins';

    const shifts = await db
      .select()
      .from(schema.shifts)
      .where(and(
        eq(schema.shifts.workerId, r.profile.id),
        inArray(schema.shifts.status, ['accepted', 'in_progress', 'completed'])
      ));
    const booked = shifts.reduce(
      (sum, sh) => sum + (new Date(sh.endTime).getTime() - new Date(sh.startTime).getTime()) / hour,
      0
    );

    const skills = r.profile.skills || [];
    const role = skills.length > 0 ? `Support Worker · ${skills[0]}` : 'Support Worker';

    return {
      id: r.profile.id,
      name: r.fullName || 'Worker',
      role,
      capacity: { booked: Math.round(booked), total: r.profile.capacityTotal },
      availability: '—',
      checkins,
      lastCheckin,
    };
  }));

  return c.json(roster);
});

app.post('/api/roster/:id/welfare-chat', (c) => {
  welfareChats[c.req.param('id')] = true;
  return c.json({ ok: true });
});

// --- Admin Dashboard ---
app.get('/api/admin/kpis', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'admin' && user.role !== 'coordinator') return c.json({ error: 'Forbidden' }, 403);

  const scope = user.role === 'coordinator' && user.tenantId ? user.tenantId : null;

  const allClients = await db.select().from(schema.clientProfiles);
  const allWorkers = await db.select().from(schema.workerProfiles);
  const allUsers = await db.select().from(schema.users);
  const allShifts = scope
    ? await db.select().from(schema.shifts).where(eq(schema.shifts.tenantId, scope))
    : await db.select().from(schema.shifts);

  const clients = scope ? allClients.filter((c) => c.tenantId === scope).length : allClients.length;
  const workers = scope ? allWorkers.filter((w) => w.tenantId === scope).length : allWorkers.length;
  const coordinators = allUsers.filter((u) => u.role === 'coordinator' && (scope ? u.tenantId === scope : true)).length;

  const weekAgo = Date.now() - 7 * 86_400_000;
  const shiftsThisWeek = allShifts.filter((s) => new Date(s.startTime).getTime() >= weekAgo);
  const totalBookings = shiftsThisWeek.length;
  const accepted = shiftsThisWeek.filter((s) => s.status === 'accepted' || s.status === 'in_progress' || s.status === 'completed').length;
  const acceptancePct = totalBookings ? Math.round((accepted / totalBookings) * 100) : 0;

  const matchScores = shiftsThisWeek.map((s) => s.matchScore).filter((n): n is number => typeof n === 'number');
  const avgMatch = matchScores.length ? Math.round(matchScores.reduce((a, b) => a + b, 0) / matchScores.length) : 0;

  return c.json([
    { label: 'Active clients', value: String(clients), trend: 'from DB', up: true },
    { label: 'Active workers', value: String(workers), trend: 'from DB', up: true },
    { label: 'Coordinators', value: String(coordinators), trend: 'from DB', up: true },
    { label: 'Bookings this week', value: String(totalBookings), trend: 'from DB', up: true },
    { label: 'Acceptance rate', value: `${acceptancePct}%`, trend: `${accepted} of ${totalBookings} accepted`, up: acceptancePct >= 60 },
    { label: 'Avg wellness match', value: `${avgMatch}%`, trend: 'from DB', up: avgMatch >= 60 },
  ]);
});

app.get('/api/admin/alerts', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'admin' && user.role !== 'coordinator') return c.json({ error: 'Forbidden' }, 403);

  const scope = user.role === 'coordinator' && user.tenantId ? user.tenantId : null;
  const workerQuery = db.select().from(schema.workerProfiles);
  const workers = scope ? await workerQuery.where(eq(schema.workerProfiles.tenantId, scope)) : await workerQuery;
  const userQuery = db.select().from(schema.users);
  const allUsers = scope ? await userQuery.where(eq(schema.users.tenantId, scope)) : await userQuery;
  const usersById = new Map(allUsers.map((u) => [u.id, u]));
  const shifts = scope ? await db.select().from(schema.shifts).where(eq(schema.shifts.tenantId, scope)) : await db.select().from(schema.shifts);
  const logs = await db.select().from(schema.wellnessLogs);

  const derived: any[] = [];

  // 1. At-risk workers (avg last 4 worker checkins < 5.5)
  for (const w of workers) {
    const wl = logs.filter((l) => l.userId === w.userId && l.audience === 'worker').slice(-4);
    if (wl.length === 0) continue;
    const avg = wl.reduce((sum, l) => sum + (l.score ?? 0), 0) / wl.length;
    if (avg < 5.5) {
      const name = usersById.get(w.userId)?.fullName || 'Worker';
      derived.push({
        id: derived.length + 1,
        icon: '🔴',
        level: 'danger',
        text: `${name} — wellbeing At Risk (avg ${avg.toFixed(1)}/10).`,
        action: 'View in Coordinator Hub',
        link: '/coordinator',
        dismissed: false,
      });
    }
  }

  // 2. Pending verifications
  const pending = workers.filter((w) => w.verificationStatus === 'pending');
  for (const w of pending) {
    const name = usersById.get(w.userId)?.fullName || 'Worker';
    derived.push({
      id: derived.length + 1,
      icon: '🟡',
      level: 'warn',
      text: `Verification pending — ${name}. Documents awaiting review.`,
      action: 'Open Verification Queue',
      link: '/verification',
      dismissed: false,
    });
  }

  // 3. Declined shifts (last 7 days)
  const weekAgo = Date.now() - 7 * 86_400_000;
  const declinedCount = shifts.filter((s) => s.status === 'declined' && new Date(s.createdAt).getTime() >= weekAgo).length;
  if (declinedCount > 0) {
    derived.push({
      id: derived.length + 1,
      icon: '🟡',
      level: 'warn',
      text: `${declinedCount} declined request${declinedCount === 1 ? '' : 's'} this week. Auto re-match offered.`,
      action: 'View Client Requests',
      link: '/requests',
      dismissed: false,
    });
  }

  // 4. High capacity workers (>= 80%)
  const hour = 3_600_000;
  for (const w of workers) {
    const mine = shifts.filter((s) => s.workerId === w.id && ['accepted', 'in_progress', 'completed'].includes(s.status));
    const booked = mine.reduce((sum, s) => sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / hour, 0);
    const pct = w.capacityTotal ? Math.round((booked / w.capacityTotal) * 100) : 0;
    if (pct >= 80) {
      const name = usersById.get(w.userId)?.fullName || 'Worker';
      derived.push({
        id: derived.length + 1,
        icon: '🔵',
        level: 'info',
        text: `${name} at ${pct}% capacity. Near overload threshold.`,
        action: 'View in Coordinator Hub',
        link: '/coordinator',
        dismissed: false,
      });
    }
  }

  // If nothing derived, return an all-clear sentinel
  if (derived.length === 0) {
    return c.json([{ id: 0, icon: '✅', level: 'info', text: 'All clear — no items need attention.', action: '', link: '', dismissed: false }]);
  }

  return c.json(derived);
});

app.post('/api/admin/alerts/:id/dismiss', (c) => {
  const alert = alerts.find((a) => a.id === Number(c.req.param('id')));
  if (alert) alert.dismissed = true;
  return c.json({ ok: true });
});

app.get('/api/admin/activity', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'admin' && user.role !== 'coordinator') return c.json({ error: 'Forbidden' }, 403);

  const scope = user.role === 'coordinator' && user.tenantId ? user.tenantId : null;

  const shifts = scope
    ? await db.select().from(schema.shifts).where(eq(schema.shifts.tenantId, scope))
    : await db.select().from(schema.shifts);
  const logs = await db.select().from(schema.wellnessLogs).where(eq(schema.wellnessLogs.audience, 'worker'));

  const allUsers = await db.select().from(schema.users);
  const usersById = new Map(allUsers.map((u) => [u.id, u]));

  const clients = await db.select().from(schema.clientProfiles);
  const clientsById = new Map(clients.map((c) => [c.id, c]));

  const workers = await db.select().from(schema.workerProfiles);
  const workersById = new Map(workers.map((w) => [w.id, w]));

  type Event = { time: string; event: string; icon: string; at: number };
  const events: Event[] = [];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const timeLabel = (d: Date) => {
    const now = new Date();
    const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    if (isToday) return `Today ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return dayNames[d.getDay()];
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  // Shift events
  for (const s of shifts) {
    const at = new Date(s.createdAt);
    const clientName = clientsById.get(s.clientId)?.fullName || 'Client';
    const workerName = s.workerId ? (usersById.get(workersById.get(s.workerId)?.userId || '')?.fullName || 'Worker') : 'Unassigned';
    let icon = '📋';
    let event = '';
    if (s.status === 'accepted' || s.status === 'completed') {
      icon = '✅';
      event = `${workerName} accepted booking — ${clientName} · ${s.serviceType || 'Support'}`;
    } else if (s.status === 'declined') {
      icon = '↩️';
      event = `${workerName} declined booking — ${clientName} (no penalty applied)`;
    } else if (s.status === 'offered') {
      icon = '📨';
      event = `Shift offered to ${workerName} — ${clientName} · ${s.serviceType || 'Support'}`;
    } else if (s.status === 'requested') {
      icon = '🆕';
      event = `New request — ${clientName} · ${s.serviceType || 'Support'}`;
    } else {
      continue;
    }
    events.push({ time: timeLabel(at), event, icon, at: at.getTime() });
  }

  // Wellness log events
  for (const l of logs) {
    const at = new Date(l.createdAt);
    const workerName = usersById.get(l.userId)?.fullName || 'Worker';
    events.push({
      time: timeLabel(at),
      event: `${workerName} submitted wellbeing check-in — ${l.logType}: ${l.score ?? '—'}/10`,
      icon: '💚',
      at: at.getTime(),
    });
  }

  events.sort((a, b) => b.at - a.at);
  return c.json(events.slice(0, 10).map(({ time, event, icon }) => ({ time, event, icon })));
});

app.get('/api/admin/people', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'admin' && user.role !== 'coordinator') return c.json({ error: 'Forbidden' }, 403);

  const scope = user.role === 'coordinator' && user.tenantId ? user.tenantId : null;

  const clientQuery = db.select().from(schema.clientProfiles);
  const allClients = scope
    ? await clientQuery.where(eq(schema.clientProfiles.tenantId, scope))
    : await clientQuery;

  const workerQuery = db.select().from(schema.workerProfiles);
  const allWorkers = scope
    ? await workerQuery.where(eq(schema.workerProfiles.tenantId, scope))
    : await workerQuery;

  const usersQuery = db.select().from(schema.users);
  const allUsers = scope
    ? await usersQuery.where(eq(schema.users.tenantId, scope))
    : await usersQuery;

  const coordinators = allUsers.filter((u) => u.role === 'coordinator').length;

  // At-risk count (matches alerts logic)
  const logs = await db.select().from(schema.wellnessLogs);
  const usersById = new Map(allUsers.map((u) => [u.id, u]));
  let atRisk = 0;
  for (const w of allWorkers) {
    const wl = logs.filter((l) => l.userId === w.userId && l.audience === 'worker').slice(-4);
    if (wl.length === 0) continue;
    const avg = wl.reduce((sum, l) => sum + (l.score ?? 0), 0) / wl.length;
    if (avg < 5.5) atRisk++;
  }

  return c.json([
    {
      label: 'Clients',
      count: allClients.length,
      detail: scope ? 'Scoped to your organisation' : 'Across all organisations',
      link: '/requests',
      linkLabel: 'Client Requests →',
    },
    {
      label: 'Workers',
      count: allWorkers.length,
      detail: `${atRisk} flagged (At Risk)`,
      link: '/coordinator',
      linkLabel: 'Coordinator Hub →',
    },
    {
      label: 'Coordinators',
      count: coordinators,
      detail: scope ? 'Your organisation' : 'All organisations',
      link: '',
      linkLabel: 'Roster view post-pilot',
    },
  ]);
});

app.get('/api/admin/health', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'admin' && user.role !== 'coordinator') return c.json({ error: 'Forbidden' }, 403);

  const scope = user.role === 'coordinator' && user.tenantId ? user.tenantId : null;

  const workerQuery = db.select().from(schema.workerProfiles);
  const workers = scope
    ? await workerQuery.where(eq(schema.workerProfiles.tenantId, scope))
    : await workerQuery;

  const shifts = scope
    ? await db.select().from(schema.shifts).where(eq(schema.shifts.tenantId, scope))
    : await db.select().from(schema.shifts);

  const active = shifts.filter((s) => ['accepted', 'in_progress', 'completed'].includes(s.status));
  const acceptancePct = shifts.length ? Math.round((active.length / shifts.length) * 100) : 0;

  // Avg capacity: for each worker, booked hours / capacityTotal
  const hour = 3_600_000;
  let totalPct = 0;
  for (const w of workers) {
    const mine = shifts.filter((s) => s.workerId === w.id && ['accepted', 'in_progress', 'completed'].includes(s.status));
    const booked = mine.reduce((sum, s) => sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / hour, 0);
    totalPct += w.capacityTotal ? (booked / w.capacityTotal) * 100 : 0;
  }
  const avgCapacity = workers.length ? Math.round(totalPct / workers.length) : 0;

  // Wellness engagement: % of scoped workers with at least 1 checkin in last 7 days
  const userQuery = db.select().from(schema.users);
  const allUsers = scope ? await userQuery.where(eq(schema.users.tenantId, scope)) : await userQuery;
  const userIds = allUsers.map((u) => u.id);
  const recentLogs = await db.select().from(schema.wellnessLogs).where(eq(schema.wellnessLogs.audience, 'worker'));
  const weekAgo = Date.now() - 7 * 86_400_000;
  const engaged = new Set(
    recentLogs
      .filter((l) => userIds.includes(l.userId) && new Date(l.createdAt).getTime() >= weekAgo)
      .map((l) => l.userId)
  );
  const wellnessEngagement = workers.length ? Math.round((engaged.size / workers.length) * 100) : 0;

  // Client satisfaction: avg client mood log in last 30 days
  const clientLogs = await db.select().from(schema.wellnessLogs).where(eq(schema.wellnessLogs.audience, 'client'));
  const satisfied = clientLogs.map((l) => l.score ?? 0).filter((n) => n > 0);
  const clientSatisfaction = satisfied.length
    ? Math.round((satisfied.reduce((a, b) => a + b, 0) / satisfied.length) * 10)
    : 0;

  return c.json([
    { label: 'Worker capacity', pct: avgCapacity },
    { label: 'Booking acceptance', pct: acceptancePct, warn: acceptancePct < 60 },
    { label: 'Wellness engagement', pct: wellnessEngagement },
    { label: 'Client satisfaction', pct: clientSatisfaction },
  ]);
});

// --- Charts ---
app.get('/api/charts/trend', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);

  const logs = await db.select().from(schema.wellnessLogs).where(eq(schema.wellnessLogs.audience, 'worker'));

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  const buckets: { day: string; scores: number[] }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    buckets.push({ day: dayNames[d.getDay()], scores: [] });
  }

  for (const log of logs) {
    const d = new Date(log.createdAt);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((now.getTime() - d.getTime()) / 86_400_000);
    if (diff >= 0 && diff <= 6) {
      buckets[6 - diff].scores.push(log.score ?? 0);
    }
  }

  return c.json(buckets.map((b) => ({
    day: b.day,
    score: b.scores.length
      ? Math.round((b.scores.reduce((a, s) => a + s, 0) / b.scores.length) * 10) / 10
      : 0,
  })));
});

app.get('/api/charts/status', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'admin' && user.role !== 'coordinator') return c.json({ error: 'Forbidden' }, 403);

  const scope = user.role === 'coordinator' && user.tenantId ? user.tenantId : null;
  const shifts = scope
    ? await db.select().from(schema.shifts).where(eq(schema.shifts.tenantId, scope))
    : await db.select().from(schema.shifts);

  const accepted = shifts.filter((s) => s.status === 'accepted' || s.status === 'in_progress' || s.status === 'completed').length;
  const pending = shifts.filter((s) => s.status === 'requested' || s.status === 'offered').length;
  const declined = shifts.filter((s) => s.status === 'declined').length;

  return c.json([
    { label: 'Accepted', value: accepted, color: '#00D68F' },
    { label: 'Pending', value: pending, color: '#F39C12' },
    { label: 'Declined', value: declined, color: '#DC3545' },
  ]);
});

// Revenue is deliberately not from our DB. Money is owned by Xero (via VisualCare);
// this route currently returns representative pilot figures.
// TODO: replace with live Xero/VisualCare sync post-pilot.
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

// --- Auth (DB-backed) ---
const demoLogins = [
  { email: 'jane.doe@client.com', label: 'CareWork Client' },
  { email: 'mia.chen@worker.com', label: 'Independent Worker' },
  { email: 'sarah.johnson@helphome-worker.com', label: 'Coordinator Worker' },
  { email: 'tonia@helphome.au', label: 'Coordinator Admin' },
  { email: 'admin@carework.au', label: 'CareWork Admin' },
];

app.get('/api/demo-accounts', async (c) => {
  const db = await getDb();
  const rows = await db.select({ email: schema.users.email })
    .from(schema.users)
    .where(inArray(schema.users.email, demoLogins.map((d) => d.email)));
  const found = new Set(rows.map((r) => r.email));
  return c.json(demoLogins.filter((d) => found.has(d.email)));
});

app.post('/api/login', async (c) => {
  const db = await getDb();
  const body = await c.req.json();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, body.email)).limit(1);
  if (!user || user.passwordHash !== body.password) return c.json({ ok: false }, 401);
  await db.update(schema.users).set({ lastLogin: new Date() }).where(eq(schema.users.id, user.id));

  let workerContexts: string[] = [];
  if (user.role === 'worker') {
    const profiles = await db.select({ workerType: schema.workerProfiles.workerType })
      .from(schema.workerProfiles)
      .where(eq(schema.workerProfiles.userId, user.id));
    workerContexts = [...new Set(profiles.map((p) => p.workerType))];
  }

  return c.json({ ok: true, userId: user.id, role: user.role, workerContexts });
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