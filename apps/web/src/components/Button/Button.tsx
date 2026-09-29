import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'default' | 'brand' | 'ghost' | 'danger';

export type ButtonProps = {
  variant?: ButtonVariant;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children' | 'disabled' | 'className'>;

const variantClass: Record<ButtonVariant, string | undefined> = {
  default: undefined,
  brand: styles.brand,
  ghost: styles.ghost,
  danger: styles.danger,
};

export function Button({
  variant = 'default',
  disabled = false,
  children,
  className,
  ...rest
}: ButtonProps) {
  const classes = [styles.btn, variantClass[variant], className]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" disabled={disabled} className={classes} {...rest}>
      {children}
    </button>
  );
}
