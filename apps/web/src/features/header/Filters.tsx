import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/SegmentedControl';
import { LOTES } from '@/mocks/catalog';
import { useUiStore, type BoardLayout, type UiView } from '@/store/useUiStore';
import styles from './Header.module.css';

const VIEW_OPTIONS = [
  { value: 'board', label: 'Fluxo' },
  { value: 'list', label: 'Lista' },
  { value: 'diag', label: 'Diagrama' },
];

const BOARD_LAYOUT_OPTIONS = [
  { value: 'focus', label: 'Foco' },
  { value: 'strip', label: 'Trilho' },
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

  const clearFilters = () => {
    setQuery('');
    setBatch('');
    setUrgentOnly(false);
    setSector(null);
    for (const st of [...filters.statuses]) toggleStatus(st);
  };

  return (
    <section className={styles.filters} aria-label="Filtros">
      <input
        type="search"
        placeholder="Buscar produto, OP ou lote"
        aria-label="Buscar"
        value={filters.query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        aria-label="Lote"
        value={filters.batch}
        onChange={(e) => setBatch(e.target.value)}
      >
        <option value="">Todos os lotes</option>
        {LOTES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <label className={styles.chk}>
        <input
          type="checkbox"
          checked={filters.urgentOnly}
          onChange={(e) => setUrgentOnly(e.target.checked)}
        />
        Somente urgentes
      </label>
      <SegmentedControl
        aria-label="Visualização"
        options={VIEW_OPTIONS}
        value={view}
        onChange={(v) => setView(v as UiView)}
      />
      {view === 'board' ? (
        <SegmentedControl
          aria-label="Modo do fluxo"
          options={BOARD_LAYOUT_OPTIONS}
          value={boardLayout}
          onChange={(v) => setBoardLayout(v as BoardLayout)}
        />
      ) : null}
      <Button variant="ghost" onClick={clearFilters}>
        Limpar filtros
      </Button>
      <span className={styles.spacer} />
    </section>
  );
}
