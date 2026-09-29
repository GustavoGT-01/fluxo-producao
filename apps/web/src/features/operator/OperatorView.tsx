import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Pill } from '@/components/Pill';
import { ProgressBar } from '@/components/ProgressBar';
import { FINAL_SECTOR_ID, STATUS_LABELS } from '@/domain/constants';
import { availableSectors, canStart, isOrderDone } from '@/domain/orders';
import type { Order, Sector, Status } from '@/domain/types';
import { OPERATORS, REASONS } from '@/mocks/catalog';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useUiStore } from '@/store/useUiStore';
import styles from './Operator.module.css';

const ACTIVE: ReadonlySet<Status> = new Set(['run', 'wait', 'pause', 'stop']);
const STATUS_RANK: Record<Status, number> = {
  run: 0,
  pause: 1,
  wait: 2,
  stop: 3,
  done: 4,
};

type ActiveSlice = {
  sector: Sector;
  status: Status;
  progress: number;
  hintCanStart: boolean;
};

function resolveActive(
  order: Order,
  sectors: Sector[],
): ActiveSlice | null {
  const activeEntries = Object.values(order.progressBySector)
    .filter((p) => ACTIVE.has(p.status))
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  if (activeEntries.length > 0) {
    const p = activeEntries[0];
    const sector = sectors.find((s) => s.id === p.sectorId);
    if (!sector) return null;
    return {
      sector,
      status: p.status,
      progress: p.progress,
      hintCanStart: canStart(order, sector),
    };
  }

  const avail = availableSectors(order, sectors);
  const first = avail[0];
  if (!first) return null;
  return {
    sector: first,
    status: 'wait',
    progress: 0,
    hintCanStart: true,
  };
}

function formatDue(dueDate: string): string {
  const m = dueDate.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dueDate;
  return `${m[3]}/${m[2]}`;
}

