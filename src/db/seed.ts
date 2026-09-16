import { eq } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import * as s from './schema.ts';

export async function seed(db: PgliteDatabase<typeof s>) {
  const [existing] = await db.select().from(s.tenants).limit(1);
  if (existing) return; // idempotent

  const [tenant] = await db.insert(s.tenants).values({
    name: 'HelpHome', slug: 'helphome', registeredProvider: false,
  }).returning();

  const [admin] = await db.insert(s.users).values({
    email: 'admin@helphome.au', passwordHash: 'test', role: 'admin', fullName: 'Nikolai Tchitachvili', mfaEnabled: true,
  }).returning();

  const [coordinator] = await db.insert(s.users).values({
    tenantId: tenant.id, email: 'tonia@helphome.au', passwordHash: 'test', role: 'coordinator', fullName: 'Tonia Fridlis', mfaEnabled: true,
  }).returning();

  const [workerUser] = await db.insert(s.users).values({
    tenantId: tenant.id, email: 'sarah@helphome.au', passwordHash: 'test', role: 'worker', fullName: 'Sarah Johnson',
  }).returning();

  const [clientUser] = await db.insert(s.users).values({
    tenantId: tenant.id, email: 'jane@helphome.au', passwordHash: 'test', role: 'client', fullName: 'Jane Doe',
  }).returning();

  const [worker] = await db.insert(s.workerProfiles).values({
    userId: workerUser.id, tenantId: tenant.id, abn: '61162659969',
    bio: 'Experienced support worker who loves animals.',
    skills: ['Personal Care', 'Community Access'], interests: ['dogs', 'music', 'fitness'],
    hourlyRate: 41.5, consentToDisplay: true, verificationStatus: 'verified',
  }).returning();

  const [client] = await db.insert(s.clientProfiles).values({
    userId: clientUser.id, tenantId: tenant.id, fullName: 'Jane Doe', dob: '1996-04-12',
    address: '12 George St, Sydney NSW', phone: '0400 000 000',
    fundingStream: 'ndis', planManagerType: 'plan_managed', planManagerName: 'PlanCare',
    interests: ['dogs', 'music'], supportGoals: ['Gym twice a week'],
  }).returning();

  await db.insert(s.workerDocuments).values([
    { workerId: worker.id, docType: 'police_check', fileUrl: '/docs/pc.pdf', issueDate: '2025-01-10', expiryDate: '2029-01-09', isVerified: true },
    { workerId: worker.id, docType: 'wwcc', fileUrl: '/docs/wwcc.pdf', issueDate: '2024-06-01', expiryDate: '2029-05-31', isVerified: true },
  ]);

  const [shift] = await db.insert(s.shifts).values({
    tenantId: tenant.id, clientId: client.id, workerId: worker.id,
    startTime: new Date(Date.now() - 86400000), endTime: new Date(Date.now() - 86400000 + 3 * 3600000),
    serviceType: 'Community Access', status: 'completed', matchScore: 86, matchedOn: ['dogs', 'music'],
  }).returning();

  const [note] = await db.insert(s.progressNotes).values({
    shiftId: shift.id, workerId: worker.id,
    body: 'Walked to the park, practiced bus travel. Client engaged and happy.',
    approvalStatus: 'approved', approvedBy: coordinator.id, approvedAt: new Date(),
  }).returning();

  await db.insert(s.invoices).values({
    tenantId: tenant.id, shiftId: shift.id, progressNoteId: note.id,
    type: 'client_invoice', amount: 124.5, claimRoute: 'plan_manager', planManagerName: 'PlanCare', status: 'submitted',
  });

  await db.insert(s.jobPostings).values({
    tenantId: tenant.id, coordinatorId: coordinator.id, serviceType: 'Personal Care',
    startTime: new Date(Date.now() + 86400000), endTime: new Date(Date.now() + 86400000 + 2 * 3600000),
    location: 'Bondi', rate: 41.5, status: 'open',
  });

  await db.insert(s.wellnessLogs).values([
    { tenantId: tenant.id, userId: workerUser.id, audience: 'worker', logType: 'load', score: 4, notes: 'Heavy week.' },
    { tenantId: tenant.id, userId: workerUser.id, audience: 'worker', logType: 'supported', score: 5 },
    { tenantId: tenant.id, userId: workerUser.id, audience: 'worker', logType: 'balance', score: 4 },
    { tenantId: tenant.id, userId: clientUser.id, audience: 'client', logType: 'mood', score: 8 },
  ]);

  await db.insert(s.signupLeads).values({
    door: 'coordinator', name: 'Jewish Care', email: 'intake@jewishcare.example', orgName: 'Jewish Care',
  });

  console.log('[seed] tenant HelpHome + demo data inserted');
}