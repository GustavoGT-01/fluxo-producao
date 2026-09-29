import { FINAL_SECTOR_ID } from '@/domain/constants';
import { availableSectors, isOrderDone } from '@/domain/orders';
import { OPERATORS, REASONS } from '@/mocks/catalog';
import { createDemoOrders } from '@/mocks/orderFactory';
import { isPresentation } from '@/services/presentation';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useUiStore } from '@/store/useUiStore';

let timer: ReturnType<typeof setInterval> | null = null;
let simSeq = 0;
let boardReady = false;
const resumeIn = new Map<string, number>();
const waitIn = new Map<string, number>();

function cellKey(orderId: string, sectorId: string): string {
  return `${orderId}:${sectorId}`;
}

function ensureDemoBoard(): void {
  if (boardReady) return;
  const { orders, pauses } = useOrdersStore.getState();
  const hasAlert = pauses.some((pause) => pause.state === 'new');
  if (orders.length >= 8 && hasAlert) {
    boardReady = true;
    return;
  }
  const demo = createDemoOrders();
  useOrdersStore.setState({
    orders: demo.orders,
    pauses: demo.pauses,
    feed: demo.feed,
  });
  boardReady = true;
}

const LOCAL = { sync: false } as const;

/** Operadores de exemplo: avançam, pausam (alerta) e retomam. Só apresentação. */
export function tick(): void {
  if (!isPresentation()) return;
  ensureDemoBoard();

  const live = useUiStore.getState().live;
  if (!live) return;

  const speed = Math.max(1, Math.round(useUiStore.getState().speed));
  const sectors = useGraphStore.getState().sectors;
  const { orders, setProgress, registerPause } = useOrdersStore.getState();
  const finished: string[] = [];

  for (const order of orders) {
    if (isOrderDone(order, FINAL_SECTOR_ID)) continue;
    for (const cell of Object.values(order.progressBySector)) {
      const key = cellKey(order.id, cell.sectorId);
      if (cell.status === 'pause') {
        const left = (resumeIn.get(key) ?? 8) - 1;
        if (left <= 0) {
          resumeIn.delete(key);
          setProgress(order.id, cell.sectorId, { status: 'run' }, LOCAL);
        } else {
          resumeIn.set(key, left);
        }
        continue;
      }
      if (cell.status === 'wait') {
        const left = (waitIn.get(key) ?? 3) - 1;
        if (left <= 0) {
          waitIn.delete(key);
          setProgress(order.id, cell.sectorId, { status: 'run' }, LOCAL);
        } else {
          waitIn.set(key, left);
        }
        continue;
      }
      if (cell.status !== 'run' || cell.progress >= 100) continue;
      const bump = (2 + Math.floor(Math.random() * 4)) * speed;
      const next = Math.min(100, cell.progress + bump);
      if (next >= 100) {
        setProgress(order.id, cell.sectorId, { status: 'done', progress: 100 }, LOCAL);
        finished.push(order.id);
      } else {
        setProgress(order.id, cell.sectorId, { progress: next }, LOCAL);
      }
    }
  }

  if (finished.length > 0) {
    const fresh = useOrdersStore.getState().orders;
    for (const orderId of finished) {
      const order = fresh.find((item) => item.id === orderId);
      if (!order) continue;
      const next = availableSectors(order, sectors).filter((sector) => {
        const cell = order.progressBySector[sector.id];
        return !cell || cell.status === 'wait';
      });
      for (const sector of next) {
        setProgress(order.id, sector.id, { status: 'run', progress: 0 }, LOCAL);
      }
    }
  }

  if (Math.random() < 0.04 * speed) {
    const running = useOrdersStore
      .getState()
      .orders.flatMap((order) =>
        Object.values(order.progressBySector)
          .filter((cell) => cell.status === 'run' && cell.progress < 90)
          .map((cell) => ({ order, cell })),
      );
    const pick = running[Math.floor(Math.random() * running.length)];
    if (pick) {
      const index = Math.max(0, sectors.findIndex((sector) => sector.id === pick.cell.sectorId));
      const sector = sectors[index];
      const who = `${OPERATORS[index] ?? 'Operador'} · ${sector?.name ?? pick.cell.sectorId}`;
      const reason = REASONS[Math.floor(Math.random() * REASONS.length)] ?? REASONS[0];
      setProgress(pick.order.id, pick.cell.sectorId, { status: 'pause' }, LOCAL);
      registerPause({
        id: `D${++simSeq}`,
        orderId: pick.order.id,
        sectorId: pick.cell.sectorId,
        reason,
        by: who,
        at: new Date().toISOString(),
        local: true,
      });
      resumeIn.set(cellKey(pick.order.id, pick.cell.sectorId), 8 + Math.floor(Math.random() * 6));
    }
  }
}

const simGlobal = globalThis as { __fluxoSim?: ReturnType<typeof setInterval> };

export function startSimulator(intervalMs = 1000): void {
  if (!isPresentation()) return;
  ensureDemoBoard();
  if (simGlobal.__fluxoSim != null) return;
  simGlobal.__fluxoSim = setInterval(() => tick(), intervalMs);
  timer = simGlobal.__fluxoSim;
}

export function stopSimulator(): void {
  const current = simGlobal.__fluxoSim ?? timer;
  if (current == null) return;
  clearInterval(current);
  simGlobal.__fluxoSim = undefined;
  timer = null;
  boardReady = false;
  resumeIn.clear();
  waitIn.clear();
}
