import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TokenPayload {
  sub: string;
  role: 'manager' | 'operator';
  sectorId: string | null;
  name: string;
  exp: number;
}

export function signToken(payload: Omit<TokenPayload, 'exp'>, secret: string, ttlMs: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + ttlMs }),
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function readToken(token: string, secret: string): TokenPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload.sub || !payload.exp || payload.exp < Date.now()) return null;
    if (payload.role !== 'manager' && payload.role !== 'operator') return null;
    return payload;
  } catch {
    return null;
  }
}
