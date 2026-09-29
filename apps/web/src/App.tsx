import { useEffect } from 'react';
import { Toast } from '@/components/Toast';
import { ActivityFeed } from '@/features/activity-feed';
import { LoginView } from '@/features/auth';
import { Board } from '@/features/board';
import { ChronoPanel } from '@/features/chrono';
import { DiagramView } from '@/features/diagram';
import { Header } from '@/features/header';
import { Import } from '@/features/import';
import { Kpis } from '@/features/kpis';
import { OperatorView } from '@/features/operator';
import { OrderDrawer } from '@/features/order-drawer';
import { OrdersTable } from '@/features/orders-table';
import { Pauses } from '@/features/pauses';
import { Track } from '@/features/track';
import { UsersPanel } from '@/features/users';
import { subscribeProduction } from '@/services/live';
import { isPresentation } from '@/services/presentation';
import { startSimulator, stopSimulator } from '@/services/simulator';
import { useSessionStore } from '@/store/useSessionStore';
import { useUiStore, type UiTheme } from '@/store/useUiStore';
import type { Role } from '@/domain/types';
import styles from './App.module.css';

function applyDocumentUi(role: Role, theme: UiTheme, motion: boolean) {
  const root = document.documentElement;
  root.dataset.role = role;

  if (theme == null) delete root.dataset.theme;
  else root.dataset.theme = theme;

  if (!motion) root.dataset.motion = 'off';
  else if (document.hidden) root.dataset.motion = 'paused';
  else delete root.dataset.motion;
}

export default function App() {
  const status = useSessionStore((s) => s.status);
  const sessionRole = useSessionStore((s) => s.user?.role);
  const restore = useSessionStore((s) => s.restore);
  const role = useUiStore((s) => s.role);
  const view = useUiStore((s) => s.view);
  const theme = useUiStore((s) => s.theme);
  const motion = useUiStore((s) => s.motion);
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    applyDocumentUi(role, theme, motion);
    const onVisibility = () => applyDocumentUi(role, theme, motion);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [role, theme, motion]);

  useEffect(() => {
    if (status !== 'in' || isPresentation()) return;
    return subscribeProduction();
  }, [status]);

  useEffect(() => {
    if (status !== 'in' || !isPresentation()) return;
    startSimulator();
    return () => stopSimulator();
  }, [status]);

  if (status === 'unknown') {
    return <main className={styles.page}>Conferindo sessão…</main>;
  }

  if (status === 'anon') {
    return (
      <>
        <LoginView />
        {toasts.map((t) => (
          <Toast key={t.id} message={t.text} onDone={() => dismissToast(t.id)} />
        ))}
      </>
    );
  }

  return (
    <div className={styles.page}>
      <Header />
      {role === 'operator' ? (
        <OperatorView />
      ) : (
        <>
          <Kpis />
          {view === 'list' ? (
            <div className={styles.flowList}>
              <div className={styles.flowCol}>
                <Track />
              </div>
              <div className={styles.listCol}>
                <OrdersTable />
              </div>
            </div>
          ) : (
            <>
              <Track />
              {view === 'board' ? <Board /> : null}
              {view === 'diag' ? <DiagramView /> : null}
            </>
          )}
          <ActivityFeed />
        </>
      )}
      <OrderDrawer />
      <Pauses />
      {role === 'manager' ? <Import /> : null}
      {sessionRole === 'manager' ? <UsersPanel /> : null}
      {sessionRole === 'manager' ? <ChronoPanel /> : null}
      {toasts.map((t) => (
        <Toast key={t.id} message={t.text} onDone={() => dismissToast(t.id)} />
      ))}
    </div>
  );
}
