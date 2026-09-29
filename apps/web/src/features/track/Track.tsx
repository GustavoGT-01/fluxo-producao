import { topoSort } from '@/domain';
import type { Order, Sector, Status } from '@/domain/types';
import { selectIndependentSectors, selectTrackOrders } from '@/store/selectors';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useUiStore } from '@/store/useUiStore';
import styles from './Track.module.css';

const ACTIVE: ReadonlySet<Status> = new Set(['run', 'wait', 'pause', 'stop']);

function ordersInSector(orders: Order[], sectorId: string): Order[] {
  return orders.filter((o) => {
    const p = o.progressBySector[sectorId];
    return p != null && ACTIVE.has(p.status);
  });
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

export function Track() {
  const sectors = useGraphStore((s) => s.sectors);
  const orders = useOrdersStore((s) => s.orders);
  const filters = useUiStore((s) => s.filters);
  const setSector = useUiStore((s) => s.setSector);
  const sectorId = filters.sectorId;
  const scoped = selectTrackOrders(orders, filters, sectors);
  const ordered = sortedSectors(sectors);
  const independents = selectIndependentSectors(sectors);

  return (
    <section className={`${styles.track} track`} aria-label="Linha de produção">
      <div className={styles.trackIn}>
        {ordered.map((sec, i) => {
          const list = ordersInSector(scoped, sec.id);
          const run = list.filter((o) => o.progressBySector[sec.id]?.status === 'run').length;
          const pause = list.filter((o) => o.progressBySector[sec.id]?.status === 'pause').length;
          const stop = list.filter((o) => o.progressBySector[sec.id]?.status === 'stop').length;
          const selected = sectorId === sec.id;
          const isLast = i === ordered.length - 1;
          const connMode = run > 0 ? 'flow' : pause > 0 ? 'hold' : 'idle';
          const dots = Math.min(3, run);

          const nodeClass = [
            styles.node,
            'node',
            selected ? 'sel' : '',
            run > 0 ? 'active' : '',
            stop > 0 ? 'alert' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={sec.id}
              type="button"
              className={nodeClass}
              onClick={() => setSector(selected ? null : sec.id)}
              aria-pressed={selected}
              aria-label={`${sec.name}, ${list.length} ordens${selected ? ', filtro ativo' : ''}`}
              title={
                selected
                  ? 'Clique para limpar o filtro deste setor'
                  : `Filtrar por ${sec.name}`
              }
            >
              <span className={`${styles.orb} orb`}>{sec.icon}</span>
              <b>{sec.name}</b>
              <em>{list.length}</em>
              {!isLast ? (
                <div
                  className={`${styles.conn} conn${connMode === 'idle' ? '' : ` ${connMode}`}`}
                  aria-hidden
                >
                  {Array.from({ length: dots }, (_, k) => (
                    <i
                      key={k}
                      className="dot"
                      style={{ ['--d' as string]: `-${(k * 0.75).toFixed(2)}s` }}
                    />
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className={`${styles.legend} legend`}>
        <span>
          <i className={styles.swatchFlow} />
          Fluxo ativo
        </span>
        <span>
          <i className={styles.swatchHold} />
          Somente pausadas
        </span>
        <span>
          <i className={styles.swatchAlert} />
          Setor com interrupção
        </span>
        <span>
          {independents.length} setor{independents.length === 1 ? '' : 'es'} independente
          {independents.length === 1 ? '' : 's'}
        </span>
        <span>
          {sectorId
            ? 'Setor filtrando a lista/fluxo — clique de novo para limpar'
            : 'Clique em um setor para filtrar'}
        </span>
      </div>
    </section>
  );
}
