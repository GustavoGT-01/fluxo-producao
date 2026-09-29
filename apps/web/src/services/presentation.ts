/** Quadro rico + simulador só em apresentação (`VITE_DEMO=true` / `pnpm --filter web dev:demo`). */
export function isPresentation(): boolean {
  return import.meta.env.VITE_DEMO === 'true';
}
