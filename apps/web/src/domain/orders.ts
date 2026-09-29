import type { Order, OrderFilters, Sector, Status } from './types';

const ACTIVE: ReadonlySet<Status> = new Set([
  'run',
  'wait',
  'pause',
  'stop',
]);

/** OP só inicia no setor se TODOS os pré-requisitos estiverem concluídos. */
export function canStart(order: Order, sector: Sector): boolean {
  return sector.deps.every(
    (d) => order.progressBySector[d]?.status === 'done',
  );
}

export function availableSectors(order: Order, sectors: Sector[]): Sector[] {
  return sectors.filter((s) => {
    const p = order.progressBySector[s.id];
    return (!p || p.status !== 'done') && canStart(order, s);
  });
}

export function isOrderDone(order: Order, finalSectorId: string): boolean {
  return order.progressBySector[finalSectorId]?.status === 'done';
}

function statusMatches(
  order: Order,
  filter: ReadonlySet<Status> | readonly Status[],
): boolean {
  const wanted =
    filter instanceof Set ? filter : new Set(filter as readonly Status[]);
  if (wanted.size === 0) return true;
  return Object.values(order.progressBySector).some((p) =>
    wanted.has(p.status),
  );
}

function queryMatches(order: Order, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [order.id, order.product, order.client, order.orderCode]
    .join('\0')
    .toLowerCase()
    .includes(q);
}

function sectorMatches(
  order: Order,
  sectorId: string,
  sectors: readonly Sector[],
): boolean {
  const p = order.progressBySector[sectorId];
  if (p && ACTIVE.has(p.status)) return true;
  if (p?.status === 'done') return false;
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return false;
  return canStart(order, sector);
}

export function filterOrders(
  orders: readonly Order[],
  filters: OrderFilters,
  sectors: readonly Sector[] = [],
): Order[] {
  const {
    status,
    batch,
    query,
    urgentOnly = false,
    sectorId = null,
  } = filters;

  return orders.filter((order) => {
    if (urgentOnly && !order.urgent) return false;
    if (batch && order.batch !== batch) return false;
    if (query !== undefined && !queryMatches(order, query)) return false;
    if (status !== undefined && !statusMatches(order, status)) return false;
    if (sectorId && !sectorMatches(order, sectorId, sectors)) return false;
    return true;
  });
}
