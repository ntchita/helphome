import type { PgliteDatabase } from 'drizzle-orm/pglite';
import * as s from './schema.ts';

export async function seed(db: PgliteDatabase<typeof s>) {
  const [existing] = await db.select().from(s.tenants).limit(1);
  if (existing) return;

  await db.insert(s.users).values({
    email: 'admin@carework.au', passwordHash: 'test', role: 'admin', fullName: 'Nikolai Tchitachvili', mfaEnabled: true
  });

  const [helphome] = await db.insert(s.tenants).values({
    name: 'HelpHome', slug: 'helphome', registeredProvider: false
  }).returning();

  await db.insert(s.users).values({
    tenantId: helphome.id, email: 'tonia@helphome.au', passwordHash: 'test', role: 'coordinator', fullName: 'Tonia Fridlis', mfaEnabled: true
  });

  // --- CLIENTS (10) ---
  const clientData = [
    'Jane Doe', 'Mark Taylor', 'Sarah Lee', 'David Wong', 'Emma Perry',
    'Chris Brown', 'Lisa Martin', 'Priya Kumar', 'Dana White', 'Alex Rivera'
  ];
  const clientMap: Record<string, { userId: string; profileId: string }> = {};
  for (const name of clientData) {
    const email = `${name.toLowerCase().replace(' ', '.')}@client.com`;
    const [user] = await db.insert(s.users).values({ email, passwordHash: 'test', role: 'client', fullName: name }).returning();
    const [profile] = await db.insert(s.clientProfiles).values({
      userId: user.id, tenantId: null, fullName: name, dob: '1990-01-01',
      address: 'Sydney NSW', phone: '0400000000', fundingStream: 'ndis', planManagerType: 'plan_managed'
    }).returning();
    clientMap[name] = { userId: user.id, profileId: profile.id };
  }

  // --- INDEPENDENT WORKERS (10) ---
  const indData = [
    'Mia Chen', 'Liam Park', 'Noah Smith', 'Olivia Jones', 'Ethan Davis',
    'Ava Miller', 'Mason Wilson', 'Isabella Moore', 'Lucas Taylor', 'Sophia Anderson'
  ];
  const indMap: Record<string, { userId: string; profileId: string }> = {};
  for (const name of indData) {
    const email = `${name.toLowerCase().replace(' ', '.')}@worker.com`;
    const [user] = await db.insert(s.users).values({ email, passwordHash: 'test', role: 'worker', fullName: name }).returning();
    const [profile] = await db.insert(s.workerProfiles).values({
      userId: user.id, tenantId: null, workerType: 'independent', abn: '11111111111',
      bio: 'Independent support worker.', skills: ['Personal Care'], interests: ['music'],
      hourlyRate: 40, consentToDisplay: true, verificationStatus: 'verified'
    }).returning();
    indMap[name] = { userId: user.id, profileId: profile.id };
  }

  // --- HELPHOME EMPLOYEES (14) ---
  const empData = [
    'Tom Harris', 'Emma Watson', 'Jack Sparrow', 'Lily Allen', 'Ben Affleck',
    'Mila Kunis', 'Ryan Gosling', 'Emma Stone', 'Chris Evans', 'Scarlett Johansson',
    'Mark Ruffalo', 'Jeremy Renner', 'Paul Rudd', 'Brie Larson'
  ];
  const empMap: Record<string, { userId: string; profileId: string }> = {};
  for (const name of empData) {
    const email = `${name.toLowerCase().replace(' ', '.')}@helphome.au`;
    const [user] = await db.insert(s.users).values({ tenantId: helphome.id, email, passwordHash: 'test', role: 'worker', fullName: name }).returning();
    const [profile] = await db.insert(s.workerProfiles).values({
      userId: user.id, tenantId: helphome.id, workerType: 'coordinator', abn: '22222222222',
      bio: 'HelpHome roster worker.', skills: ['Community Access'], interests: ['fitness'],
      hourlyRate: 45, consentToDisplay: false, verificationStatus: 'verified'
    }).returning();
    empMap[name] = { userId: user.id, profileId: profile.id };
  }

  // --- HELPHOME CONTRACTORS (6) ---
  const contData = [
    { name: 'Sarah Johnson', email: 'sarah.johnson@helphome-worker.com', dual: true },
    { name: 'James Lee', email: 'james.lee@helphome-worker.com', dual: true },
    { name: 'Mary Garcia', email: 'mary.garcia@worker.com', dual: false },
    { name: 'Robert Martinez', email: 'robert.martinez@worker.com', dual: false },
    { name: 'Linda Robinson', email: 'linda.robinson@worker.com', dual: false },
    { name: 'Michael Clark', email: 'michael.clark@worker.com', dual: false }
  ];
  const contMap: Record<string, { userId: string; coord: string; ind?: string }> = {};
  for (const c of contData) {
    const [user] = await db.insert(s.users).values({ tenantId: helphome.id, email: c.email, passwordHash: 'test', role: 'worker', fullName: c.name }).returning();

    const [coordProfile] = await db.insert(s.workerProfiles).values({
      userId: user.id, tenantId: helphome.id, workerType: 'coordinator', abn: '33333333333',
      bio: 'HelpHome contractor.', skills: ['Transport'], interests: ['outdoors'],
      hourlyRate: 42, consentToDisplay: false, verificationStatus: 'verified'
    }).returning();

    const entry: { userId: string; coord: string; ind?: string } = { userId: user.id, coord: coordProfile.id };

    if (c.dual) {
      const [indProfile] = await db.insert(s.workerProfiles).values({
        userId: user.id, tenantId: null, workerType: 'independent', abn: '33333333333',
        bio: 'Independent contractor on CareWork.', skills: ['Transport', 'Personal Care'], interests: ['outdoors', 'dogs'],
        hourlyRate: 45, consentToDisplay: true, verificationStatus: 'verified'
      }).returning();
      entry.ind = indProfile.id;
    }

    contMap[c.name] = entry;
  }

  // =====================================================================
  // SHIFTS
  // =====================================================================
  const now = Date.now();
  const day = 86_400_000;
  const hour = 3_600_000;
  const daysAgo = (d: number) => new Date(now - d * day);

  // (a) Sarah — marketplace offer
  await db.insert(s.shifts).values({
    tenantId: null,
    clientId: clientMap['Mark Taylor'].profileId,
    workerId: contMap['Sarah Johnson'].ind!,
    startTime: new Date(now + 1 * day),
    endTime: new Date(now + 1 * day + 3 * hour),
    serviceType: 'Community Access',
    status: 'offered',
    matchScore: 86,
    matchedOn: ['music', 'art'],
    locationAddress: 'Bondi',
  });

  // (b) Sarah — HelpHome roster shifts
  const rosterData = [
    { client: 'Jane Doe',    service: 'Personal Care',    daysAhead: 1, status: 'accepted' as const, location: 'Bondi' },
    { client: 'Priya Kumar', service: 'Community Access', daysAhead: 2, status: 'accepted' as const, location: 'Parramatta' },
    { client: 'Dana White',  service: 'Transport',        daysAhead: 3, status: 'offered'  as const, location: 'Chatswood' },
  ];
  for (const r of rosterData) {
    await db.insert(s.shifts).values({
      tenantId: helphome.id,
      clientId: clientMap[r.client].profileId,
      workerId: contMap['Sarah Johnson'].coord,
      startTime: new Date(now + r.daysAhead * day),
      endTime: new Date(now + r.daysAhead * day + 4 * hour),
      serviceType: r.service,
      status: r.status,
      matchScore: 85,
      matchedOn: ['dogs'],
      locationAddress: r.location,
    });
  }

  // (c) Mia — marketplace offer
  await db.insert(s.shifts).values({
    tenantId: null,
    clientId: clientMap['Jane Doe'].profileId,
    workerId: indMap['Mia Chen'].profileId,
    startTime: new Date(now + 2 * day),
    endTime: new Date(now + 2 * day + 3 * hour),
    serviceType: 'Personal Care',
    status: 'offered',
    matchScore: 72,
    matchedOn: ['music'],
    locationAddress: 'Sydney CBD',
  });

  // =====================================================================
  // WELLNESS LOGS — every HelpHome roster worker (20) so CoordinatorHub
  // shows a realistic mix of Thriving / Steady / At Risk
  // =====================================================================
  const rosterWellness = [
    // contractors
    { name: 'Sarah Johnson',   scores: [6, 7, 5, 7] },   // Steady
    { name: 'James Lee',       scores: [8, 8, 7, 8] },   // Thriving
    { name: 'Mary Garcia',     scores: [7, 8, 8, 9] },   // Thriving
    { name: 'Robert Martinez', scores: [6, 6, 7, 6] },   // Steady
    { name: 'Linda Robinson',  scores: [5, 4, 5, 4] },   // At risk
    { name: 'Michael Clark',   scores: [7, 7, 8, 7] },   // Thriving
    // employees
    { name: 'Tom Harris',          scores: [8, 8, 8, 9] },  // Thriving
    { name: 'Emma Watson',         scores: [7, 7, 6, 7] },  // Steady
    { name: 'Jack Sparrow',        scores: [6, 5, 6, 5] },  // Steady
    { name: 'Lily Allen',          scores: [8, 7, 8, 8] },  // Thriving
    { name: 'Ben Affleck',         scores: [7, 8, 7, 7] },  // Steady
    { name: 'Mila Kunis',          scores: [6, 6, 7, 6] },  // Steady
    { name: 'Ryan Gosling',        scores: [4, 5, 4, 5] },  // At risk
    { name: 'Emma Stone',          scores: [7, 8, 7, 8] },  // Thriving
    { name: 'Chris Evans',         scores: [8, 8, 7, 8] },  // Thriving
    { name: 'Scarlett Johansson',  scores: [6, 7, 6, 7] },  // Steady
    { name: 'Mark Ruffalo',        scores: [7, 7, 8, 7] },  // Thriving
    { name: 'Jeremy Renner',       scores: [5, 5, 6, 5] },  // Steady
    { name: 'Paul Rudd',           scores: [8, 7, 8, 7] },  // Thriving
    { name: 'Brie Larson',         scores: [7, 7, 7, 7] },  // Steady
  ];
  const logTypes = ['load', 'supported', 'balance', 'load'];
  for (const rw of rosterWellness) {
    const ref = contMap[rw.name] ?? empMap[rw.name];
    if (!ref) continue;
    for (let i = 0; i < 4; i++) {
      await db.insert(s.wellnessLogs).values({
        tenantId: helphome.id,
        userId: ref.userId,
        audience: 'worker',
        logType: logTypes[i],
        score: rw.scores[i],
        notes: null,
        createdAt: daysAgo(4 - i),
      });
    }
  }

  // Mia — independent (no tenant)
  await db.insert(s.wellnessLogs).values([
    { tenantId: null, userId: indMap['Mia Chen'].userId, audience: 'worker', logType: 'load',      score: 5, createdAt: daysAgo(4) },
    { tenantId: null, userId: indMap['Mia Chen'].userId, audience: 'worker', logType: 'supported', score: 6, createdAt: daysAgo(3) },
    { tenantId: null, userId: indMap['Mia Chen'].userId, audience: 'worker', logType: 'balance',   score: 6, createdAt: daysAgo(2) },
    { tenantId: null, userId: indMap['Mia Chen'].userId, audience: 'worker', logType: 'load',      score: 7, createdAt: daysAgo(1) },
  ]);

  // Jane — client
  await db.insert(s.wellnessLogs).values([
    { tenantId: null, userId: clientMap['Jane Doe'].userId, audience: 'client', logType: 'mood',         score: 8, createdAt: daysAgo(3) },
    { tenantId: null, userId: clientMap['Jane Doe'].userId, audience: 'client', logType: 'goals',        score: 7, createdAt: daysAgo(2) },
    { tenantId: null, userId: clientMap['Jane Doe'].userId, audience: 'client', logType: 'satisfaction', score: 9, createdAt: daysAgo(1) },
  ]);

  console.log('[seed] CareWork + HelpHome + 40 users + 5 shifts + 91 wellness logs inserted');
}