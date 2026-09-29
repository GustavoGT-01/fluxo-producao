import * as XLSX from 'xlsx';
import type { OrderRecord, ProgressStatus } from './db';

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ParsedImport {
  orders: OrderRecord[];
  errors: ImportRowError[];
}

const HEADER: Record<string, keyof RawRow> = {
  produto: 'product',
  product: 'product',
  quantidade: 'quantity',
  qtd: 'quantity',
  quantity: 'quantity',
  lote: 'batch',
  batch: 'batch',
  cliente: 'client',
  client: 'client',
  pedido: 'orderCode',
  ordercode: 'orderCode',
  urgente: 'urgent',
  urgent: 'urgent',
  prioridade: 'urgent',
  prazo: 'dueDate',
  duedate: 'dueDate',
};

interface RawRow {
  product: string;
  quantity: string;
  batch: string;
  client: string;
  orderCode: string;
  urgent: string;
  dueDate: string;
}

function normKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function sheetRows(buffer: Buffer, filename: string): Array<Record<string, unknown>> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const wb = XLSX.read(text, { type: 'string' });
    const sheet = wb.Sheets[wb.SheetNames[0] ?? ''];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  }
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ''];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
}

function mapRow(input: Record<string, unknown>): RawRow {
  const out: RawRow = {
    product: '',
    quantity: '',
    batch: '',
    client: '',
    orderCode: '',
    urgent: '',
    dueDate: '',
  };
  for (const [key, value] of Object.entries(input)) {
    const field = HEADER[normKey(key)];
    if (!field) continue;
    out[field] = String(value ?? '').trim();
  }
  return out;
}

function parseDue(value: string): string | null {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return value;
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

export function parsePlanilha(buffer: Buffer, filename: string): ParsedImport {
  const table = sheetRows(buffer, filename);
  const orders: OrderRecord[] = [];
  const errors: ImportRowError[] = [];
  table.forEach((raw, index) => {
    const row = index + 2;
    const mapped = mapRow(raw);
    if (!mapped.product) {
      errors.push({ row, message: 'Produto vazio' });
      return;
    }
    const quantity = Number(String(mapped.quantity).replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push({ row, message: 'Quantidade inválida' });
      return;
    }
    const dueDate = parseDue(mapped.dueDate);
    if (!dueDate) {
      errors.push({ row, message: 'Prazo inválido (use AAAA-MM-DD ou DD/MM/AAAA)' });
      return;
    }
    const urgent = ['1', 'sim', 's', 'true', 'urgente', 'alta'].includes(mapped.urgent.toLowerCase());
    const id = `OP-${Date.now().toString(36)}-${index + 1}`;
    const cellStatus: ProgressStatus = 'wait';
    orders.push({
      id,
      product: mapped.product,
      quantity: Math.round(quantity),
      batch: mapped.batch || 'SEM-LOTE',
      client: mapped.client || '—',
      orderCode: mapped.orderCode || id,
      urgent,
      dueDate,
      progressBySector: {
        cnc: { sectorId: 'cnc', status: cellStatus, progress: 0 },
      },
    });
  });
  return { orders, errors };
}
