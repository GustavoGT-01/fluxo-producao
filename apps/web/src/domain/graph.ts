import type { Sector } from './types';

export function wouldCreateCycle(
  sectors: Sector[],
  from: string,
  to: string,
): boolean {
  const children = (id: string) =>
    sectors.filter((s) => s.deps.includes(id)).map((s) => s.id);
  const seen = new Set<string>();
  const stack = [to];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === from) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...children(cur));
  }
  return false;
}

/** Ordenação topológica (Kahn) — ordem visual do track. */
export function topoSort(sectors: Sector[]): string[] {
  const indeg = new Map(sectors.map((s) => [s.id, s.deps.length]));
  const queue = sectors.filter((s) => s.deps.length === 0).map((s) => s.id);
  const out: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(id);
    sectors
      .filter((s) => s.deps.includes(id))
      .forEach((s) => {
        indeg.set(s.id, indeg.get(s.id)! - 1);
        if (indeg.get(s.id) === 0) queue.push(s.id);
      });
  }
  if (out.length !== sectors.length) throw new Error('Grafo com ciclo');
  return out;
}

export const isIndependent = (s: Sector) => s.deps.length === 0;
