import styles from './ProgressBar.module.css';

export type ProgressBarStatus = 'run' | 'wait' | 'pause' | 'stop' | 'done';

export type ProgressBarProps = {
  progress: number;
  'data-s': ProgressBarStatus;
  className?: string;
};

function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function ProgressBar({
  progress,
  'data-s': status,
  className,
}: ProgressBarProps) {
  const pct = clampProgress(progress);
  /* Global `bar` kept so status.css / future motion hooks match prototype. */
  const classes = ['bar', styles.bar, className].filter(Boolean).join(' ');

  return (
    <div data-s={status} className={classes} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className={styles.fill} style={{ width: `${pct}%` }} />
    </div>
  );
}
