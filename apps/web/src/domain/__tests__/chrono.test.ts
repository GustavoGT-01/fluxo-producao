import { describe, expect, it } from 'vitest';
import {
  estimateLeadTime,
  normalizeProductKey,
  summarizeSamples,
  type TimeSample,
} from '../chrono';

describe('normalizeProductKey', () => {
  it('trim e lower', () => {
    expect(normalizeProductKey('  Sofá Milano  ')).toBe('sofá milano');
  });
});

describe('summarizeSamples', () => {
  it('mediana e n por produto×setor', () => {
    const samples: TimeSample[] = [
      {
        product: 'Sofá',
        productKey: 'sofá',
        sectorId: 'cnc',
        quantity: 2,
        activeMs: 100_000,
        pauseMs: 20_000,
        wallMs: 120_000,
      },
      {
        product: 'Sofá',
        productKey: 'sofá',
        sectorId: 'cnc',
        quantity: 2,
        activeMs: 200_000,
        pauseMs: 0,
        wallMs: 200_000,
      },
      {
        product: 'Sofá',
        productKey: 'sofá',
        sectorId: 'cnc',
        quantity: 2,
        activeMs: 300_000,
        pauseMs: 50_000,
        wallMs: 350_000,
      },
    ];
    const summary = summarizeSamples(samples);
    expect(summary).toHaveLength(1);
    expect(summary[0].n).toBe(3);
    expect(summary[0].medianActiveMs).toBe(200_000);
    expect(summary[0].medianActiveMsPerUnit).toBe(100_000);
  });

  it('tempo ativo menor que bruto quando há pausa', () => {
    const samples: TimeSample[] = [
      {
        product: 'Puff',
        productKey: 'puff',
        sectorId: 'corte',
        quantity: 1,
        activeMs: 60_000,
        pauseMs: 40_000,
        wallMs: 100_000,
      },
    ];
    expect(samples[0].activeMs).toBeLessThan(samples[0].wallMs);
    expect(summarizeSamples(samples)[0].medianActiveMs).toBe(60_000);
  });
});

describe('estimateLeadTime', () => {
  it('paralelo = max; serial = soma no caminho', () => {
    const samples: TimeSample[] = [
      {
        product: 'Cadeira',
        productKey: 'cadeira',
        sectorId: 'cnc',
        quantity: 1,
        activeMs: 10_000,
        pauseMs: 0,
        wallMs: 10_000,
      },
      {
        product: 'Cadeira',
        productKey: 'cadeira',
        sectorId: 'corte',
        quantity: 1,
        activeMs: 30_000,
        pauseMs: 0,
        wallMs: 30_000,
      },
      {
        product: 'Cadeira',
        productKey: 'cadeira',
        sectorId: 'montagem',
        quantity: 1,
        activeMs: 5_000,
        pauseMs: 0,
        wallMs: 5_000,
      },
    ];
    const estimate = estimateLeadTime({
      product: 'Cadeira',
      quantity: 2,
      samples,
      sectors: [
        { id: 'cnc', deps: [] },
        { id: 'corte', deps: [] },
        { id: 'montagem', deps: ['cnc', 'corte'] },
      ],
    });
    expect(estimate.sectors.find((s) => s.sectorId === 'cnc')?.estimatedMs).toBe(20_000);
    expect(estimate.sectors.find((s) => s.sectorId === 'corte')?.estimatedMs).toBe(60_000);
    expect(estimate.sectors.find((s) => s.sectorId === 'montagem')?.estimatedMs).toBe(10_000);
    // max(cnc, corte) + montagem = 60k + 10k
    expect(estimate.totalMs).toBe(70_000);
  });
});
