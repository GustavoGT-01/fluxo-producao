import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Drawer } from '@/components/Drawer';
import { Modal } from '@/components/Modal';
import { Pill } from '@/components/Pill';
import { isPauseStale } from '@/domain';
import type { Pause, Status } from '@/domain/types';
import { REASONS } from '@/mocks/catalog';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useUiStore } from '@/store/useUiStore';
import styles from './Pauses.module.css';

const STATE_LABEL: Record<Pause['state'], string> = {
  new: 'Nova',
  seen: 'Vista',
  handled: 'Tratada',
};

const STATE_PILL: Record<Pause['state'], Status> = {
  new: 'pause',
  seen: 'wait',
  handled: 'run',
};

function nowTime(): string {
  return new Date().toISOString().slice(11, 16);
}

export function Pauses() {
  const pauses = useOrdersStore((s) => s.pauses);
  const orders = useOrdersStore((s) => s.orders);
  const setPauseState = useOrdersStore((s) => s.setPauseState);
  const registerPause = useOrdersStore((s) => s.registerPause);
  const setProgress = useOrdersStore((s) => s.setProgress);
  const log = useOrdersStore((s) => s.log);
  const sectors = useGraphStore((s) => s.sectors);
  const openOrder = useUiStore((s) => s.openOrder);
  const pushToast = useUiStore((s) => s.pushToast);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState<'new' | 'all'>('new');
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [note, setNote] = useState('');

  const sectorMap = useMemo(
    () => new Map(sectors.map((s) => [s.id, s])),
    [sectors],
  );
  const orderMap = useMemo(
    () => new Map(orders.map((o) => [o.id, o])),
    [orders],
  );

  const notified = useRef(new Set<string>());
  const newPauses = pauses.filter((p) => p.state === 'new');
  const alertStack = newPauses.slice(0, 3);
  const list =
    filter === 'new' ? pauses.filter((p) => p.state === 'new') : pauses;

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    const stale = pauses.filter((pause) => pause.state !== 'handled' && isPauseStale(pause.at));
    if (stale.length === 0) return;
    const show = () => {
      for (const pause of stale) {
        if (notified.current.has(pause.id)) continue;
        notified.current.add(pause.id);
        const sector = sectorMap.get(pause.sectorId)?.name ?? pause.sectorId;
        new Notification(`Parada em ${sector}`, {
          body: `${pause.orderId} · ${pause.reason}`,
        });
      }
    };
    if (Notification.permission === 'granted') show();
    else if (Notification.permission === 'default') {
      void Notification.requestPermission().then((result) => {
        if (result === 'granted') show();
      });
    }
  }, [pauses, sectorMap]);

  useEffect(() => {
    const onOpen = () => {
      setFilter(pauses.some((p) => p.state === 'new') ? 'new' : 'all');
      setDrawerOpen(true);
    };
    window.addEventListener('fluxo:open-pauses', onOpen);
    return () => window.removeEventListener('fluxo:open-pauses', onOpen);
  }, [pauses]);

  const dismissAlert = (id: string) => {
    setPauseState(id, 'seen');
  };

  const markHandled = (id: string) => {
    setPauseState(id, 'handled');
  };

  const confirmFakePause = () => {
    const target = orders[0];
    if (!target) {
      pushToast('Nenhuma ordem para pausar');
      return;
    }
    const active =
      Object.values(target.progressBySector).find((p) =>
        ['run', 'wait', 'pause', 'stop'].includes(p.status),
      ) ?? Object.values(target.progressBySector)[0];
    if (!active) return;

    setProgress(target.id, active.sectorId, { status: 'pause' });
    registerPause({
      orderId: target.id,
      sectorId: active.sectorId,
      reason,
      note: note.trim() || undefined,
      by: 'Gerência',
      at: nowTime(),
    });
    log(`${target.id} pausada: ${reason}`);
    pushToast('Pausa registrada. A gerência foi avisada.');
    setModalOpen(false);
    setNote('');
  };

  return (
    <>
      <div className={styles.alerts} aria-live="assertive">
        {alertStack.map((p) => {
          const order = orderMap.get(p.orderId);
          const sec = sectorMap.get(p.sectorId);
          return (
            <div key={p.id} className={`${styles.alert} alert`} role="alert">
              <h4>
                <span>⏸ Ordem pausada</span>
                <Button
                  variant="ghost"
                  aria-label="Fechar alerta"
                  onClick={() => dismissAlert(p.id)}
                >
                  ✕
                </Button>
              </h4>
              <dl className={styles.kv}>
                <dt>OP</dt>
                <dd>{p.orderId}</dd>
                <dt>Produto</dt>
                <dd>{order?.product ?? '—'}</dd>
                <dt>Setor</dt>
                <dd>
                  {sec ? `${sec.icon} ${sec.name}` : p.sectorId}
                </dd>
                <dt>Motivo</dt>
                <dd>
                  {p.reason}
                  {isPauseStale(p.at) ? ' · parada há 15 min ou mais' : ''}
                </dd>
                {p.note ? (
                  <>
                    <dt>Obs.</dt>
                    <dd>{p.note}</dd>
                  </>
                ) : null}
                <dt>Quem</dt>
                <dd>
                  {p.by} às {p.at}
                </dd>
              </dl>
              <div className={styles.acts2}>
                <Button
                  variant="brand"
                  onClick={() => {
                    openOrder(p.orderId);
                    dismissAlert(p.id);
                  }}
                >
                  Ver ordem
                </Button>
                <Button onClick={() => dismissAlert(p.id)}>
                  Marcar como vista
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Drawer
        open={drawerOpen}
        title="Paradas e alertas"
        onClose={() => setDrawerOpen(false)}
      >
        <p className={styles.muted}>
          {pauses.length} registros · {newPauses.length} novos
        </p>
        <div className={styles.toolbar}>
          <Button
            variant={filter === 'new' ? 'brand' : 'default'}
            aria-pressed={filter === 'new'}
            onClick={() => setFilter('new')}
          >
            Novas
          </Button>
          <Button
            variant={filter === 'all' ? 'brand' : 'default'}
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            Todas
          </Button>
          <Button variant="brand" onClick={() => setModalOpen(true)}>
            ＋ Registrar pausa
          </Button>
        </div>

        {list.length === 0 ? (
          <div className={styles.empty}>
            Nenhuma parada nova. Quando um operador pausar uma ordem, ela aparece
            aqui.
          </div>
        ) : (
          list.map((p) => {
            const order = orderMap.get(p.orderId);
            const sec = sectorMap.get(p.sectorId);
            return (
              <div
                key={p.id}
                className={`${styles.pcard}${p.state === 'new' ? ` ${styles.pcardNew}` : ''}`}
              >
                <div className={styles.pcardHead}>
                  <b>
                    {p.orderId}
                    {order ? ` · ${order.orderCode}` : ''}
                  </b>
                  <Pill data-s={STATE_PILL[p.state]} className="pill">
                    {STATE_LABEL[p.state]}
                  </Pill>
                </div>
                <dl className={styles.kv} style={{ marginTop: 8 }}>
                  <dt>Cliente</dt>
                  <dd>{order?.client ?? '—'}</dd>
                  <dt>Produto</dt>
                  <dd>
                    {order?.product ?? '—'}
                    {order ? ` ×${order.quantity}` : ''}
                  </dd>
                  <dt>Setor</dt>
                  <dd>{sec ? `${sec.icon} ${sec.name}` : p.sectorId}</dd>
                  <dt>Motivo</dt>
                  <dd>{p.reason}</dd>
                  <dt>Quem</dt>
                  <dd>{p.by}</dd>
                  <dt>Quando</dt>
                  <dd>{p.at}</dd>
                  {p.note ? (
                    <>
                      <dt>Obs.</dt>
                      <dd>{p.note}</dd>
                    </>
                  ) : null}
                </dl>
                <div className={styles.acts2}>
                  <Button onClick={() => openOrder(p.orderId)}>Ver ordem</Button>
                  {p.state !== 'handled' ? (
                    <Button variant="brand" onClick={() => markHandled(p.id)}>
                      Marcar como tratada
                    </Button>
                  ) : null}
                  {p.state === 'new' ? (
                    <Button onClick={() => setPauseState(p.id, 'seen')}>
                      Marcar como vista
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </Drawer>

      <Modal
        open={modalOpen}
        title="Registrar pausa"
        onClose={() => setModalOpen(false)}
      >
        <p className={styles.muted}>
          Simulação: pausa na primeira ordem disponível.
        </p>
        <div className={styles.reasons}>
          {REASONS.map((r) => (
            <label key={r}>
              <input
                type="radio"
                name="pause-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
              />
              {r}
            </label>
          ))}
        </div>
        <label className={styles.noteLabel} htmlFor="pause-note">
          Observação (opcional)
        </label>
        <textarea
          id="pause-note"
          className={styles.note}
          rows={3}
          placeholder="Ex.: faltam 4 espumas D33"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className={styles.modalActs}>
          <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button variant="brand" onClick={confirmFakePause}>
            Registrar pausa e avisar gerência
          </Button>
        </div>
      </Modal>
    </>
  );
}
