import { sign, verify } from 'hono/jwt';

export interface AuthPayload {
  sub: string;
  role: string;
  tenantId: string | null;
  iat: number;
  exp: number;
}

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const ALG = 'HS256';

let cachedSecret: string | undefined;

async function getSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;

  const envSecret =
    (typeof process !== 'undefined' && process.env?.JWT_SECRET) ||
    (globalThis as any).__JWT_SECRET;
  if (envSecret) {
    cachedSecret = envSecret;
    return cachedSecret;
  }

  try {
    const { readFileSync } = await import('fs');
    const raw = readFileSync('.dev.vars', 'utf-8');
    const line = raw.split('\n').find((l) => l.trim().startsWith('JWT_SECRET='));
    if (line) {
      cachedSecret = line.slice(line.indexOf('=') + 1).trim();
      return cachedSecret;
    }
  } catch {}

  throw new Error('JWT_SECRET is not set (checked env and .dev.vars)');
}

export async function signToken(payload: { sub: string; role: string; tenantId: string | null }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const secret = await getSecret();
  return sign({ ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS }, secret, ALG);
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const secret = await getSecret();
    const payload = await verify(token, secret, ALG);
    return payload as unknown as AuthPayload;
  } catch (e: any) {
    console.log('[jwt verify error]', e?.message || e);
    return null;
  }
}

export function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}