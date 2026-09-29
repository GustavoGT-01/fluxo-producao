import { describe, expect, it } from 'vitest';
import { isIndependent } from '../graph';
import { canStart, filterOrders } from '../orders';
import type { Order, Sector, SectorProgress } from '../types';

function sector(id: string, deps: string[] = []): Sector {
  return {
    id,
    name: id,
    icon: '',
    color: '',
    deps,
    pos: { x: 0, y: 0 },
  };
}

function prog(sectorId: string, status: SectorProgress['status']): SectorProgress {
  return { sectorId, status, progress: status === 'done' ? 100 : 0 };
}

function order(
  partial: Partial<Order> & { progressBySector: Order['progressBySector'] },
): Order {
  return {
    id: 'OP-1',
    product: 'Sofá',
    quantity: 4,
    batch: 'L-1',
    client: 'Cliente',
    orderCode: 'PED-1',
    urgent: false,
    dueDate: '2026-10-01',
    ...partial,
  };
}

const tapecaria = sector('tapecaria', [
  'preparacao',
  'espumacao',
  'costura',
]);

describe('canStart', () => {
  it('Tapeçaria só inicia com Preparação, Espumação e Costura concluídas', () => {
    const incomplete = order({
      progressBySector: {
        preparacao: prog('preparacao', 'done'),
        espumacao: prog('espumacao', 'done'),
        costura: prog('costura', 'run'),
      },
    });
    expect(canStart(incomplete, tapecaria)).toBe(false);

    const ready = order({
      progressBySector: {
        preparacao: prog('preparacao', 'done'),
        espumacao: prog('espumacao', 'done'),
        costura: prog('costura', 'done'),
      },
    });
    expect(canStart(ready, tapecaria)).toBe(true);
  });

  it('setor independente inicia sem pré-requisitos', () => {
    const cnc = sector('cnc', []);
    expect(isIndependent(cnc)).toBe(true);
    expect(canStart(order({ progressBySector: {} }), cnc)).toBe(true);
  });
});

describe('filterOrders', () => {
  it('urgentOnly', () => {
    const orders = [
      order({ id: 'OP-A', urgent: true, progressBySector: {} }),
      order({ id: 'OP-B', urgent: false, progressBySector: {} }),
      order({ id: 'OP-C', urgent: true, progressBySector: {} }),
    ];
    const result = filterOrders(orders, { urgentOnly: true });
    expect(result.map((o) => o.id)).toEqual(['OP-A', 'OP-C']);
  });

  it('busca inclui lote', () => {
    const orders = [
      order({ id: 'OP-A', batch: 'L-0928-A', progressBySector: {} }),
      order({ id: 'OP-B', batch: 'L-0928-B', progressBySector: {} }),
    ];
    expect(filterOrders(orders, { query: '0928-b' }).map((o) => o.id)).toEqual(['OP-B']);
  });

  it('setor + status exige o status naquele setor', () => {
    const cnc = sector('cnc');
    const metal = sector('metalurgica', ['cnc']);
    const orders = [
      order({
        id: 'OP-RUN-CNC',
        progressBySector: { cnc: prog('cnc', 'run') },
      }),
      order({
        id: 'OP-STOP-MET',
        progressBySector: {
          cnc: prog('cnc', 'done'),
          metalurgica: prog('metalurgica', 'stop'),
        },
      }),
    ];
    const result = filterOrders(
      orders,
      { sectorId: 'cnc', status: ['stop'] },
      [cnc, metal],
    );
    expect(result).toEqual([]);

    const atCnc = filterOrders(
      orders,
      { sectorId: 'cnc', status: ['run'] },
      [cnc, metal],
    );
    expect(atCnc.map((o) => o.id)).toEqual(['OP-RUN-CNC']);
  });
});
