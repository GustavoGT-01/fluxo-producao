import { useEffect, useState } from 'react';
import { STATUSES, STATUS_LABELS, computeBottlenecks } from '@/domain';
import type { Status } from '@/domain/types';
import { fetchChronoSummary } from '@/services/api';
import { isPresentation } from '@/services/presentation';
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
  const role = useUiStore((s) => s.role);
  const [pace, setPace] = useState<Record<string, number> | undefined>(undefined);
  useEffect(() => {
    if (isPresentation() || role !== 'manager') return;
    let cancel = false;
    void fetchChronoSummary()
      .then(({ summary }) => {
        if (cancel) return;
        const grouped = new Map<string, number[]>();
        for (const row of summary) {
          const list = grouped.get(row.sectorId) ?? [];
          list.push(row.medianActiveMs);
          grouped.set(row.sectorId, list);
        }
        const next: Record<string, number> = {};
        for (const [id, values] of grouped) {
          const sorted = [...values].sort((a, b) => a - b);
          next[id] = sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
        }
        setPace(Object.keys(next).length > 0 ? next : undefined);
      })
      .catch(() => {
        if (!cancel) setPace(undefined);
      });
    return () => {
      cancel = true;
    };
  }, [role]);
  const bottleneckId = computeBottlenecks(orders, sectors, pace);
  const timed = Boolean(pace && Object.values(pace).some((ms) => ms > 0));
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
          {timed ? ' · o tempo medido pesa junto com a fila' : ''}
        </p>
      ) : null}
    </>
  );
}
