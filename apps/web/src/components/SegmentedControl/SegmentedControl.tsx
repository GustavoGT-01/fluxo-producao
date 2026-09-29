import styles from './SegmentedControl.module.css';

export type SegmentedOption = {
  value: string;
  label: string;
};

export type SegmentedControlProps = {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  'aria-label': string;
  className?: string;
};

export function SegmentedControl({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: SegmentedControlProps) {
  const classes = [styles.seg, className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={styles.option}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
