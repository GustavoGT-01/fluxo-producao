export interface SectorRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  deps: string[];
  pos: { x: number; y: number };
}

export function wouldCreateCycle(sectors: SectorRow[], from: string, to: string): boolean {
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

export function canStart(
  progress: Record<string, { status: string } | undefined>,
  deps: string[],
): boolean {
  return deps.every((d) => progress[d]?.status === 'done');
}
