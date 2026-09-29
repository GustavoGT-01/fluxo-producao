import { STATUS_LABELS, FINAL_SECTOR_ID, topoSort } from '@/domain';
import type { Order, Pause, Sector, SectorProgress, Status } from '@/domain/types';
import { Pill } from '@/components/Pill';
import { selectFilteredOrders } from '@/store/selectors';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useUiStore } from '@/store/useUiStore';
import styles from './OrdersTable.module.css';

const PRIMARY: Status[] = ['stop', 'pause', 'run', 'wait', 'done'];
const ACTIVE: ReadonlySet<Status> = new Set(['run', 'wait', 'pause', 'stop']);

/** Siglas da lista do protótipo HTML (sem Finalizado). */
const SECTOR_ABBR: Record<string, string> = {
  cnc: 'CNC',
  metalurgica: 'MET',
  laminacao: 'LAM',
  marcenaria: 'MAR',
  espumacao: 'ESP',
  preparacao: 'PRE',
  tapecaria: 'TAP',
  corte: 'COR',
  costura: 'COS',
  embalagem: 'EMB',
  cq: 'CQ',
  finalizado: 'FIN',
};

function primaryStatus(order: Order): Status {
  const present = new Set(
    Object.values(order.progressBySector).map((p) => p.status),
  );
  for (const s of PRIMARY) {
    if (present.has(s)) return s;
  }
  return 'wait';
}

function sectorAbbr(sector: Sector): string {
  return SECTOR_ABBR[sector.id] ?? sector.name.slice(0, 3).toUpperCase();
}

function listSectors(sectors: Sector[]): Sector[] {
  let ordered: Sector[];
  try {
    const ids = topoSort(sectors);
    const byId = new Map(sectors.map((s) => [s.id, s]));
    ordered = ids.map((id) => byId.get(id)!).filter(Boolean);
  } catch {
    ordered = [...sectors];
  }
  return ordered.filter((s) => s.id !== FINAL_SECTOR_ID);
}

function formatDue(due: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(due);
  if (iso) return `${iso[3]}/${iso[2]}`;
  const slash = /^(\d{2})\/(\d{2})/.exec(due);
  if (slash) return `${slash[1]}/${slash[2]}`;
  return due;
}

