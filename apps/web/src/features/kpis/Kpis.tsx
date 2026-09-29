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
  const statuses = useUiStore((s) => s.filters.statuses);
  const toggleStatus = useUiStore((s) => s.toggleStatus);
  const counts = selectKpiCounts(orders);
  const bottleneckId = computeBottlenecks(orders, sectors);
  const bottleneck = sectors.find((s) => s.id === bottleneckId);

  return (
    <>
    <section className={styles.kpis} aria-label="Indicadores por status">
      {STATUSES.map((k: Status) => (
        <button
          key={k}
          type="button"
          className={`${styles.kpi} kpi`}
          data-s={k}
          aria-pressed={statuses.includes(k)}
          onClick={() => toggleStatus(k)}
        >
          <b>{counts[k]}</b>
          <span>{STATUS_LABELS[k]}</span>
        </button>
      ))}
    </section>
    {bottleneck ? (
      <p className={styles.bottleneck}>
        Gargalo agora: {bottleneck.icon} {bottleneck.name}
      </p>
    ) : null}
    </>
  );
}
