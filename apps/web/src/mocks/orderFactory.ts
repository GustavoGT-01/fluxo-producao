import type { Order, Pause, Sector, SectorProgress, Status } from '@/domain/types';
import { CLIENTES, LOTES, OPERATORS, PRODS, REASONS } from '@/mocks/catalog';
import { SECTORS } from '@/mocks/sectors';

const QTYS = [4, 6, 8, 10, 12, 20] as const;
const LAST = SECTORS.length - 1;

/** PRNG do protótipo HTML (seed 11). */
export function createPrng(seed = 11) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildProgressBySector(
  sectors: Sector[],
  stageIndex: number,
  status: Status,
  prog: number,
): Record<string, SectorProgress> {
  const progressBySector: Record<string, SectorProgress> = {};

  for (let i = 0; i < stageIndex; i++) {
    const id = sectors[i].id;
    progressBySector[id] = { sectorId: id, status: 'done', progress: 100 };
  }

  const active = sectors[stageIndex];
  if (!active) return progressBySector;

  if (status === 'done') {
    progressBySector[active.id] = { sectorId: active.id, status: 'done', progress: 100 };
  } else {
    progressBySector[active.id] = {
      sectorId: active.id,
      status,
      progress: Math.min(100, Math.max(0, prog)),
    };
  }

  return progressBySector;
}

export interface DemoSeed {
  orders: Order[];
  pauses: Pause[];
  feed: { id: string; text: string; at: string }[];
}

/** Gera ~18 OPs determinísticas com progressBySector (mapa do stage linear do HTML). */
export function createDemoOrders(sectors: Sector[] = SECTORS, seed = 11): DemoSeed {
  const rnd = createPrng(seed);
  let uid = 4820;
  let pauseUid = 0;
  const orders: Order[] = [];
  const pauses: Pause[] = [];

  const count = 18;
  for (let i = 0; i < count; i++) {
    const stage = i < 12 ? i : Math.floor(rnd() * 12);
    let status: Status = 'run';
    const r = rnd();
    if (stage === LAST) status = 'done';
    else if (r > 0.9) status = 'stop';
    else if (r > 0.8) status = 'pause';
    else if (r > 0.72) status = 'wait';

    const prog = status === 'done' ? 100 : Math.floor(rnd() * 90);
    const day = 1 + Math.floor(rnd() * 7);
    const dueDate = `2026-10-${String(day).padStart(2, '0')}`;
    const id = `OP-${uid++}`;
    const sectorId = sectors[stage]?.id ?? sectors[0].id;

    const order: Order = {
      id,
      product: PRODS[Math.floor(rnd() * PRODS.length)],
      quantity: QTYS[Math.floor(rnd() * QTYS.length)],
      batch: LOTES[Math.floor(rnd() * LOTES.length)],
      client: CLIENTES[Math.floor(rnd() * CLIENTES.length)],
      orderCode: `PED-${10420 + Math.floor(rnd() * 80)}`,
      urgent: rnd() < 0.18,
      dueDate,
      progressBySector: buildProgressBySector(sectors, stage, status, prog),
    };
    orders.push(order);

    if (status === 'pause' || status === 'stop') {
      const reason = REASONS[Math.floor(rnd() * REASONS.length)];
      const by =
        status === 'stop'
          ? 'Gerência'
          : `${OPERATORS[stage] ?? 'Operador'} · ${sectors[stage]?.name ?? ''}`;
      pauses.push({
        id: `P${++pauseUid}`,
        orderId: id,
        sectorId,
        reason,
        by,
        at: '2026-09-28T09:40:00.000Z',
        state: 'new',
      });
    }
  }

  const feed = [
    { id: 'f1', text: 'Lote L-0928-C liberado da CNC para a Metalúrgica', at: '08:02' },
    { id: 'f2', text: 'OP-4823 aprovada no controle de qualidade', at: '08:03' },
    { id: 'f3', text: 'Planejamento semanal importado com 18 ordens', at: '08:04' },
  ];

  return { orders, pauses, feed };
}
