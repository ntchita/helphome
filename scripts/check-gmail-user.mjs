import { eq } from 'drizzle-orm';
import { getDb, schema } from '../src/db/connection.ts';

const db = await getDb();
const [user] = await db.select().from(schema.users).where(eq(schema.users.email, 'nik.schwarzer@gmail.com')).limit(1);
console.log('user:', user ? { id: user.id, role: user.role, emailVerified: user.emailVerified } : 'NOT FOUND');

if (user) {
  const wp = await db.select().from(schema.workerProfiles).where(eq(schema.workerProfiles.userId, user.id));
  const cp = await db.select().from(schema.clientProfiles).where(eq(schema.clientProfiles.userId, user.id));
  console.log('workerProfiles:', wp.length);
  console.log('wp detail:', wp.map(p => ({ workerType: p.workerType, consent: p.consentToDisplay, verification: p.verificationStatus })));
  console.log('clientProfiles:', cp.length);
}
process.exit(0);