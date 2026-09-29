import { STATUS_LABELS } from '@/domain';
import type { Order, Status } from '@/domain/types';
import { Pill } from '@/components/Pill';
import { ProgressBar } from '@/components/ProgressBar';
import { selectFilteredOrders } from '@/store/selectors';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useUiStore } from '@/store/useUiStore';
import styles from './OrdersTable.module.css';

const PRIMARY: Status[] = ['run', 'stop', 'pause', 'wait', 'done'];

function primaryStatus(order: Order): Status {
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

export function OrdersTable() {
  const orders = useOrdersStore((s) => s.orders);
  const sectors = useGraphStore((s) => s.sectors);
  const filters = useUiStore((s) => s.filters);
  const openOrder = useUiStore((s) => s.openOrder);
  const rows = selectFilteredOrders(orders, filters, sectors);

  return (
    <div className={`${styles.tbl} tbl`}>
      <table>
        <thead>
          <tr>
            <th>OP</th>
            <th>Produto</th>
            <th>Cliente</th>
            <th>Lote</th>
            <th>Status</th>
            <th>Progresso</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <div className={styles.empty}>
                  Nenhuma ordem encontrada. Limpe os filtros para ver todas.
                </div>
              </td>
            </tr>
          ) : (
            rows.map((order) => {
              const st = primaryStatus(order);
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
                  <td>
                    {order.product} ×{order.quantity}
                  </td>
                  <td>{order.client}</td>
                  <td>{order.batch}</td>
                  <td>
                    <Pill data-s={st} className="pill">
                      {STATUS_LABELS[st]}
                    </Pill>
                  </td>
                  <td className={styles.barCell}>
                    <ProgressBar progress={overallProgress(order)} data-s={st} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
