import { useEffect, type ReactNode } from 'react';
import styles from './Drawer.module.css';

export type DrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Drawer({ open, title, onClose, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const scrimClass = ['scrim', styles.scrim, open ? styles.scrimOn : '']
    .filter(Boolean)
    .join(' ');
  const drawerClass = ['drawer', styles.drawer, open ? styles.drawerOn : '']
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className={scrimClass} onClick={onClose} aria-hidden={!open} />
      <aside
        className={drawerClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        aria-hidden={!open}
      >
        <div className={styles.head}>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">
            ×
          </button>
          <h2 id="drawer-title" className={styles.title}>
            {title}
          </h2>
        </div>
        {children}
      </aside>
    </>
  );
}
