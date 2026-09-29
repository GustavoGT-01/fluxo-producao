import { describe, expect, it } from 'vitest';
import { isIndependent, topoSort, wouldCreateCycle } from '../graph';
import type { Sector } from '../types';

function sector(
  id: string,
  deps: string[] = [],
  pos = { x: 0, y: 0 },
): Sector {
  return {
    id,
    name: id,
    icon: '',
    color: '',
    deps,
    pos,
  };
}

describe('wouldCreateCycle', () => {
  it('bloqueia ciclo A→B→A', () => {
    const sectors = [sector('A'), sector('B', ['A'])];
    expect(wouldCreateCycle(sectors, 'B', 'A')).toBe(true);
  });

  it('permite aresta nova sem ciclo', () => {
    const sectors = [sector('A'), sector('B'), sector('C', ['A'])];
    expect(wouldCreateCycle(sectors, 'B', 'C')).toBe(false);
  });
});

describe('topoSort', () => {
  it('ordena DAG pequeno', () => {
    const sectors = [
      sector('A'),
      sector('B', ['A']),
      sector('C', ['A']),
      sector('D', ['B', 'C']),
    ];
    const order = topoSort(sectors);
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'));
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'));
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
    expect(order).toHaveLength(4);
  });

  it('lança em grafo com ciclo', () => {
    const sectors = [sector('A', ['B']), sector('B', ['A'])];
    expect(() => topoSort(sectors)).toThrow('Grafo com ciclo');
  });
});

describe('isIndependent', () => {
  it('true iff deps.length === 0', () => {
    expect(isIndependent(sector('cnc', []))).toBe(true);
    expect(isIndependent(sector('costura', ['corte']))).toBe(false);
  });
});
