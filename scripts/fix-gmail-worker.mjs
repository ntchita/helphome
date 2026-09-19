import { eq } from 'drizzle-orm';
import { getDb, schema } from '../src/db/connection.ts';

const db = await getDb();
const [user] = await db.select().from(schema.users).where(eq(schema.users.email, 'nik.schwarzer@gmail.com')).limit(1);
if (!user) { console.log('user not found'); process.exit(1); }

console.log('user id:', user.id);
console.log('role:', user.role);

const wp = await db.select().from(schema.workerProfiles).where(eq(schema.workerProfiles.userId, user.id));
console.log('worker profiles before:', wp.length);

if (wp.length > 0) {
  const r = await db.update(schema.workerProfiles)
    .set({ consentToDisplay: true, verificationStatus: 'verified' })
    .where(eq(schema.workerProfiles.userId, user.id))
    .returning();
  console.log('updated rows:', r.length);
  console.log('after:', r.map(p => ({ consent: p.consentToDisplay, verification: p.verificationStatus })));
} else {
  console.log('no worker profile — creating one');
  await db.insert(schema.workerProfiles).values({
    userId: user.id,
    tenantId: null,
    workerType: 'independent',
    bio: '',
    skills: [],
    interests: [],
    hourlyRate: 40,
    consentToDisplay: true,
    verificationStatus: 'verified',
  });
  console.log('created');
}
process.exit(0);