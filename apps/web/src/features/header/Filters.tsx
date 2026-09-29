import { useMemo } from 'react';
import { STATUS_LABELS } from '@/domain';
import type { Status } from '@/domain/types';
import { LOTES } from '@/mocks/catalog';
import {
  selectActiveFilterCount,
  selectFilteredOrders,
} from '@/store/selectors';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useUiStore, type BoardLayout, type UiView } from '@/store/useUiStore';
import { Icon, type IconName } from './icons';
import styles from './Header.module.css';

const VIEW_OPTIONS: { value: UiView; label: string; icon: IconName }[] = [
  { value: 'board', label: 'Fluxo', icon: 'kanban' },
  { value: 'list', label: 'Lista', icon: 'list' },
  { value: 'diag', label: 'Diagrama', icon: 'flow' },
];

const BOARD_LAYOUT_OPTIONS: { value: BoardLayout; label: string; icon: IconName }[] = [
  { value: 'focus', label: 'Foco', icon: 'focus' },
  { value: 'strip', label: 'Trilho', icon: 'act' },
];

export function Filters() {
  const filters = useUiStore((s) => s.filters);
  const view = useUiStore((s) => s.view);
  const boardLayout = useUiStore((s) => s.boardLayout);
  const setQuery = useUiStore((s) => s.setQuery);
  const setBatch = useUiStore((s) => s.setBatch);
  const setUrgentOnly = useUiStore((s) => s.setUrgentOnly);
  const setView = useUiStore((s) => s.setView);
  const setBoardLayout = useUiStore((s) => s.setBoardLayout);
  const setSector = useUiStore((s) => s.setSector);
  const toggleStatus = useUiStore((s) => s.toggleStatus);
  const clearFilters = useUiStore((s) => s.clearFilters);

  const orders = useOrdersStore((s) => s.orders);
  const sectors = useGraphStore((s) => s.sectors);

  const batchOptions = useMemo(() => {
    const fromData = [...new Set(orders.map((o) => o.batch).filter(Boolean))].sort();
    if (fromData.length > 0) return fromData;
    return [...LOTES];
  }, [orders]);

  const matched = selectFilteredOrders(orders, filters, sectors);
  const activeCount = selectActiveFilterCount(filters);
  const sector = filters.sectorId
    ? sectors.find((s) => s.id === filters.sectorId)
    : null;

  return (
    <>
      <div className={`${styles.row} ${styles.tools}`}>
        <div className={styles.search}>
          <Icon name="search" />
          <input
            type="search"
            placeholder="Buscar OP, pedido, produto, cliente ou lote"
            aria-label="Buscar"
            value={filters.query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className={`${styles.ctrl} ${styles.field}`}>
          <Icon name="layers" />
          <select aria-label="Lote" value={filters.batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="">Todos os lotes</option>
            {batchOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`${styles.ctrl} ${styles.urg}`}
          aria-pressed={filters.urgentOnly}
          title="Somente urgentes"
          onClick={() => setUrgentOnly(!filters.urgentOnly)}
        >
          <Icon name="flame" />
          Urgentes
        </button>
        <div className={styles.seg} role="group" aria-label="Visualização">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={view === opt.value}
              title={opt.label}
              onClick={() => setView(opt.value)}
            >
              <Icon name={opt.icon} />
              <span className={styles.lbl}>{opt.label}</span>
            </button>
          ))}
        </div>
        {view === 'board' ? (
          <div className={styles.seg} role="group" aria-label="Modo">
            {BOARD_LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={boardLayout === opt.value}
                title={opt.label}
                onClick={() => setBoardLayout(opt.value)}
              >
                <Icon name={opt.icon} />
                <span className={styles.lbl}>{opt.label}</span>
              </button>
            ))}
          </div>
        ) : null}
        <span className={styles.count}>
          <b>{matched.length}</b> de {orders.length} OP{orders.length === 1 ? '' : 's'}
          <button type="button" className={styles.info} aria-label="Dicas de filtro">
            <Icon name="info" />
            <span className={styles.tip}>
              KPI filtra por status. Clique no trilho para filtrar por setor. Os filtros se combinam (E).
            </span>
          </button>
        </span>
      </div>

      {activeCount > 0 ? (
        <div className={styles.chips} aria-label="Filtros ativos">
          {filters.query.trim() ? (
            <button
              type="button"
              className={styles.chip}
              onClick={() => setQuery('')}
              aria-label={`Remover busca ${filters.query.trim()}`}
            >
              Busca: {filters.query.trim()}
              <span aria-hidden>×</span>
            </button>
          ) : null}
          {filters.batch ? (
            <button
              type="button"
              className={styles.chip}
              onClick={() => setBatch('')}
              aria-label={`Remover lote ${filters.batch}`}
            >
              Lote: {filters.batch}
              <span aria-hidden>×</span>
            </button>
          ) : null}
          {filters.urgentOnly ? (
            <button
              type="button"
              className={styles.chip}
              onClick={() => setUrgentOnly(false)}
              aria-label="Remover filtro de urgentes"
            >
              Urgentes
              <span aria-hidden>×</span>
            </button>
          ) : null}
          {sector ? (
            <button
              type="button"
              className={styles.chip}
              onClick={() => setSector(null)}
              aria-label={`Remover setor ${sector.name}`}
            >
              {sector.icon} {sector.name}
              <span aria-hidden>×</span>
            </button>
          ) : null}
          {filters.statuses.map((st) => (
            <button
              key={st}
              type="button"
              className={styles.chip}
              data-s={st}
              onClick={() => toggleStatus(st)}
              aria-label={`Remover status ${STATUS_LABELS[st as Status] ?? st}`}
            >
              {STATUS_LABELS[st as Status] ?? st}
              <span aria-hidden>×</span>
            </button>
          ))}
          {filters.sectorId && filters.statuses.length > 0 ? (
            <span className={styles.relHint}>Status aplicado só no setor selecionado</span>
          ) : null}
          <button type="button" className={styles.clear} onClick={clearFilters}>
            Limpar filtros ({activeCount})
          </button>
        </div>
      ) : null}
    </>
  );
}
