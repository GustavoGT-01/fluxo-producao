import { STATUSES } from './constants';
import type { Order, Sector, Status } from './types';

const ACTIVE: ReadonlySet<Status> = new Set([
  'run',
  'wait',
  'pause',
  'stop',
]);

const STATUS_PRIORITY: Status[] = ['stop', 'pause', 'run', 'wait', 'done'];

function deriveOrderStatus(order: Order): Status {
  const present = new Set(
    Object.values(order.progressBySector).map((p) => p.status),
  );
  for (const s of STATUS_PRIORITY) {
    if (present.has(s)) return s;
  }
  return 'wait';
}

export function countByStatus(orders: readonly Order[]): Record<Status, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
    Status,
    number
  >;
  for (const order of orders) {
    counts[deriveOrderStatus(order)] += 1;
  }
  return counts;
}

/**
 * Setor com mais OPs ativas (run|wait|pause|stop).
 * Empate: menor id. Sem ativas: null.
 */
export function isPauseStale(at: string, now = Date.now(), limitMs = 15 * 60 * 1000): boolean {
  const t = Date.parse(at);
  if (Number.isNaN(t)) return false;
  return now - t >= limitMs;
}

/**
 * Setor com mais OPs ativas (run|wait|pause|stop).
 * Empate: menor id. Sem ativas: null.
 */
export function computeBottlenecks(
  orders: readonly Order[],
  sectors: readonly Sector[],
): string | null {
  const counts = new Map(sectors.map((s) => [s.id, 0]));
  for (const order of orders) {
    for (const [sectorId, prog] of Object.entries(order.progressBySector)) {
      if (!ACTIVE.has(prog.status)) continue;
      if (!counts.has(sectorId)) continue;
      counts.set(sectorId, counts.get(sectorId)! + 1);
    }
  }
  let best: string | null = null;
  let max = 0;
  for (const [id, n] of counts) {
    if (n > max || (n === max && n > 0 && (best === null || id < best))) {
      max = n;
      best = id;
    }
  }
  return max === 0 ? null : best;
}
