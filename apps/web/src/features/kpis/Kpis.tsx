import { STATUSES, STATUS_LABELS, computeBottlenecks } from '@/domain';
import type { Status } from '@/domain/types';
import { selectKpiCounts } from '@/store/selectors';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useUiStore } from '@/store/useUiStore';
import styles from './Kpis.module.css';

export function Kpis() {
  const orders = useOrdersStore((s) => s.orders);
  const sectors = useGraphStore((s) => s.sectors);
  const filters = useUiStore((s) => s.filters);
  const toggleStatus = useUiStore((s) => s.toggleStatus);
  const counts = selectKpiCounts(orders, filters);
  const bottleneckId = computeBottlenecks(orders, sectors);
  const bottleneck = sectors.find((s) => s.id === bottleneckId);
  const contextOn = Boolean(
    filters.batch || filters.query.trim() || filters.urgentOnly,
  );

  return (
    <>
      <section className={styles.kpis} aria-label="Indicadores por status">
        {STATUSES.map((k: Status) => (
          <button
            key={k}
            type="button"
            className={`${styles.kpi} kpi`}
            data-s={k}
            aria-pressed={filters.statuses.includes(k)}
            title={
              filters.statuses.includes(k)
                ? `Remover filtro ${STATUS_LABELS[k]}`
                : `Filtrar por ${STATUS_LABELS[k]}`
            }
            onClick={() => toggleStatus(k)}
          >
            <b>{counts[k]}</b>
            <span>{STATUS_LABELS[k]}</span>
          </button>
        ))}
      </section>
      {contextOn ? (
        <p className={styles.contextNote}>
          Contagens refletem lote, busca e urgentes ativos
          {filters.sectorId ? ' · setor filtra o board/lista, não o KPI' : ''}
        </p>
      ) : null}
      {bottleneck ? (
        <p className={styles.bottleneck}>
          Gargalo agora: {bottleneck.icon} {bottleneck.name}
        </p>
      ) : null}
    </>
  );
}
