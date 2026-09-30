const ACTIVE = new Set(['run', 'wait', 'pause', 'stop']);

export function isPauseStale(at: string, now = Date.now(), limitMs = 15 * 60 * 1000): boolean {
  const t = Date.parse(at);
  if (Number.isNaN(t)) return false;
  return now - t >= limitMs;
}

/**
 * Setor que mais trava a linha.
 * Sem tempo medido: maior fila ativa. Empate no menor id.
 * Com paceMsBySector (ms ativos): fila × tempo. Setor lento ganha de fila maior e rápida.
 */
export function computeBottlenecks(
  orders: readonly {
    progressBySector: Record<string, { status: string } | undefined>;
  }[],
  sectors: readonly { id: string }[],
  paceMsBySector?: Readonly<Record<string, number>>,
): string | null {
  const counts = new Map(sectors.map((s) => [s.id, 0]));
  for (const order of orders) {
    for (const [sectorId, prog] of Object.entries(order.progressBySector)) {
      if (!prog || !ACTIVE.has(prog.status)) continue;
      if (!counts.has(sectorId)) continue;
      counts.set(sectorId, (counts.get(sectorId) ?? 0) + 1);
    }
  }
  const pace = paceMsBySector ?? {};
  const hasPace = Object.values(pace).some((n) => n > 0);
  let best: string | null = null;
  let max = 0;
  for (const [id, n] of counts) {
    if (n === 0) continue;
    const weight = hasPace ? Math.max(1, pace[id] ?? 1) : 1;
    const score = n * weight;
    if (score > max || (score === max && (best === null || id < best))) {
      max = score;
      best = id;
    }
  }
  return best;
}
