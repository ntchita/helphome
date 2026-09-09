// In production, this connects to Cloudflare D1
// For local dev, we'll use a mock or better-sqlite3 if needed
import { drizzle } from 'drizzle-orm/d1';

export function getDb(env: any) {
  return drizzle(env.DB);
}
