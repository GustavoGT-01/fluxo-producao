import { useEffect, useState } from 'react';
import styles from './Toast.module.css';

export type ToastProps = {
  message: string;
  onDone: () => void;
};

const SHOW_MS = 2200;
const FADE_MS = 250;

export function Toast({ message, onDone }: ToastProps) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const show = window.requestAnimationFrame(() => setOn(true));
    let fadeTimer = 0;
    const hideTimer = window.setTimeout(() => {
      setOn(false);
      fadeTimer = window.setTimeout(onDone, FADE_MS);
    }, SHOW_MS);

    return () => {
      window.cancelAnimationFrame(show);
      window.clearTimeout(hideTimer);
      window.clearTimeout(fadeTimer);
    };
  }, [message, onDone]);

  const classes = ['toast', styles.toast, on ? styles.on : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="status">
      {message}
    </div>
  );
}
