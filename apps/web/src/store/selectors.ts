import { isIndependent } from '@/domain/graph';
import { computeBottlenecks, countByStatus } from '@/domain/metrics';
import { filterOrders } from '@/domain/orders';
import type { Order, Sector, Status } from '@/domain/types';
import type { UiFilters } from '@/store/useUiStore';

export function selectFilteredOrders(
  orders: Order[],
  filters: UiFilters,
  sectors: Sector[] = [],
): Order[] {
  const statuses = filters.statuses.filter(Boolean) as Status[];
  return filterOrders(
    orders,
    {
      status: statuses.length ? statuses : undefined,
      batch: filters.batch || undefined,
      query: filters.query || undefined,
      urgentOnly: filters.urgentOnly || undefined,
      sectorId: filters.sectorId,
    },
    sectors,
  );
}

export function selectKpiCounts(orders: Order[]) {
  return countByStatus(orders);
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
