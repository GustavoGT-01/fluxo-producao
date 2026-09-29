import type { Status } from './types';

export const STATUSES: readonly Status[] = [
  'run',
  'wait',
  'pause',
  'stop',
  'done',
];

export const STATUS_LABELS: Record<Status, string> = {
  run: 'Em produção',
  wait: 'Aguardando',
  pause: 'Pausada',
  stop: 'Interrompida',
  done: 'Finalizada',
};

/** Sink do DAG no protótipo (STAGES: finalizado ← cq; nenhum setor depende dele). */
export const FINAL_SECTOR_ID = 'finalizado';
