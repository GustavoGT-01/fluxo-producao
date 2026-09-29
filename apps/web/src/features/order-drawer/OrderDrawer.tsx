import { useState } from 'react';
import { Button } from '@/components/Button';
import { Drawer } from '@/components/Drawer';
import { Pill } from '@/components/Pill';
import { STATUS_LABELS, topoSort } from '@/domain';
import type { Order, Sector, Status } from '@/domain/types';
import { REASONS } from '@/mocks/catalog';
import { selectOpenOrder } from '@/store/selectors';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useUiStore } from '@/store/useUiStore';
import styles from './OrderDrawer.module.css';

const ACTIVE: Status[] = ['run', 'stop', 'pause', 'wait'];
const PRIMARY: Status[] = ['run', 'stop', 'pause', 'wait', 'done'];

function primaryStatus(order: Order): Status {
  const present = new Set(
    Object.values(order.progressBySector).map((p) => p.status),
  );
  for (const s of PRIMARY) {
    if (present.has(s)) return s;
  }
  return 'wait';
}

function activeProgress(order: Order) {
  const vals = Object.values(order.progressBySector);
  for (const prefer of ACTIVE) {
    const hit = vals.find((p) => p.status === prefer);
    if (hit) return hit;
  }
  return null;
}

function sortedSectors(sectors: Sector[]): Sector[] {
  try {
    const ids = topoSort(sectors);
    const byId = new Map(sectors.map((s) => [s.id, s]));
    return ids.map((id) => byId.get(id)!).filter(Boolean);
  } catch {
    return sectors;
  }
}

function nowTime(): string {
  return new Date().toISOString().slice(11, 16);
}