export function OperatorView() {
  const sectors = useGraphStore((s) => s.sectors);
  const orders = useOrdersStore((s) => s.orders);
  const setProgress = useOrdersStore((s) => s.setProgress);
  const registerPause = useOrdersStore((s) => s.registerPause);
  const log = useOrdersStore((s) => s.log);
  const pauses = useOrdersStore((s) => s.pauses);

  const filters = useUiStore((s) => s.filters);
  const lens = useUiStore((s) => s.operatorLens);
  const user = useSessionStore((s) => s.user);
  const openOrder = useUiStore((s) => s.openOrder);
  const pushToast = useUiStore((s) => s.pushToast);

  const [pauseOrderId, setPauseOrderId] = useState<string | null>(null);
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState('');

  const visible = useMemo(() => {
    const list = orders
      .filter((o) => !isOrderDone(o, FINAL_SECTOR_ID))
      .map((o) => {
        const slice = resolveActive(o, sectors);
        return slice ? { order: o, slice } : null;
      })
      .filter((x): x is { order: Order; slice: ActiveSlice } => x !== null)
      .filter(({ slice }) => ACTIVE.has(slice.status));

    const lockedSector = user?.role === 'operator' ? user.sectorId : lens?.sectorId ?? null;
    const filtered = lockedSector
      ? list.filter(({ slice }) => slice.sector.id === lockedSector)
      : list;

    return filtered.sort((a, b) => {
      const sr = STATUS_RANK[a.slice.status] - STATUS_RANK[b.slice.status];
      if (sr !== 0) return sr;
      return Number(b.order.urgent) - Number(a.order.urgent);
    });
  }, [orders, sectors, filters.sectorId, user, lens]);

  const counts = useMemo(() => {
    const c = { wait: 0, run: 0, pause: 0 };
    for (const { slice } of visible) {
      if (slice.status === 'wait') c.wait += 1;
      if (slice.status === 'run') c.run += 1;
      if (slice.status === 'pause') c.pause += 1;
    }
    return c;
  }, [visible]);

  const stationId = user?.role === 'operator' ? user.sectorId : lens?.sectorId ?? null;
  const focusSector = stationId ? sectors.find((s) => s.id === stationId) : null;
  const sectorIndex = focusSector
    ? sectors.findIndex((s) => s.id === focusSector.id)
    : 0;
  const opName =
    user?.role === 'operator'
      ? user.name
      : lens?.name ?? OPERATORS[Math.max(0, sectorIndex)] ?? 'Operador';

  const pauseTarget = pauseOrderId
    ? visible.find((v) => v.order.id === pauseOrderId)
    : undefined;

  const confirmPause = () => {
    if (!pauseTarget || !reason) {
      pushToast('Escolha o motivo da pausa');
      return;
    }
    const { order, slice } = pauseTarget;
    const by = `${opName} · ${slice.sector.name}`;
    const at = new Date().toISOString();
    setProgress(order.id, slice.sector.id, { status: 'pause' });
    registerPause({
      orderId: order.id,
      sectorId: slice.sector.id,
      reason,
      note: note.trim() || undefined,
      by,
      at,
    });
    log(`Pausa: ${order.id} · ${reason}`);
    pushToast('Pausa registrada. A gerência foi avisada.');
    setPauseOrderId(null);
    setReason('');
    setNote('');
  };

  const onResume = (order: Order, sectorId: string) => {
    setProgress(order.id, sectorId, { status: 'run' });
    log(`Retomada: ${order.id}`);
    pushToast('Ordem retomada');
  };

  const onFinish = (order: Order, sectorId: string) => {
    setProgress(order.id, sectorId, { status: 'done', progress: 100 });
    log(`Finalizada: ${order.id} · ${sectorId}`);
    pushToast('Setor finalizado');
  };

  const latestPauseReason = (orderId: string, sectorId: string) => {
    const p = pauses.find(
      (x) => x.orderId === orderId && x.sectorId === sectorId,
    );
    return p?.reason;
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h2>Olá, {opName}</h2>
          <div className={styles.headSub}>
            {focusSector
              ? `Setor ${focusSector.name}`
              : 'Todas as ordens ativas'}
          </div>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <b>{counts.wait}</b>
            Para iniciar
          </div>
          <div className={styles.stat}>
            <b>{counts.run}</b>
            Em andamento
          </div>
          <div className={styles.stat}>
            <b>{counts.pause}</b>
            Pausadas
          </div>
        </div>
      </header>

      {visible.length === 0 ? (
        <div className={styles.empty}>
          Nenhuma ordem neste setor agora. Novas ordens aparecem aqui assim que
          chegarem.
        </div>
      ) : (
        visible.map(({ order, slice }) => {
          const { status, progress, sector, hintCanStart } = slice;
          const pauseReason = latestPauseReason(order.id, sector.id);

          return (
            <article
              key={order.id}
              className={`opcard ${styles.card}`}
              data-s={status}
            >
              <div className={styles.cardTop}>
                <Pill data-s={status}>
                  {hintCanStart && status === 'wait'
                    ? 'Pode iniciar'
                    : STATUS_LABELS[status]}
                </Pill>
                {order.urgent ? (
                  <span className={styles.urg}>Urgente</span>
                ) : null}
              </div>

              <h3>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 0,
                    padding: 0,
                    font: 'inherit',
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onClick={() => openOrder(order.id)}
                >
                  {order.product} ×{order.quantity}
                </button>
              </h3>

              <dl className={styles.kv}>
                <dt>OP</dt>
                <dd>{order.id}</dd>
                <dt>Pedido</dt>
                <dd>
                  {order.orderCode} · {order.client}
                </dd>
                <dt>Lote</dt>
                <dd>{order.batch}</dd>
                <dt>Prazo</dt>
                <dd>{formatDue(order.dueDate)}</dd>
              </dl>

              <p className={styles.sectorHint}>
                Setor: <b>{sector.name}</b>
                {hintCanStart && status === 'wait' ? (
                  <span className={styles.canStart}> · pode iniciar</span>
                ) : null}
              </p>

              {status === 'stop' ? (
                <div className={styles.reason}>
                  Interrompida pela gerência
                  {pauseReason ? `: ${pauseReason}` : ''}. Aguarde a liberação.
                </div>
              ) : null}
              {status === 'pause' && pauseReason ? (
                <div className={`${styles.reason} ${styles.reasonPause}`}>
                  Pausada: {pauseReason}
                </div>
              ) : null}

              <div className={styles.barWrap}>
                <ProgressBar data-s={status} progress={progress} />
              </div>

              <div className={styles.actions}>
                <Button
                  className={`${styles.bigBtn} ${styles.pauseBtn}`}
                  disabled={status !== 'run' && status !== 'wait'}
                  onClick={() => {
                    setPauseOrderId(order.id);
                    setReason('');
                    setNote('');
                  }}
                >
                  Pausar
                </Button>
                <Button
                  className={`${styles.bigBtn} ${styles.resumeBtn}`}
                  disabled={status !== 'pause'}
                  onClick={() => onResume(order, sector.id)}
                >
                  Retomar
                </Button>
                <Button
                  className={`${styles.bigBtn} ${styles.finishBtn}`}
                  disabled={status !== 'run'}
                  onClick={() => onFinish(order, sector.id)}
                >
                  Finalizar
                </Button>
              </div>
            </article>
          );
        })
      )}

      <Modal
        open={!!pauseTarget}
        title="Registrar pausa"
        onClose={() => setPauseOrderId(null)}
      >
        {pauseTarget ? (
          <>
            <p style={{ color: 'var(--muted)', margin: 0 }}>
              {pauseTarget.order.id} · {pauseTarget.order.product} ·{' '}
              {pauseTarget.order.orderCode}
            </p>
            <div className={styles.reasons} role="radiogroup" aria-label="Motivo">
              {REASONS.map((r) => (
                <label key={r} className={styles.reasonLabel}>
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
            <label className={styles.noteField}>
              Observação (opcional)
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: faltam 4 espumas D33"
              />
            </label>
            <div className={styles.modalActions}>
              <Button variant="ghost" onClick={() => setPauseOrderId(null)}>
                Cancelar
              </Button>
              <Button variant="brand" onClick={confirmPause}>
                Registrar pausa
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
