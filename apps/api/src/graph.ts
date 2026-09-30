/** Implementação única em @fluxo/shared. */
export { canStart, wouldCreateCycle } from '@fluxo/shared';

export interface SectorRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  deps: string[];
  pos: { x: number; y: number };
}
