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

type DbMode = 'local' | 'remote';

async function readDevVars(): Promise<Record<string, string>> {
  try {
    const { readFileSync } = await import('fs');
    const raw = readFileSync('.dev.vars', 'utf-8');
    const out: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim();
    }
    return out;
  } catch {
    return {};
  }
}

function resolveMode(devVars: Record<string, string>): DbMode {
  // Priority: process.env → .dev.vars → default 'local' (safe)
  const raw = (typeof process !== 'undefined' && process.env?.DB_MODE) || devVars.DB_MODE || 'local';
  return raw === 'remote' ? 'remote' : 'local';
}

function resolveDbUrl(devVars: Record<string, string>): string {
  const g = globalThis as any;
  if (g.__HYPERDRIVE_URL) return g.__HYPERDRIVE_URL;
  if (typeof process !== 'undefined' && process.env?.DATABASE_URL) return process.env.DATABASE_URL;
  return devVars.DATABASE_URL || '';
}

export async function getDb(): Promise<Database> {
  const inWorkers =
    typeof (globalThis as any).__HYPERDRIVE_URL === 'string' &&
    (globalThis as any).__HYPERDRIVE_URL.length > 0;

  if (cached) return cached;

  const devVars = await readDevVars();
  const dbMode = resolveMode(devVars);
  const url = resolveDbUrl(devVars);

  // Workers ALWAYS use Hyperdrive (production) — ignore DB_MODE
  if (inWorkers) {
    if (!url || !url.startsWith('postgres')) {
      throw new Error('Workers require HYPERDRIVE connection string');
    }
    mode = 'postgres';
    // Fresh client per request — Workers don't keep connections alive
    const client = postgres(url, { max: 1, prepare: false, idle_timeout: 5 });
    return drizzlePg(client, { schema });
  }

  // Local + DB_MODE=remote → Supabase (parity testing)
  if (dbMode === 'remote') {
    if (!url || !url.startsWith('postgres')) {
      throw new Error('DB_MODE=remote but DATABASE_URL is missing or invalid in .dev.vars');
    }
    mode = 'postgres';
    const client = postgres(url, { max: 5, prepare: false });
    cached = drizzlePg(client, { schema });
    try {
      const existing = await (cached as PostgresJsDatabase<typeof schema>).select().from(schema.tenants).limit(1);
      if (existing.length === 0) await seed(cached as any);
    } catch {}
    return cached;
  }

  // Local + DB_MODE=local (default) → PGlite
  mode = 'pglite';
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