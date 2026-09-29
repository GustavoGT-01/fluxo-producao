import type { Order, Pause, Sector } from '@/domain/types';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const OUTBOX_KEY = 'fluxo-outbox';

interface OutboxItem {
  path: string;
  method: string;
  body: unknown;
}

function readOutbox(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: OutboxItem[]): void {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const res = await fetch(path, { ...init, headers, credentials: 'include' });
  if (!res.ok) {
    let message = 'Falha na API';
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* corpo vazio */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function sendJson<T>(path: string, method: string, body: unknown): Promise<T> {
  try {
    return await api<T>(path, { method, body: JSON.stringify(body) });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const items = readOutbox();
    items.push({ path, method, body });
    writeOutbox(items);
    throw error;
  }
}

export async function flushOutbox(): Promise<void> {
  const items = readOutbox();
  if (items.length === 0) return;
  const pending: OutboxItem[] = [];
  for (const item of items) {
    try {
      await api(item.path, { method: item.method, body: JSON.stringify(item.body) });
    } catch (error) {
      if (error instanceof ApiError) continue;
      pending.push(item);
    }
  }
  writeOutbox(pending);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushOutbox();
  });
}

export interface SessionUser {
  id: string;
  name: string;
  role: 'manager' | 'operator';
  sectorId: string | null;
}

export interface Bootstrap {
  user: SessionUser;
  sectors: Sector[];
  orders: Order[];
  pauses: Pause[];
  feed: { id: string; text: string; at: string }[];
}

export function fetchMe(): Promise<{ user: SessionUser }> {
  return api('/api/auth/me');
}

export function fetchOperatorSectors(): Promise<{
  sectors: Array<{ id: string; name: string; icon: string }>;
}> {
  return api('/api/auth/operator-sectors');
}

export function loginManager(email: string, password: string): Promise<{ user: SessionUser }> {
  return api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ kind: 'manager', email, password }),
  });
}

export function loginOperator(sectorId: string, pin: string): Promise<{ user: SessionUser }> {
  return api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ kind: 'operator', sectorId, pin }),
  });
}

export function logoutApi(): Promise<{ ok: boolean }> {
  return api('/api/auth/logout', { method: 'POST' });
}

export function fetchBootstrap(): Promise<Bootstrap> {
  return api('/api/bootstrap');
}

export interface Account {
  id: string;
  name: string;
  role: 'manager' | 'operator';
  email: string | null;
  sectorId: string | null;
  active: boolean;
}

export function fetchUsers(): Promise<{ users: Account[] }> {
  return api('/api/users');
}

export function createUser(body: {
  kind: 'manager';
  name: string;
  email: string;
  password: string;
} | {
  kind: 'operator';
  name: string;
  sectorId: string;
  pin: string;
}): Promise<{ user: Account }> {
  return api('/api/users', { method: 'POST', body: JSON.stringify(body) });
}

export function patchUser(
  id: string,
  body: {
    name?: string;
    email?: string;
    password?: string;
    pin?: string;
    sectorId?: string;
    active?: boolean;
  },
): Promise<{ user: Account }> {
  return api(`/api/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export interface ChronoSummaryRow {
  productKey: string;
  product: string;
  sectorId: string;
  n: number;
  avgActiveMs: number;
  medianActiveMs: number;
  p90ActiveMs: number;
  avgActiveMsPerUnit: number;
  medianActiveMsPerUnit: number;
  p90ActiveMsPerUnit: number;
}

export interface ChronoEstimate {
  sectors: Array<{ sectorId: string; estimatedMs: number; sampleCount: number }>;
  totalMs: number;
  sampleCounts: Record<string, number>;
}

export function fetchChronoSummary(): Promise<{ summary: ChronoSummaryRow[] }> {
  return api('/api/chrono/summary');
}

export function estimateChrono(product: string, quantity: number): Promise<ChronoEstimate> {
  return api('/api/chrono/estimate', {
    method: 'POST',
    body: JSON.stringify({ product, quantity }),
  });
}
