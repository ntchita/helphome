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

// Revenue is deliberately not from our DB — money is owned by Xero (via VisualCare).
// TODO: replace with live Xero/VisualCare sync post-pilot.
const revenue = [
  { month: 'Apr', amount: 420 }, { month: 'May', amount: 610 }, { month: 'Jun', amount: 580 },
  { month: 'Jul', amount: 760 }, { month: 'Aug', amount: 940 }, { month: 'Sep', amount: 1180 },
];

// (no in-memory stubs remaining — all state is DB-backed)

// =====================================================================
// ROUTES
// =====================================================================
app.get('/', (c) => c.json({ message: 'CareWork API Active', version: '2.0.0' }));

// --- Workers & Matching ---
app.get('/api/workers', async (c) => {
  const db = await getDb();
  const userId = c.req.header('x-user-id');

  let clientInterests: string[] = [];
  if (userId) {
    const [cp] = await db.select().from(schema.clientProfiles).where(eq(schema.clientProfiles.userId, userId)).limit(1);
    if (cp) clientInterests = (cp.interests as string[]) || [];
  }

  const rows = await db
    .select({ profile: schema.workerProfiles, fullName: schema.users.fullName })
    .from(schema.workerProfiles)
    .leftJoin(schema.users, eq(schema.workerProfiles.userId, schema.users.id))
    .where(and(
      eq(schema.workerProfiles.workerType, 'independent'),
      eq(schema.workerProfiles.consentToDisplay, true),
      eq(schema.workerProfiles.verificationStatus, 'verified')
    ));

  const shape = rows.map((r) => ({
    id: r.profile.id,
    name: r.fullName || 'Worker',
    role: (r.profile.skills && r.profile.skills[0]) || 'Support Worker',
    bio: r.profile.bio || '',
    skills: r.profile.skills || [],
    interests: r.profile.interests || [],
    rate: r.profile.hourlyRate,
    capacityPct: 0,
  }));

  const profile = { interests: clientInterests, needs: [] };
  const ranked = rankWorkers(shape as any, profile);

  return c.json(ranked.map((w: any) => ({
    ...w,
    wellnessMatchScore: calculateWellnessMatch(w, profile),
    wellnessMatch: calculateWellnessMatch(w, profile),
    platformFee: 0.0,
    totalCost: w.rate,
  })));
});

app.get('/api/interests', async (c) => {
  const db = await getDb();
  const rows = await db
    .select({ interests: schema.workerProfiles.interests })
    .from(schema.workerProfiles)
    .where(and(
      eq(schema.workerProfiles.workerType, 'independent'),
      eq(schema.workerProfiles.consentToDisplay, true)
    ));

  const set = new Set<string>();
  for (const r of rows) {
    for (const i of (r.interests as string[]) || []) set.add(i.toLowerCase());
  }

  const list = Array.from(set)
    .sort()
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  return c.json(list);
});

app.get('/api/client-profile', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [profile] = await db.select().from(schema.clientProfiles).where(eq(schema.clientProfiles.userId, userId)).limit(1);
  if (!profile) return c.json({ error: 'Client profile not found' }, 404);

  return c.json({
    id: profile.id,
    name: profile.fullName,
    email: '',
    plan: 'starter',
    interests: profile.interests || [],
    needs: profile.supportGoals || [],
  });
});

