import type { ReactNode } from 'react';
import styles from './Pill.module.css';

export type PillStatus = 'run' | 'wait' | 'pause' | 'stop' | 'done';

export type PillProps = {
  'data-s': PillStatus;
  children?: ReactNode;
  className?: string;
};

const LABELS: Record<PillStatus, string> = {
  run: 'Em produção',
  wait: 'Aguardando',
  pause: 'Pausada',
  stop: 'Interrompida',
  done: 'Finalizada',
};

export function Pill({ 'data-s': status, children, className }: PillProps) {
  const classes = [styles.pill, className].filter(Boolean).join(' ');
  const label = children ?? LABELS[status];

  return (
    <span data-s={status} className={classes}>
      {label}
    </span>
  );
}