function formatClock(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function currentSector(order: Order, sectors: Sector[]): Sector | null {
  for (const sector of sectors) {
    const p = order.progressBySector[sector.id];
    if (p && ACTIVE.has(p.status)) return sector;
  }
  const done = [...sectors].reverse().find(
    (s) => order.progressBySector[s.id]?.status === 'done',
  );
  return done ?? null;
}

function pauseFor(
  pauses: Pause[],
  orderId: string,
  sectorId: string,
): Pause | undefined {
  return pauses
    .filter((p) => p.orderId === orderId && p.sectorId === sectorId)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
}

function chipTitle(
  sector: Sector,
  abbr: string,
  prog: SectorProgress | undefined,
  pause: Pause | undefined,
): string {
  const base = `${abbr} · ${sector.name}`;
  if (!prog) return `${base} — ainda não iniciado`;
  if (prog.status === 'done') {
    const start = formatClock(prog.startedAt);
    const end = formatClock(prog.finishedAt);
    const rng = start && end ? ` · ${start}–${end}` : start ? ` · desde ${start}` : '';
    return `${base} — concluído${rng}`;
  }
  if (prog.status === 'run') {
    const start = formatClock(prog.startedAt);
    return `${base} — em produção${start ? ` desde ${start}` : ''}`;
  }
  if (prog.status === 'wait') return `${base} — aguardando início`;
  if (prog.status === 'pause') {
    const reason = pause?.reason ?? '—';
    const by = pause?.by ?? '—';
    return `${base} — pausada · motivo: ${reason} · por ${by}`;
  }
  if (prog.status === 'stop') {
    const reason = pause?.reason ?? '—';
    const by = pause?.by ?? '—';
    return `${base} — interrompida · motivo: ${reason} · por ${by}`;
  }
  return base;
}

function SectorChip({
  sector,
  prog,
  pause,
}: {
  sector: Sector;
  prog: SectorProgress | undefined;
  pause: Pause | undefined;
}) {
  const abbr = sectorAbbr(sector);
  const title = chipTitle(sector, abbr, prog, pause);

  if (!prog) {
    return (
      <span className="sc" title={title}>
        {abbr}
      </span>
    );
  }

  if (prog.status === 'done') {
    return (
      <span className="sc done" style={{ ['--col' as string]: sector.color }} title={title}>
        {abbr}
      </span>
    );
  }

  if (ACTIVE.has(prog.status)) {
    const badge =
      prog.status === 'pause' ? (
        <span className="bd">⏸</span>
      ) : prog.status === 'stop' ? (
        <span className="bd">⛔</span>
      ) : null;
    return (
      <span
        className={`sc cur ${prog.status}`}
        style={{ ['--col' as string]: sector.color }}
        title={title}
      >
        {abbr}
        {badge}
      </span>
    );
  }

  return (
    <span className="sc" title={title}>
      {abbr}
    </span>
  );
}

export function OrdersTable() {
  const orders = useOrdersStore((s) => s.orders);
  const pauses = useOrdersStore((s) => s.pauses);
  const sectors = useGraphStore((s) => s.sectors);
  const filters = useUiStore((s) => s.filters);
  const openOrder = useUiStore((s) => s.openOrder);
  const rows = selectFilteredOrders(orders, filters, sectors);
  const chips = listSectors(sectors);
  const colSpan = 8 + chips.length;

  return (
    <div className={`${styles.tbl} tbl`}>
      <div className={styles.slegend}>
        {chips.map((sector) => (
          <span key={sector.id}>
            <b style={{ background: sector.color }}>{sectorAbbr(sector)}</b>
            {sector.name}
          </span>
        ))}
        <span className={styles.hint}>
          Passe o mouse sobre uma sigla para ver horário e motivo · clique na linha para o
          histórico completo
        </span>
      </div>
      <table className={styles.wide}>
        <thead>
          <tr>
            <th>OP</th>
            <th>Pedido</th>
            <th>Produto</th>
            <th>Cliente</th>
            <th>Lote</th>
            {chips.map((sector) => (
              <th key={sector.id} className={styles.scH}>
                {sectorAbbr(sector)}
              </th>
            ))}
            <th>Status</th>
            <th>Etapa atual</th>
            <th>Prazo</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan}>
                <div className={styles.empty}>
                  Nenhuma ordem encontrada. Limpe os filtros para ver todas.
                </div>
              </td>
            </tr>
          ) : (
            rows.map((order) => {
              const st = primaryStatus(order);
              const cur = currentSector(order, chips);
              return (
                <tr
                  key={order.id}
                  className={styles.row}
                  data-s={st}
                  onClick={() => openOrder(order.id)}
                >
                  <td>
                    <b>{order.id}</b>
                    {order.urgent ? (
                      <>
                        {' '}
                        <span className="urg">●</span>
                      </>
                    ) : null}
                  </td>
                  <td className={styles.mono}>{order.orderCode}</td>
                  <td>
                    {order.product} ×{order.quantity}
                  </td>
                  <td>{order.client}</td>
                  <td className={styles.mono}>{order.batch}</td>
                  {chips.map((sector) => (
                    <td key={sector.id} className={styles.scC}>
                      <SectorChip
                        sector={sector}
                        prog={order.progressBySector[sector.id]}
                        pause={pauseFor(pauses, order.id, sector.id)}
                      />
                    </td>
                  ))}
                  <td>
                    <Pill data-s={st} className="pill">
                      {STATUS_LABELS[st]}
                    </Pill>
                  </td>
                  <td className={styles.mono}>
                    {cur ? `${cur.icon} ${cur.name}` : '—'}
                  </td>
                  <td className={styles.mono}>{formatDue(order.dueDate)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
