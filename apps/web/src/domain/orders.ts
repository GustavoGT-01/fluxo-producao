import { canStart as depsDone } from '@fluxo/shared';
import type { Order, OrderFilters, Sector, Status } from './types';

const ACTIVE: ReadonlySet<Status> = new Set([
  'run',
  'wait',
  'pause',
  'stop',
]);

/** OP só inicia no setor se TODOS os pré-requisitos estiverem concluídos. */
export function canStart(order: Order, sector: Sector): boolean {
  return depsDone(order.progressBySector, sector.deps);
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

function wantedStatuses(
  filter: ReadonlySet<Status> | readonly Status[] | undefined,
): Set<Status> | null {
  if (filter == null) return null;
  const wanted =
    filter instanceof Set ? filter : new Set(filter as readonly Status[]);
  return wanted.size === 0 ? null : wanted;
}

/** Status da OP: prioridade stop > pause > run > wait > done. */
export function orderPrimaryStatus(order: Order): Status {
  const present = new Set(
    Object.values(order.progressBySector).map((p) => p.status),
  );
  for (const s of ['stop', 'pause', 'run', 'wait', 'done'] as const) {
    if (present.has(s)) return s;
  }
  return 'wait';
}

function statusMatches(order: Order, wanted: Set<Status>): boolean {
  return Object.values(order.progressBySector).some((p) => wanted.has(p.status));
}

function queryMatches(order: Order, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [order.id, order.product, order.client, order.orderCode, order.batch]
    .join('\0')
    .toLowerCase()
    .includes(q);
}

/**
 * Setor ativo na OP, ou elegível a iniciar (deps done, ainda não done).
 * Não inclui setor já concluído — alinhado ao trilho / HTML `stage`.
 */
export function sectorMatches(
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

/**
 * Filtros combinam com AND.
 * Setor + status: exige o status no setor escolhido (não em outro).
 * Só status: qualquer setor com aquele status.
 * Só setor: OP ativa ou elegível naquele setor.
 */
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

  const wanted = wantedStatuses(status);

  return orders.filter((order) => {
    if (urgentOnly && !order.urgent) return false;
    if (batch && order.batch !== batch) return false;
    if (query !== undefined && !queryMatches(order, query)) return false;

    if (sectorId && wanted) {
      const cell = order.progressBySector[sectorId];
      return cell != null && wanted.has(cell.status);
    }
    if (wanted && !statusMatches(order, wanted)) return false;
    if (sectorId && !sectorMatches(order, sectorId, sectors)) return false;
    return true;
  });
}

/** Base para KPI/trilho: lote + busca + urgente (sem status nem setor). */
export function filterOrdersContext(
  orders: readonly Order[],
  filters: Pick<OrderFilters, 'batch' | 'query' | 'urgentOnly'>,
): Order[] {
  return filterOrders(orders, {
    batch: filters.batch,
    query: filters.query,
    urgentOnly: filters.urgentOnly,
  });
}
