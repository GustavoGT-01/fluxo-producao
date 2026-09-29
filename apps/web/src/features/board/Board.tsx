import { useEffect, useRef } from 'react';
import { FINAL_SECTOR_ID, STATUS_LABELS, topoSort } from '@/domain';
import type { Order, Sector, Status } from '@/domain/types';
import { Pill } from '@/components/Pill';
import { ProgressBar } from '@/components/ProgressBar';
import { selectFilteredOrders } from '@/store/selectors';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useUiStore } from '@/store/useUiStore';
import styles from './Board.module.css';

const ACTIVE: ReadonlySet<Status> = new Set(['run', 'wait', 'pause', 'stop']);
const PRIMARY: Status[] = ['run', 'stop', 'pause', 'wait', 'done'];

export function primaryStatus(order: Order): Status {
  const present = new Set(
    Object.values(order.progressBySector).map((p) => p.status),
  );
  for (const s of PRIMARY) {
    if (present.has(s)) return s;
  }
  return 'wait';
}

function overallProgress(order: Order): number {
  const vals = Object.values(order.progressBySector);
  if (!vals.length) return 0;
  const active = PRIMARY.slice(0, 4)
    .map((s) => vals.find((p) => p.status === s))
    .find(Boolean);
  if (active) return active.progress;
  return vals.reduce((a, p) => a + p.progress, 0) / vals.length;
}

function orderSectorId(order: Order, sectors: Sector[]): string | null {
  for (const s of sectors) {
    const p = order.progressBySector[s.id];
    if (p && ACTIVE.has(p.status)) return s.id;
  }
  if (order.progressBySector[FINAL_SECTOR_ID]?.status === 'done') {
    return FINAL_SECTOR_ID;
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

function preferInstantScroll(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'off') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Board() {
  const orders = useOrdersStore((s) => s.orders);
  const sectors = useGraphStore((s) => s.sectors);
  const filters = useUiStore((s) => s.filters);
  const boardLayout = useUiStore((s) => s.boardLayout);
  const openOrder = useUiStore((s) => s.openOrder);
  const focusId = filters.sectorId;
  const solo = boardLayout === 'focus' && focusId != null;
  const boardFilters =
    boardLayout === 'strip' ? { ...filters, sectorId: null } : filters;
  const filtered = selectFilteredOrders(orders, boardFilters, sectors);
  const ordered = sortedSectors(sectors);
  const lastId = ordered[ordered.length - 1]?.id;
  const visible = solo ? ordered.filter((sec) => sec.id === focusId) : ordered;

  const boardRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!focusId) return;
    const root = boardRef.current;
    if (!root) return;
    const behavior: ScrollBehavior = preferInstantScroll() ? 'auto' : 'smooth';
    root.scrollIntoView({ behavior, block: 'nearest' });
    if (solo) return;
    const col = colRefs.current.get(focusId);
    col?.scrollIntoView({ behavior, inline: 'center', block: 'nearest' });
  }, [focusId, solo, boardLayout]);

  return (
    <div
      ref={boardRef}
      className={`${styles.board} board${solo ? ` ${styles.focus}` : ''}`}
      data-layout={boardLayout}
      data-focus={solo ? focusId ?? undefined : undefined}
    >
      {visible.map((sec) => {
        const list = filtered.filter((o) => orderSectorId(o, sectors) === sec.id);
        const shown =
          sec.id === lastId || sec.id === FINAL_SECTOR_ID ? list.slice(0, 6) : list;
        const selected = focusId === sec.id;

        return (
          <div
            key={sec.id}
            ref={(node) => {
              if (node) colRefs.current.set(sec.id, node);
              else colRefs.current.delete(sec.id);
            }}
            className={`${styles.col}${selected ? ` ${styles.sel}` : ''}`}
            data-sector={sec.id}
          >
            <h3>
              <span>{sec.icon}</span>
              {sec.name}
              <span className={styles.count}>{list.length}</span>
            </h3>
            <div className={styles.list}>
              {shown.length === 0 ? (
                <div className={styles.empty}>
                  Nenhuma ordem neste setor com os filtros atuais.
                </div>
              ) : (
                shown.map((order) => {
                  const st = primaryStatus(order);
                  const prog = overallProgress(order);
                  return (
                    <button
                      key={order.id}
                      type="button"
                      className={`${styles.card} card`}
                      data-s={st}
                      onClick={() => openOrder(order.id)}
                    >
                      <div className={styles.r1}>
                        <span>
                          {order.id} · {order.batch}
                        </span>
                        {order.urgent ? <span className="urg">Urgente</span> : null}
                      </div>
                      <div className={styles.nm}>
                        {order.product}{' '}
                        <span className={styles.qty}>×{order.quantity}</span>
                      </div>
                      <ProgressBar progress={prog} data-s={st} />
                      <div className={styles.r2}>
                        <Pill data-s={st} className="pill">
                          {STATUS_LABELS[st]}
                        </Pill>
                        <span>{order.client}</span>
                      </div>
                    </button>
                  );
                })
              )}
              {list.length > shown.length ? (
                <div className={styles.empty}>
                  +{list.length - shown.length} finalizadas
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
