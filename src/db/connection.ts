import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import postgres from 'postgres';
import * as schema from './schema.ts';
import { seed } from './seed.ts';

type Database = PgliteDatabase<typeof schema> | PostgresJsDatabase<typeof schema>;

let cached: Database | undefined;
let mode: 'pglite' | 'postgres' = 'pglite';

async function loadDbUrl(): Promise<string> {
  const g = globalThis as any;
  if (g.__HYPERDRIVE_URL) return g.__HYPERDRIVE_URL;
  if (typeof process !== 'undefined' && process.env?.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const { readFileSync } = await import('fs');
    const raw = readFileSync('.dev.vars', 'utf-8');
    const line = raw.split('\n').find((l) => l.startsWith('DATABASE_URL='));
    if (line) return line.slice('DATABASE_URL='.length).trim();
  } catch {}
  return '';
}

export async function getDb(): Promise<Database> {
  const url = await loadDbUrl();
  const inWorkers =
    typeof (globalThis as any).__HYPERDRIVE_URL === 'string' &&
    (globalThis as any).__HYPERDRIVE_URL.length > 0;

  if (url && url.startsWith('postgres')) {
    mode = 'postgres';

    if (inWorkers) {
      // Workers: create a fresh client per request — connections don't survive
      // between requests, so caching the client causes "connection closed" errors.
      const client = postgres(url, { max: 1, prepare: false, idle_timeout: 5 });
      return drizzlePg(client, { schema });
    }

    // Node (local backend): cache is safe — long-lived process
    if (cached) return cached;
    const client = postgres(url, { max: 5, prepare: false });
    cached = drizzlePg(client, { schema });
    try {
      const existing = await (cached as PostgresJsDatabase<typeof schema>).select().from(schema.tenants).limit(1);
      if (existing.length === 0) await seed(cached as any);
    } catch {}
    return cached;
  }

  // PGlite local fallback
  if (cached) return cached;
  const client = new PGlite((typeof process !== 'undefined' && process.env?.PGDATA) || '.data/pg');
  cached = drizzlePglite(client, { schema });
  await migratePglite(cached, { migrationsFolder: 'drizzle' });
  await seed(cached as any);
  return cached;
}

export function getDbMode() {
  return mode;
}

export { schema };