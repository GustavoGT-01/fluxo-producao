import type { Sector } from '@/domain/types';

/** STAGES do protótipo HTML — `indep` não persiste; derive via isIndependent(deps). */
export const SECTORS: Sector[] = [
  { id: 'cnc', name: 'CNC', icon: '⚙️', color: '#3B82F6', deps: [], pos: { x: 40, y: 45 } },
  { id: 'metalurgica', name: 'Metalúrgica', icon: '🔩', color: '#EC4899', deps: ['cnc'], pos: { x: 290, y: 60 } },
  { id: 'laminacao', name: 'Laminação', icon: '🪵', color: '#10B981', deps: [], pos: { x: 40, y: 300 } },
  { id: 'marcenaria', name: 'Marcenaria', icon: '🪚', color: '#8B5CF6', deps: [], pos: { x: 40, y: 430 } },
  { id: 'espumacao', name: 'Espumação', icon: '🧽', color: '#14B8A6', deps: ['laminacao', 'marcenaria'], pos: { x: 290, y: 330 } },
  { id: 'preparacao', name: 'Preparação', icon: '🛠️', color: '#06B6D4', deps: ['marcenaria', 'metalurgica'], pos: { x: 540, y: 125 } },
  { id: 'tapecaria', name: 'Tapeçaria', icon: '🧵', color: '#6366F1', deps: ['preparacao', 'espumacao', 'costura'], pos: { x: 790, y: 215 } },
  { id: 'corte', name: 'Corte de tecido', icon: '✂️', color: '#F59E0B', deps: [], pos: { x: 40, y: 175 } },
  { id: 'costura', name: 'Costura', icon: '🪡', color: '#F43F5E', deps: ['corte'], pos: { x: 290, y: 190 } },
  { id: 'embalagem', name: 'Embalagem', icon: '📦', color: '#FB923C', deps: ['tapecaria'], pos: { x: 1040, y: 215 } },
  { id: 'cq', name: 'Controle de qualidade', icon: '✅', color: '#84CC16', deps: ['embalagem'], pos: { x: 1280, y: 215 } },
  { id: 'finalizado', name: 'Finalizado', icon: '🏁', color: '#22C55E', deps: ['cq'], pos: { x: 1510, y: 215 } },
];
