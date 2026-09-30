import type { Order, Pause, Sector } from '@/domain/types';
import { sendJson } from '@/services/api';

export async function pushProgress(
  orderId: string,
  sectorId: string,
  patch: { status?: string; progress?: number },
): Promise<Order> {
  const data = await sendJson<{ order: Order }>(
    `/api/orders/${encodeURIComponent(orderId)}/progress`,
    'PATCH',
    { sectorId, ...patch },
  );
  return data.order;
}

export async function pushPause(input: {
  orderId: string;
  sectorId: string;
  reason: string;
  note?: string;
  status?: 'pause' | 'stop';
}): Promise<{ pause: Pause; order: Order }> {
  return sendJson(`/api/orders/${encodeURIComponent(input.orderId)}/pause`, 'POST', {
    sectorId: input.sectorId,
    reason: input.reason,
    note: input.note,
    status: input.status,
  });
}

export async function pushSector(
  id: string,
  patch: Partial<Pick<Sector, 'deps' | 'pos' | 'name' | 'icon' | 'color'>>,
): Promise<void> {
  if (patch.deps) {
    await sendJson(`/api/sectors/${encodeURIComponent(id)}/dependencies`, 'PUT', {
      deps: patch.deps,
    });
    return;
  }
  await sendJson(`/api/sectors/${encodeURIComponent(id)}`, 'PATCH', {
    pos: patch.pos,
    name: patch.name,
    icon: patch.icon,
    color: patch.color,
  });
}

export async function pushPauseState(id: string, state: Pause['state']): Promise<void> {
  await sendJson(`/api/pauses/${encodeURIComponent(id)}`, 'PATCH', { state });
}
