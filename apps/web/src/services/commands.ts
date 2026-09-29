import type { Order, Pause, Sector } from '@/domain/types';
import { api } from '@/services/api';

export async function pushProgress(
  orderId: string,
  sectorId: string,
  patch: { status?: string; progress?: number },
): Promise<Order> {
  const data = await api<{ order: Order }>(`/api/orders/${encodeURIComponent(orderId)}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ sectorId, ...patch }),
  });
  return data.order;
}

export async function pushPause(input: {
  orderId: string;
  sectorId: string;
  reason: string;
  note?: string;
  status?: 'pause' | 'stop';
}): Promise<{ pause: Pause; order: Order }> {
  return api(`/api/orders/${encodeURIComponent(input.orderId)}/pause`, {
    method: 'POST',
    body: JSON.stringify({
      sectorId: input.sectorId,
      reason: input.reason,
      note: input.note,
      status: input.status,
    }),
  });
}

export async function pushSector(
  id: string,
  patch: Partial<Pick<Sector, 'deps' | 'pos' | 'name' | 'icon' | 'color'>>,
): Promise<void> {
  if (patch.deps) {
    await api(`/api/sectors/${encodeURIComponent(id)}/dependencies`, {
      method: 'PUT',
      body: JSON.stringify({ deps: patch.deps }),
    });
    return;
  }
  await api(`/api/sectors/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      pos: patch.pos,
      name: patch.name,
      icon: patch.icon,
      color: patch.color,
    }),
  });
}

export async function pushPauseState(id: string, state: Pause['state']): Promise<void> {
  await api(`/api/pauses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ state }),
  });
}