// --- Bookings ---
app.get('/api/bookings', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [cp] = await db.select().from(schema.clientProfiles).where(eq(schema.clientProfiles.userId, userId)).limit(1);
  if (!cp) return c.json([]);

  const rows = await db
    .select({ shift: schema.shifts, workerName: schema.users.fullName })
    .from(schema.shifts)
    .leftJoin(schema.workerProfiles, eq(schema.shifts.workerId, schema.workerProfiles.id))
    .leftJoin(schema.users, eq(schema.workerProfiles.userId, schema.users.id))
    .where(eq(schema.shifts.clientId, cp.id))
    .orderBy(desc(schema.shifts.startTime));

  const fmt = (d: Date | string) => {
    const s = new Date(d);
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${days[s.getDay()]} ${pad(s.getHours())}:${pad(s.getMinutes())}`;
  };

  return c.json(rows.map((r) => ({
    id: r.shift.id,
    clientName: cp.fullName,
    workerId: r.shift.workerId,
    workerName: r.workerName || 'Worker',
    service: r.shift.serviceType || 'Support',
    date: fmt(r.shift.startTime),
    status: r.shift.status,
  })));
});

app.post('/api/bookings', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const body = await c.req.json();
  const workerProfileId = String(body.workerId || '');
  if (!workerProfileId) return c.json({ error: 'Missing workerId' }, 400);

  const [clientUser] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!clientUser || clientUser.role !== 'client') return c.json({ error: 'Only clients can book' }, 403);

  const [cp] = await db.select().from(schema.clientProfiles).where(eq(schema.clientProfiles.userId, userId)).limit(1);
  if (!cp) return c.json({ error: 'Client profile missing' }, 404);

  const [wp] = await db.select().from(schema.workerProfiles).where(eq(schema.workerProfiles.id, workerProfileId)).limit(1);
  if (!wp || wp.workerType !== 'independent' || !wp.consentToDisplay || wp.verificationStatus !== 'verified') {
    return c.json({ error: 'Worker not available' }, 404);
  }

  const clientInterests = (cp.interests as string[]) || [];
  const workerInterests = (wp.interests as string[]) || [];
  const overlap = clientInterests.filter((i) => workerInterests.includes(i));
  const matchScore = clientInterests.length
    ? Math.round((overlap.length / clientInterests.length) * 100)
    : 0;

  const startTime = new Date(Date.now() + 86_400_000);
  startTime.setHours(10, 0, 0, 0);
  const endTime = new Date(startTime.getTime() + 2 * 3_600_000);

  const [shift] = await db.insert(schema.shifts).values({
    tenantId: null,
    clientId: cp.id,
    workerId: wp.id,
    startTime,
    endTime,
    serviceType: body.serviceType || 'Standard Support',
    status: 'offered',
    matchScore,
    matchedOn: overlap,
  }).returning();

  return c.json({ ok: true, matchScore, shiftId: shift.id }, 201);
});

// --- Client Requests (DB-backed, tenant-scoped) ---
app.get('/api/requests', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'coordinator' && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

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

// --- Coordinator Hub Roster (DB-backed, tenant-scoped) ---
app.get('/api/roster', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'coordinator' && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const tenantFilter = user.role === 'coordinator' && user.tenantId ? user.tenantId : null;

  const baseQuery = db
    .select({ profile: schema.workerProfiles, fullName: schema.users.fullName })
    .from(schema.workerProfiles)
    .leftJoin(schema.users, eq(schema.workerProfiles.userId, schema.users.id));

  const rows = tenantFilter
    ? await baseQuery.where(and(
        eq(schema.workerProfiles.tenantId, tenantFilter),
        eq(schema.workerProfiles.workerType, 'coordinator')
      ))
    : await baseQuery.where(eq(schema.workerProfiles.workerType, 'coordinator'));

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

// Coordinator schedules a welfare chat with a worker
app.post('/api/roster/:id/welfare-chat', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'coordinator' && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const workerProfileId = c.req.param('id');
  const [wp] = await db.select().from(schema.workerProfiles).where(eq(schema.workerProfiles.id, workerProfileId)).limit(1);
  if (!wp) return c.json({ error: 'Worker not found' }, 404);
  if (!wp.tenantId) return c.json({ error: 'Worker has no coordinator' }, 400);

  const [coordinator] = await db.select().from(schema.users).where(and(
    eq(schema.users.tenantId, wp.tenantId),
    eq(schema.users.role, 'coordinator')
  )).limit(1);
  if (!coordinator) return c.json({ error: 'No coordinator for this worker' }, 404);

  await db.insert(schema.welfareChats).values({
    tenantId: wp.tenantId,
    workerId: wp.id,
    coordinatorId: coordinator.id,
    scheduledAt: new Date(),
    outcomeNotes: null,
  });

  return c.json({ ok: true });
});

// Worker flags need for support — creates a welfare chat request for their coordinator
app.post('/api/worker-hub/flag-support', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user || user.role !== 'worker') return c.json({ error: 'Forbidden' }, 403);

  const profiles = await db.select().from(schema.workerProfiles).where(eq(schema.workerProfiles.userId, user.id));
  const coordProfile = profiles.find((p) => p.workerType === 'coordinator' && p.tenantId);
  if (!coordProfile || !coordProfile.tenantId) {
    return c.json({ error: 'No coordinator assigned' }, 400);
  }

  const [coordinator] = await db.select().from(schema.users).where(and(
    eq(schema.users.tenantId, coordProfile.tenantId),
    eq(schema.users.role, 'coordinator')
  )).limit(1);
  if (!coordinator) return c.json({ error: 'No coordinator available' }, 404);

  await db.insert(schema.welfareChats).values({
    tenantId: coordProfile.tenantId,
    workerId: coordProfile.id,
    coordinatorId: coordinator.id,
    scheduledAt: new Date(),
    outcomeNotes: 'Worker flagged need for support',
  });

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

  for (const w of workers) {
    const wl = logs.filter((l) => l.userId === w.userId && l.audience === 'worker').slice(-4);
    if (wl.length === 0) continue;
    const avg = wl.reduce((sum, l) => sum + (l.score ?? 0), 0) / wl.length;
    if (avg < 5.5) {
      const name = usersById.get(w.userId)?.fullName || 'Worker';
      derived.push({
        id: derived.length + 1, icon: '🔴', level: 'danger',
        text: `${name} — wellbeing At Risk (avg ${avg.toFixed(1)}/10).`,
        action: 'View in Coordinator Hub', link: '/coordinator', dismissed: false,
      });
    }
  }

  const pending = workers.filter((w) => w.verificationStatus === 'pending');
  for (const w of pending) {
    const name = usersById.get(w.userId)?.fullName || 'Worker';
    derived.push({
      id: derived.length + 1, icon: '🟡', level: 'warn',
      text: `Verification pending — ${name}. Documents awaiting review.`,
      action: 'Open Verification Queue', link: '/verification', dismissed: false,
    });
  }

  const weekAgo = Date.now() - 7 * 86_400_000;
  const declinedCount = shifts.filter((s) => s.status === 'declined' && new Date(s.createdAt).getTime() >= weekAgo).length;
  if (declinedCount > 0) {
    derived.push({
      id: derived.length + 1, icon: '🟡', level: 'warn',
      text: `${declinedCount} declined request${declinedCount === 1 ? '' : 's'} this week. Auto re-match offered.`,
      action: 'View Client Requests', link: '/requests', dismissed: false,
    });
  }

  const hour = 3_600_000;
  for (const w of workers) {
    const mine = shifts.filter((s) => s.workerId === w.id && ['accepted', 'in_progress', 'completed'].includes(s.status));
    const booked = mine.reduce((sum, s) => sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / hour, 0);
    const pct = w.capacityTotal ? Math.round((booked / w.capacityTotal) * 100) : 0;
    if (pct >= 80) {
      const name = usersById.get(w.userId)?.fullName || 'Worker';
      derived.push({
        id: derived.length + 1, icon: '🔵', level: 'info',
        text: `${name} at ${pct}% capacity. Near overload threshold.`,
        action: 'View in Coordinator Hub', link: '/coordinator', dismissed: false,
      });
    }
  }

  if (derived.length === 0) {
    return c.json([{ id: 0, icon: '✅', level: 'info', text: 'All clear — no items need attention.', action: '', link: '', dismissed: false }]);
  }

  return c.json(derived);
});

// Alerts are derived live from DB on every GET, so dismissal is a client-side no-op.
app.post('/api/admin/alerts/:id/dismiss', (c) => c.json({ ok: true }));

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

  const logs = await db.select().from(schema.wellnessLogs);
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

  const hour = 3_600_000;
  let totalPct = 0;
  for (const w of workers) {
    const mine = shifts.filter((s) => s.workerId === w.id && ['accepted', 'in_progress', 'completed'].includes(s.status));
    const booked = mine.reduce((sum, s) => sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / hour, 0);
    totalPct += w.capacityTotal ? (booked / w.capacityTotal) * 100 : 0;
  }
  const avgCapacity = workers.length ? Math.round(totalPct / workers.length) : 0;

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

// Revenue is deliberately not from our DB — money is owned by Xero (via VisualCare).
app.get('/api/charts/revenue', (c) => c.json(revenue));

// --- Verification Queue (DB-backed) ---
app.get('/api/verification', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'admin' && user.role !== 'coordinator') return c.json({ error: 'Forbidden' }, 403);

  const scope = user.role === 'coordinator' && user.tenantId ? user.tenantId : null;

  const rows = await db
    .select({ profile: schema.workerProfiles, fullName: schema.users.fullName })
    .from(schema.workerProfiles)
    .leftJoin(schema.users, eq(schema.workerProfiles.userId, schema.users.id))
    .orderBy(schema.users.fullName);

  const filtered = scope ? rows.filter((r) => r.profile.tenantId === scope) : rows;

  const tenants = await db.select().from(schema.tenants);
  const tenantById = new Map(tenants.map((t) => [t.id, t.name]));

  const profileCountByUser = new Map<string, number>();
  for (const r of rows) {
    profileCountByUser.set(r.profile.userId, (profileCountByUser.get(r.profile.userId) ?? 0) + 1);
  }

  return c.json(filtered.map((r) => {
    const context = r.profile.workerType === 'coordinator'
      ? `Coordinator · ${tenantById.get(r.profile.tenantId || '') || 'HelpHome'}`
      : 'Independent · CareWork';
    const isDual = (profileCountByUser.get(r.profile.userId) ?? 0) > 1;
    return {
      id: r.profile.id,
      name: r.fullName || 'Worker',
      context: isDual ? `${context} · Dual` : context,
      checks: r.profile.verificationStatus === 'verified'
        ? 'All documents verified'
        : 'Documents pending review',
      status: r.profile.verificationStatus,
    };
  }));
});

app.post('/api/verification/:id/toggle', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'admin' && user.role !== 'coordinator') return c.json({ error: 'Forbidden' }, 403);

  const profileId = c.req.param('id');
  const [profile] = await db.select().from(schema.workerProfiles).where(eq(schema.workerProfiles.id, profileId)).limit(1);
  if (!profile) return c.json({ error: 'Worker not found' }, 404);

  if (user.role === 'coordinator' && profile.tenantId !== user.tenantId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const newStatus = profile.verificationStatus === 'verified' ? 'pending' : 'verified';
  await db.update(schema.workerProfiles).set({ verificationStatus: newStatus }).where(eq(schema.workerProfiles.id, profileId));

  const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, profile.userId)).limit(1);

  return c.json({
    id: profile.id,
    name: owner?.fullName || 'Worker',
    checks: newStatus === 'verified' ? 'All documents verified' : 'Documents pending review',
    status: newStatus,
  });
});

app.get('/api/verification/activity', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'admin' && user.role !== 'coordinator') return c.json({ error: 'Forbidden' }, 403);

  const scope = user.role === 'coordinator' && user.tenantId ? user.tenantId : null;

  const workerQuery = db.select({ profile: schema.workerProfiles, fullName: schema.users.fullName })
    .from(schema.workerProfiles)
    .leftJoin(schema.users, eq(schema.workerProfiles.userId, schema.users.id));
  const rows = scope
    ? await workerQuery.where(eq(schema.workerProfiles.tenantId, scope))
    : await workerQuery;

  const verified = rows.filter((r) => r.profile.verificationStatus === 'verified').slice(0, 3);
  const pending = rows.filter((r) => r.profile.verificationStatus === 'pending').slice(0, 3);

  const events: string[] = [];
  for (const v of verified) events.push(`${v.fullName || 'Worker'} — verification complete`);
  for (const p of pending) events.push(`${p.fullName || 'Worker'} — awaiting verification review`);

  return c.json(events.slice(0, 6));
});

app.get('/api/verification/stats', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role !== 'admin' && user.role !== 'coordinator') return c.json({ error: 'Forbidden' }, 403);

  const scope = user.role === 'coordinator' && user.tenantId ? user.tenantId : null;

  const workerQuery = db.select().from(schema.workerProfiles);
  const allWorkers = scope ? await workerQuery.where(eq(schema.workerProfiles.tenantId, scope)) : await workerQuery;
  const shifts = scope ? await db.select().from(schema.shifts).where(eq(schema.shifts.tenantId, scope)) : await db.select().from(schema.shifts);
  const logs = await db.select().from(schema.wellnessLogs).where(eq(schema.wellnessLogs.audience, 'worker'));

  return c.json([
    { value: String(allWorkers.length), label: 'active support workers' },
    { value: String(shifts.length), label: 'bookings this week' },
    { value: String(logs.length), label: 'wellness check-ins this week' },
  ]);
});

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

app.post('/api/auth/register', async (c) => {
  const db = await getDb();
  const body = await c.req.json();

  const door = ['client', 'worker', 'coordinator'].includes(String(body.door))
    ? String(body.door) as 'client' | 'worker' | 'coordinator'
    : 'client';

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  if (!name || !email) return c.json({ error: 'Missing name or email' }, 400);

  await db.insert(schema.signupLeads).values({
    door,
    name,
    email,
    orgName: body.orgName ? String(body.orgName) : null,
    interests: Array.isArray(body.interests) ? body.interests : null,
  });

  return c.json({ success: true, message: 'Registered (pilot waitlist)' }, 201);
});

app.post('/api/wellness', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'Unauthenticated' }, 401);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);

  const body = await c.req.json();
  const logType = String(body.logType || 'mood');
  const score = Math.max(1, Math.min(10, Number(body.score) || 5));
  const notes = body.notes ? String(body.notes) : null;

  await db.insert(schema.wellnessLogs).values({
    tenantId: null,
    userId,
    audience: 'client',
    logType,
    score,
    notes,
  });

  return c.json({ success: true, message: 'Wellness check recorded' }, 201);
});

export default app;