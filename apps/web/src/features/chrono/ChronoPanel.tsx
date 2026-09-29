import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Drawer } from '@/components/Drawer';
import {
  ApiError,
  estimateChrono,
  fetchChronoSummary,
  type ChronoEstimate,
  type ChronoSummaryRow,
} from '@/services/api';
import { useGraphStore } from '@/store/useGraphStore';
import styles from './Chrono.module.css';

function formatMin(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const min = ms / 60_000;
  if (min < 10) return `${min.toFixed(1)} min`;
  return `${Math.round(min)} min`;
}

export function ChronoPanel() {
  const sectors = useGraphStore((s) => s.sectors);
  const sectorName = useMemo(
    () => new Map(sectors.map((s) => [s.id, `${s.icon} ${s.name}`])),
    [sectors],
  );

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ChronoSummaryRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('4');
  const [estimate, setEstimate] = useState<ChronoEstimate | null>(null);

  const load = async () => {
    const data = await fetchChronoSummary();
    setRows(data.summary);
  };

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setError('');
      setEstimate(null);
      void load().catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Falha ao carregar cronoanálise');
      });
    };
    window.addEventListener('fluxo:open-chrono', onOpen);
    return () => window.removeEventListener('fluxo:open-chrono', onOpen);
  }, []);

  const products = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (!seen.has(row.productKey)) seen.set(row.productKey, row.product);
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [rows]);

  useEffect(() => {
    if (!product && products[0]) setProduct(products[0].label);
  }, [product, products]);

  const runEstimate = async () => {
    setError('');
    setBusy(true);
    try {
      const qty = Math.max(1, Math.floor(Number(quantity) || 1));
      const data = await estimateChrono(product.trim(), qty);
      setEstimate(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao estimar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} title="Cronoanálise" onClose={() => setOpen(false)}>
      <p className={styles.muted}>
        Tempo ativo por produto e setor. Base para planejamento futuro.
      </p>

      {error ? <p className={`alert ${styles.error}`}>{error}</p> : null}

      <div className={styles.tableWrap}>
        {rows.length === 0 ? (
          <p className={styles.empty}>
            Sem amostras ainda. Conclua setores em operação real para acumular tempos.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Setor</th>
                <th>n</th>
                <th>Mediana</th>
                <th>Min/unid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.productKey}:${row.sectorId}`}>
                  <td>{row.product}</td>
                  <td>{sectorName.get(row.sectorId) ?? row.sectorId}</td>
                  <td>{row.n}</td>
                  <td>{formatMin(row.medianActiveMs)}</td>
                  <td>{formatMin(row.medianActiveMsPerUnit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.estimate}>
        <h4>Estimar lead time</h4>
        <div className={styles.form}>
          <label className={styles.label}>
            Produto
            <input
              className={styles.input}
              list="chrono-products"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            />
            <datalist id="chrono-products">
              {products.map((p) => (
                <option key={p.key} value={p.label} />
              ))}
            </datalist>
          </label>
          <label className={styles.label}>
            Qtd
            <input
              className={styles.input}
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <Button variant="brand" disabled={busy || !product.trim()} onClick={() => void runEstimate()}>
            Estimar
          </Button>
        </div>

        {estimate ? (
          <ul className={styles.result}>
            {estimate.sectors
              .filter((s) => s.estimatedMs > 0 || s.sampleCount > 0)
              .map((s) => (
                <li key={s.sectorId}>
                  <span>{sectorName.get(s.sectorId) ?? s.sectorId}</span>
                  <b>{formatMin(s.estimatedMs)}</b>
                  <em>{s.sampleCount} amost.</em>
                </li>
              ))}
            <li className={styles.total}>
              <span>Total (DAG)</span>
              <b>{formatMin(estimate.totalMs)}</b>
            </li>
          </ul>
        ) : null}
      </div>
    </Drawer>
  );
}
