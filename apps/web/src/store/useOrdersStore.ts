import { create } from 'zustand';
import type { Order, Pause, SectorProgress } from '@/domain/types';
import { createDemoOrders } from '@/mocks/orderFactory';
import { isRemoteApply, isSignedIn } from '@/services/authState';
import { pushPause, pushPauseState, pushProgress } from '@/services/commands';
import { isPresentation } from '@/services/presentation';
import { useUiStore } from '@/store/useUiStore';

export interface FeedItem {
  id: string;
  text: string;
  at: string;
}

interface OrdersState {
  orders: Order[];
  pauses: Pause[];
  feed: FeedItem[];
  upsertOrder: (order: Order) => void;
  setProgress: (orderId: string, sectorId: string, patch: Partial<SectorProgress>, opts?: { sync?: boolean }) => void;
  registerPause: (input: Omit<Pause, 'id' | 'state'> & { id?: string; state?: Pause['state']; status?: 'pause' | 'stop'; local?: boolean }) => void;
  setPauseState: (id: string, state: Pause['state']) => void;
  log: (text: string) => void;
}

let feedSeq = 0;
let pauseSeq = 100;

const empty = { orders: [] as Order[], pauses: [] as Pause[], feed: [] as FeedItem[] };
const seed = isPresentation() ? createDemoOrders() : empty;

function skipSync(): boolean {
  return isPresentation() || isRemoteApply() || !isSignedIn();
}

export const useOrdersStore = create<OrdersState>()((set) => ({
  orders: seed.orders,
  pauses: seed.pauses,
  feed: seed.feed,
  upsertOrder: (order) =>
    set((s) => {
      const idx = s.orders.findIndex((o) => o.id === order.id);
      if (idx === -1) return { orders: [...s.orders, order] };
      const orders = s.orders.slice();
      orders[idx] = order;
      return { orders };
    }),
  setProgress: (orderId, sectorId, patch, opts) => {
    const snapshot = useOrdersStore.getState().orders;
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        const prev = o.progressBySector[sectorId] ?? {
          sectorId,
          status: 'wait' as const,
          progress: 0,
        };
        return {
          ...o,
          progressBySector: {
            ...o.progressBySector,
            [sectorId]: { ...prev, ...patch, sectorId },
          },
        };
      }),
    }));
    if (opts?.sync === false || skipSync()) return;
    void pushProgress(orderId, sectorId, patch).catch((error: unknown) => {
      useOrdersStore.setState({ orders: snapshot });
      const message = error instanceof Error ? error.message : 'Falha ao gravar progresso';
      useUiStore.getState().pushToast(message);
    });
  },
  registerPause: (input) => {
    const localId = input.id ?? `P${++pauseSeq}`;
    set((s) => {
      if (s.pauses.some((p) => p.id === localId)) return s;
      const pause: Pause = {
        id: localId,
        orderId: input.orderId,
        sectorId: input.sectorId,
        reason: input.reason,
        note: input.note,
        by: input.by,
        at: input.at,
        state: input.state ?? 'new',
      };
      return { pauses: [pause, ...s.pauses] };
    });
    if (skipSync() || input.id || input.local) return;
    void pushPause({
      orderId: input.orderId,
      sectorId: input.sectorId,
      reason: input.reason,
      note: input.note,
      status: input.status,
    })
      .then(({ pause }) => {
        useOrdersStore.setState((s) => ({
          pauses: s.pauses.some((p) => p.id === pause.id)
            ? s.pauses.filter((p) => p.id !== localId)
            : s.pauses.map((p) => (p.id === localId ? pause : p)),
        }));
      })
      .catch((error: unknown) => {
        useOrdersStore.setState((s) => ({ pauses: s.pauses.filter((p) => p.id !== localId) }));
        const message = error instanceof Error ? error.message : 'Falha ao gravar pausa';
        useUiStore.getState().pushToast(message);
      });
  },
  setPauseState: (id, state) => {
    const snapshot = useOrdersStore.getState().pauses;
    set((s) => ({
      pauses: s.pauses.map((p) => (p.id === id ? { ...p, state } : p)),
    }));
    if (skipSync()) return;
    void pushPauseState(id, state).catch((error: unknown) => {
      useOrdersStore.setState({ pauses: snapshot });
      const message = error instanceof Error ? error.message : 'Falha ao atualizar parada';
      useUiStore.getState().pushToast(message);
    });
  },
  log: (text) => {
    if (isSignedIn() && !isRemoteApply() && !isPresentation()) return;
    set((s) => {
      const at = new Date().toISOString().slice(11, 16);
      const item: FeedItem = { id: `feed-${++feedSeq}`, text, at };
      return { feed: [item, ...s.feed].slice(0, 40) };
    });
  },
}));
