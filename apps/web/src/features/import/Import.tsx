import { useState } from 'react';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { ApiError, api, fetchBootstrap } from '@/services/api';
import { applyRemote } from '@/services/authState';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useUiStore } from '@/store/useUiStore';
import styles from './Import.module.css';

interface PreviewOrder {
  id: string;
  product: string;
  quantity: number;
  batch: string;
  dueDate: string;
  urgent: boolean;
}

interface PreviewResult {
  filename: string;
  orders: PreviewOrder[];
  errors: Array<{ row: number; message: string }>;
  committed: boolean;
  count?: number;
}

async function upload(file: File, confirm: boolean): Promise<PreviewResult> {
  const body = new FormData();
  body.append('file', file);
  const query = confirm ? '?confirm=1' : '';
  return api<PreviewResult>(`/api/batches/import${query}`, { method: 'POST', body });
}

export function Import() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const pushToast = useUiStore((s) => s.pushToast);

  const close = () => {
    setOpen(false);
    setFile(null);
    setPreview(null);
  };

  const onFile = async (next: File | null) => {
    setFile(next);
    setPreview(null);
    if (!next) return;
    setBusy(true);
    try {
      setPreview(await upload(next, false));
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : 'Falha ao ler a planilha');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!file || !preview || preview.errors.length > 0 || preview.orders.length === 0) return;
    setBusy(true);
    try {
      const result = await upload(file, true);
      const boot = await fetchBootstrap();
      applyRemote(() => {
        useOrdersStore.setState({ orders: boot.orders, pauses: boot.pauses, feed: boot.feed });
      });
      pushToast(`${result.count ?? preview.orders.length} ordens importadas`);
      close();
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : 'Falha ao importar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <Button variant="brand" onClick={() => setOpen(true)}>
        ＋ Importar planejamento
      </Button>
      <Modal open={open} title="Importar planejamento em lote" onClose={close}>
        <p className={styles.muted}>
          Planilha .csv ou .xlsx. Colunas: produto, quantidade, lote, cliente, pedido, urgente, prazo.
        </p>
        <label className={styles.drop}>
          <span className={styles.fileIcon} aria-hidden>
            📄
          </span>
          <div>
            <b>{file ? file.name : 'Escolher arquivo'}</b>
            <div className={styles.muted}>{busy ? 'Lendo…' : 'CSV ou XLSX'}</div>
          </div>
          <input
            className={styles.file}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
          />
        </label>
        {preview && preview.errors.length > 0 ? (
          <ul>
            {preview.errors.map((item) => (
              <li key={`${item.row}-${item.message}`}>
                Linha {item.row}: {item.message}
              </li>
            ))}
          </ul>
        ) : null}
        {preview && preview.orders.length > 0 ? (
          <div className={`${styles.tbl} tbl`}>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qtd.</th>
                  <th>Prazo</th>
                  <th>Lote</th>
                </tr>
              </thead>
              <tbody>
                {preview.orders.map((row) => (
                  <tr key={row.id}>
                    <td>{row.product}</td>
                    <td>{row.quantity}</td>
                    <td>{row.dueDate}</td>
                    <td>{row.batch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className={styles.actions}>
          <Button onClick={close}>Cancelar</Button>
          <Button
            variant="brand"
            disabled={busy || !preview || preview.errors.length > 0 || preview.orders.length === 0}
            onClick={() => void confirm()}
          >
            Importar {preview?.orders.length ?? 0} ordens
          </Button>
        </div>
      </Modal>
    </div>
  );
}
