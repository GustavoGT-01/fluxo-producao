import { describe, expect, it } from 'vitest';
import { computeBottlenecks } from '@fluxo/shared';

const sectors = [{ id: 'a' }, { id: 'b' }];

function order(id: string, sectorId: string, status: string) {
  return { id, progressBySector: { [sectorId]: { status } } };
}

describe('computeBottlenecks', () => {
  it('sem tempo, escolhe a fila maior', () => {
    const orders = [order('1', 'a', 'run'), order('2', 'b', 'run'), order('3', 'b', 'wait')];
    expect(computeBottlenecks(orders, sectors)).toBe('b');
  });

  it('com tempo, setor lento e fila menor ganha da fila maior', () => {
    const orders = [
      order('1', 'a', 'run'),
      order('2', 'a', 'run'),
      order('3', 'b', 'run'),
      order('4', 'b', 'wait'),
      order('5', 'b', 'pause'),
    ];
    expect(computeBottlenecks(orders, sectors, { a: 100_000, b: 1_000 })).toBe('a');
  });
});