export function OrderDrawer() {
  const openOrderId = useUiStore((s) => s.openOrderId);
  const closeOrder = useUiStore((s) => s.closeOrder);
  const role = useUiStore((s) => s.role);
  const pushToast = useUiStore((s) => s.pushToast);
  const orders = useOrdersStore((s) => s.orders);
  const setProgress = useOrdersStore((s) => s.setProgress);
  const registerPause = useOrdersStore((s) => s.registerPause);
  const log = useOrdersStore((s) => s.log);
  const sectors = useGraphStore((s) => s.sectors);
  const order = selectOpenOrder(orders, openOrderId);

  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState<string>(REASONS[0]);
  const [stopOpen, setStopOpen] = useState(false);
  const [stopReason, setStopReason] = useState<string>(REASONS[0]);

  const open = order != null;
  const st = order ? primaryStatus(order) : 'wait';
  const active = order ? activeProgress(order) : null;
  const ordered = sortedSectors(sectors);
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));

  const onClose = () => {
    setPauseOpen(false);
    setStopOpen(false);
    closeOrder();
  };

  const doPause = () => {
    if (!order || !active) return;
    setProgress(order.id, active.sectorId, { status: 'pause' });
    registerPause({
      orderId: order.id,
      sectorId: active.sectorId,
      reason: pauseReason,
      by: 'Gerência',
      at: nowTime(),
    });
    log(`${order.id} pausada em ${sectorMap.get(active.sectorId)?.name ?? active.sectorId}: ${pauseReason}`);
    pushToast('Ordem pausada');
    setPauseOpen(false);
  };

  const doStop = () => {
    if (!order || !active) return;
    setProgress(order.id, active.sectorId, { status: 'stop' });
    registerPause({
      orderId: order.id,
      sectorId: active.sectorId,
      reason: `Interrompida: ${stopReason}`,
      by: 'Gerência',
      at: nowTime(),
      status: 'stop',
    });
    log(`${order.id} interrompida: ${stopReason}`);
    pushToast('Ordem interrompida');
    setStopOpen(false);
  };

  const doResume = () => {
    if (!order || !active) return;
    setProgress(order.id, active.sectorId, { status: 'run' });
    log(`${order.id} retomada em ${sectorMap.get(active.sectorId)?.name ?? active.sectorId}`);
    pushToast('Ordem retomada');
  };

  const doFinish = () => {
    if (!order || !active) return;
    setProgress(order.id, active.sectorId, { status: 'done', progress: 100 });
    log(
      `${order.id} setor ${sectorMap.get(active.sectorId)?.name ?? active.sectorId} finalizado`,
    );
    pushToast('Setor finalizado');
  };

  const title = order?.product ?? 'Ordem';

  return (
    <Drawer open={open} title={title} onClose={onClose}>
      {order ? (
        <>
          <div className={styles.headRow}>
            <Pill data-s={st} className="pill">
              {STATUS_LABELS[st]}
            </Pill>
            {order.urgent ? <span className="urg">Urgente</span> : null}
          </div>
          <p className={styles.sub}>
            {order.id} · {order.batch} · {order.quantity} unidades
          </p>
          <div className={styles.meta}>
            <div>
              Setor atual
              <b>
                {active
                  ? `${sectorMap.get(active.sectorId)?.icon ?? ''} ${sectorMap.get(active.sectorId)?.name ?? active.sectorId}`
                  : '—'}
              </b>
            </div>
            <div>
              Prazo de entrega
              <b>{order.dueDate}</b>
            </div>
            <div>
              Pedido
              <b>{order.orderCode}</b>
            </div>
            <div>
              Cliente
              <b>{order.client}</b>
            </div>
            <div>
              Progresso no setor
              <b>{active ? `${Math.round(active.progress)}%` : '—'}</b>
            </div>
            <div>
              Lote
              <b>{order.batch}</b>
            </div>
          </div>

          {role === 'manager' && st !== 'done' ? (
            <>
              <div className={styles.actions}>
                {st === 'run' || st === 'wait' ? (
                  <Button onClick={() => setPauseOpen(true)}>⏸ Pausar</Button>
                ) : null}
                {st === 'pause' || st === 'stop' || st === 'wait' ? (
                  <Button variant="brand" onClick={doResume}>
                    ▶ {st === 'wait' ? 'Iniciar agora' : 'Retomar'}
                  </Button>
                ) : null}
                {st !== 'stop' ? (
                  <Button variant="danger" onClick={() => setStopOpen(true)}>
                    ⛔ Interromper
                  </Button>
                ) : null}
                {active ? (
                  <Button onClick={doFinish}>✔ Finalizar setor</Button>
                ) : null}
              </div>

              {pauseOpen ? (
                <div className={styles.reason}>
                  <select
                    aria-label="Motivo da pausa"
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <Button variant="danger" onClick={doPause}>
                    Confirmar pausa
                  </Button>
                  <Button onClick={() => setPauseOpen(false)}>Cancelar</Button>
                </div>
              ) : null}

              {stopOpen ? (
                <div className={styles.reason}>
                  <select
                    aria-label="Motivo da interrupção"
                    value={stopReason}
                    onChange={(e) => setStopReason(e.target.value)}
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <Button variant="danger" onClick={doStop}>
                    Confirmar interrupção
                  </Button>
                  <Button onClick={() => setStopOpen(false)}>Cancelar</Button>
                </div>
              ) : null}
            </>
          ) : null}

          <ul className={styles.tl}>
            {ordered.map((sec) => {
              const prog = order.progressBySector[sec.id];
              const status = prog?.status;
              const isDone = status === 'done';
              const isCur = Boolean(active && active.sectorId === sec.id);
              const cls = [
                isDone ? styles.done : '',
                isCur ? styles.cur : '',
              ]
                .filter(Boolean)
                .join(' ');
              let sub = 'Aguardando etapa anterior';
              if (isDone) sub = 'Concluído';
              else if (isCur && prog)
                sub = `${STATUS_LABELS[prog.status]} · ${Math.floor(prog.progress)}%`;

              return (
                <li
                  key={sec.id}
                  className={cls}
                  data-s={isCur ? st : undefined}
                >
                  <i>{isDone ? '✓' : ''}</i>
                  {sec.icon} {sec.name}
                  <small>{sub}</small>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </Drawer>
  );
}
