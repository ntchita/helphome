import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';
import { seed } from './seed';

let db: PgliteDatabase<typeof schema> | undefined;

// Local/dev: embedded Postgres (PGlite) in .data/pg — zero installs.
// Prod later: swap to drizzle-orm/node-postgres + DATABASE_URL (Azure AU East), same migrations.
export async function getDb(): Promise<PgliteDatabase<typeof schema>> {
  if (!db) {
    const client = new PGlite(process.env.PGDATA ?? '.data/pg');
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: 'drizzle' });
    await seed(db);
  }
  return db;
}

export { schema };