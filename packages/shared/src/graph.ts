export interface DepSector {
  id: string;
  deps: readonly string[];
}

/** True se a aresta from → to fecha ciclo, inclusive aresta para o mesmo setor. */
export function wouldCreateCycle(
  sectors: readonly DepSector[],
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  const children = (id: string) =>
    sectors.filter((s) => s.deps.includes(id)).map((s) => s.id);
  const seen = new Set<string>();
  const stack = [to];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur) break;
    if (cur === from) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...children(cur));
  }
  return false;
}

/** Ordenação topológica (Kahn). Ciclo lança erro. */
export function topoSort(sectors: readonly DepSector[]): string[] {
  const indeg = new Map(sectors.map((s) => [s.id, s.deps.length]));
  const queue = sectors.filter((s) => s.deps.length === 0).map((s) => s.id);
  const out: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(id);
    sectors
      .filter((s) => s.deps.includes(id))
      .forEach((s) => {
        indeg.set(s.id, (indeg.get(s.id) ?? 0) - 1);
        if (indeg.get(s.id) === 0) queue.push(s.id);
      });
  }
  if (out.length !== sectors.length) throw new Error('Grafo com ciclo');
  return out;
}

export const isIndependent = (s: DepSector) => s.deps.length === 0;

/** Todos os pré-requisitos do setor estão em done. */
export function canStart(
  progress: Record<string, { status: string } | undefined>,
  deps: readonly string[],
): boolean {
  return deps.every((d) => progress[d]?.status === 'done');
}
