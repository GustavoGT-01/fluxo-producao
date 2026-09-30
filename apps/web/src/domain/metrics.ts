import { computeBottlenecks, isPauseStale } from '@fluxo/shared';
import { STATUSES } from './constants';
import type { Order, Status } from './types';

export { computeBottlenecks, isPauseStale };

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

