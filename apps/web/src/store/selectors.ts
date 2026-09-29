import { isIndependent } from '@/domain/graph';
import { computeBottlenecks, countByStatus } from '@/domain/metrics';
import { filterOrders, filterOrdersContext } from '@/domain/orders';
import type { Order, Sector, Status } from '@/domain/types';
import type { UiFilters } from '@/store/useUiStore';

function toOrderFilters(
  filters: UiFilters,
  opts?: { skipSector?: boolean; skipStatus?: boolean },
) {
  const statuses = filters.statuses.filter(Boolean) as Status[];
  return {
    status: opts?.skipStatus || statuses.length === 0 ? undefined : statuses,
    batch: filters.batch || undefined,
    query: filters.query || undefined,
    urgentOnly: filters.urgentOnly || undefined,
    sectorId: opts?.skipSector ? null : filters.sectorId,
  };
}

export function selectFilteredOrders(
  orders: Order[],
  filters: UiFilters,
  sectors: Sector[] = [],
): Order[] {
  return filterOrders(orders, toOrderFilters(filters), sectors);
}

/** Contagens do KPI: respeitam lote/busca/urgente; status e setor ficam de fora. */
export function selectKpiBaseOrders(orders: Order[], filters: UiFilters): Order[] {
  return filterOrdersContext(orders, {
    batch: filters.batch || undefined,
    query: filters.query || undefined,
    urgentOnly: filters.urgentOnly || undefined,
  });
}

export function selectKpiCounts(orders: Order[], filters?: UiFilters) {
  const base = filters ? selectKpiBaseOrders(orders, filters) : orders;
  return countByStatus(base);
}

/** Trilho: mesmos filtros da lista, exceto setor (nó clicado filtra o resto). */
export function selectTrackOrders(
  orders: Order[],
  filters: UiFilters,
  sectors: Sector[],
): Order[] {
  return filterOrders(orders, toOrderFilters(filters, { skipSector: true }), sectors);
}

export function selectActiveFilterCount(filters: UiFilters): number {
  let n = 0;
  if (filters.query.trim()) n += 1;
  if (filters.batch) n += 1;
  if (filters.urgentOnly) n += 1;
  if (filters.sectorId) n += 1;
  n += filters.statuses.length;
  return n;
}

export function selectBottlenecks(orders: Order[], sectors: Sector[]) {
  return computeBottlenecks(orders, sectors);
}

export function selectIndependentSectors(sectors: Sector[]): Sector[] {
  return sectors.filter(isIndependent);
}

export function selectOpenOrder(orders: Order[], openOrderId: string | null): Order | null {
  if (!openOrderId) return null;
  return orders.find((o) => o.id === openOrderId) ?? null;
}
