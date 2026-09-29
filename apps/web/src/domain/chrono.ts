/** Chave estável para agregar produto na cronoanálise. */
export function normalizeProductKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface TimeSample {
  product: string;
  productKey: string;
  sectorId: string;
  quantity: number;
  activeMs: number;
  pauseMs: number;
  wallMs: number;
}

export interface ChronoCellSummary {
  productKey: string;
  product: string;
  sectorId: string;
  n: number;
  avgActiveMs: number;
  medianActiveMs: number;
  p90ActiveMs: number;
  avgActiveMsPerUnit: number;
  medianActiveMsPerUnit: number;
  p90ActiveMsPerUnit: number;
}

export interface SectorEstimate {
  sectorId: string;
  estimatedMs: number;
  sampleCount: number;
}

export interface LeadTimeEstimate {
  sectors: SectorEstimate[];
  totalMs: number;
  sampleCounts: Record<string, number>;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function mean(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Agrega amostras por productKey × sectorId. */
export function summarizeSamples(samples: readonly TimeSample[]): ChronoCellSummary[] {
  const groups = new Map<string, TimeSample[]>();
  for (const sample of samples) {
    const key = `${sample.productKey}::${sample.sectorId}`;
    const list = groups.get(key);
    if (list) list.push(sample);
    else groups.set(key, [sample]);
  }

  const out: ChronoCellSummary[] = [];
  for (const list of groups.values()) {
    const active = list.map((s) => s.activeMs).sort((a, b) => a - b);
    const perUnit = list
      .map((s) => s.activeMs / Math.max(1, s.quantity))
      .sort((a, b) => a - b);
    const first = list[0];
    out.push({
      productKey: first.productKey,
      product: list[list.length - 1].product,
      sectorId: first.sectorId,
      n: list.length,
      avgActiveMs: mean(active),
      medianActiveMs: percentile(active, 0.5),
      p90ActiveMs: percentile(active, 0.9),
      avgActiveMsPerUnit: mean(perUnit),
      medianActiveMsPerUnit: percentile(perUnit, 0.5),
      p90ActiveMsPerUnit: percentile(perUnit, 0.9),
    });
  }
  return out.sort((a, b) =>
    a.productKey === b.productKey
      ? a.sectorId.localeCompare(b.sectorId)
      : a.productKey.localeCompare(b.productKey),
  );
}

type SectorLike = { id: string; deps: string[] };

function topoSortIds(sectors: readonly SectorLike[]): string[] {
  const indeg = new Map(sectors.map((s) => [s.id, s.deps.length]));
  const queue = sectors.filter((s) => s.deps.length === 0).map((s) => s.id);
  const out: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(id);
    for (const s of sectors) {
      if (!s.deps.includes(id)) continue;
      const next = (indeg.get(s.id) ?? 0) - 1;
      indeg.set(s.id, next);
      if (next === 0) queue.push(s.id);
    }
  }
  if (out.length !== sectors.length) {
    return sectors.map((s) => s.id);
  }
  return out;
}

/**
 * Estima lead time: mediana por unidade × quantidade; total = earliest-finish no DAG.
 */
export function estimateLeadTime(input: {
  product: string;
  quantity: number;
  samples: readonly TimeSample[];
  sectors: readonly SectorLike[];
}): LeadTimeEstimate {
  const productKey = normalizeProductKey(input.product);
  const qty = Math.max(1, Math.floor(input.quantity));
  const relevant = input.samples.filter((s) => s.productKey === productKey);
  const summary = summarizeSamples(relevant);
  const bySector = new Map(summary.map((cell) => [cell.sectorId, cell]));

  const sectors: SectorEstimate[] = input.sectors.map((sector) => {
    const cell = bySector.get(sector.id);
    const sampleCount = cell?.n ?? 0;
    const perUnit = cell?.medianActiveMsPerUnit ?? 0;
    return {
      sectorId: sector.id,
      estimatedMs: Math.round(perUnit * qty),
      sampleCount,
    };
  });

  const msById = new Map(sectors.map((s) => [s.sectorId, s.estimatedMs]));
  const finish = new Map<string, number>();
  for (const id of topoSortIds(input.sectors)) {
    const sector = input.sectors.find((s) => s.id === id);
    const depEnd = sector
      ? Math.max(0, ...sector.deps.map((d) => finish.get(d) ?? 0))
      : 0;
    finish.set(id, depEnd + (msById.get(id) ?? 0));
  }
  const totalMs = finish.size ? Math.max(...finish.values()) : 0;
  const sampleCounts: Record<string, number> = {};
  for (const s of sectors) sampleCounts[s.sectorId] = s.sampleCount;

  return { sectors, totalMs, sampleCounts };
}
