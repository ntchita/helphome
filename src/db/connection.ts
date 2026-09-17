import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import * as schema from './schema.ts';
import { seed } from './seed.ts';

type Database = PgliteDatabase<typeof schema> | PostgresJsDatabase<typeof schema>;

let db: Database | undefined;
let mode: 'pglite' | 'postgres' = 'pglite';

function loadDbUrl(env?: any): string {
  // 1. Cloudflare Workers binding (Hyperdrive)
  if (env?.HYPERDRIVE?.connectionString) return env.HYPERDRIVE.connectionString;
  // 2. Process env (set by shell)
  if (typeof process !== 'undefined' && process.env?.DATABASE_URL) return process.env.DATABASE_URL;
  // 3. Local .dev.vars fallback
  try {
    const raw = readFileSync('.dev.vars', 'utf-8');
    const line = raw.split('\n').find((l) => l.startsWith('DATABASE_URL='));
    if (line) return line.slice('DATABASE_URL='.length).trim();
  } catch {}
  return '';
}

export async function getDb(env?: any): Promise<Database> {
  if (db) return db;

  const url = loadDbUrl(env);

  if (url && url.startsWith('postgres')) {
    mode = 'postgres';
    const client = postgres(url, { max: 5, prepare: false });
    db = drizzlePg(client, { schema });
    try {
      const existing = await (db as PostgresJsDatabase<typeof schema>).select().from(schema.tenants).limit(1);
      if (existing.length === 0) {
        await seed(db as any);
      }
    } catch {
      // schema not yet pushed
    }
  } else {
    const client = new PGlite((typeof process !== 'undefined' && process.env?.PGDATA) || '.data/pg');
    db = drizzlePglite(client, { schema });
    await migratePglite(db, { migrationsFolder: 'drizzle' });
    await seed(db as any);
  }

  return db;
}

export function getDbMode() {
  return mode;
}

export { schema };