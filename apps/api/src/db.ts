import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { normalizeProductKey } from './chrono';
import { hashSecret } from './password';
import { eachClient } from './hub';
import type { SectorRow } from './graph';

export const DEMO = {
  managerEmail: 'gerencia@fabrica.local',
  managerPassword: 'Gestao#2401',
  pins: {
    cnc: '1101',
    metalurgica: '1102',
    laminacao: '1103',
    marcenaria: '1104',
    espumacao: '1105',
    preparacao: '1106',
    tapecaria: '1107',
    corte: '1108',
    costura: '1109',
    embalagem: '1110',
    cq: '1111',
    finalizado: '1112',
  } as Record<string, string>,
};

const SECTORS: SectorRow[] = [
  { id: 'cnc', name: 'CNC', icon: '⚙️', color: '#3B82F6', deps: [], pos: { x: 40, y: 45 } },
  { id: 'metalurgica', name: 'Metalúrgica', icon: '🔩', color: '#EC4899', deps: ['cnc'], pos: { x: 290, y: 60 } },
  { id: 'laminacao', name: 'Laminação', icon: '🪵', color: '#10B981', deps: [], pos: { x: 40, y: 300 } },
  { id: 'marcenaria', name: 'Marcenaria', icon: '🪚', color: '#8B5CF6', deps: [], pos: { x: 40, y: 430 } },
  { id: 'espumacao', name: 'Espumação', icon: '🧽', color: '#14B8A6', deps: ['laminacao', 'marcenaria'], pos: { x: 290, y: 330 } },
  { id: 'preparacao', name: 'Preparação', icon: '🛠️', color: '#06B6D4', deps: ['marcenaria', 'metalurgica'], pos: { x: 540, y: 125 } },
  { id: 'tapecaria', name: 'Tapeçaria', icon: '🧵', color: '#6366F1', deps: ['preparacao', 'espumacao', 'costura'], pos: { x: 790, y: 215 } },
  { id: 'corte', name: 'Corte de tecido', icon: '✂️', color: '#F59E0B', deps: [], pos: { x: 40, y: 175 } },
  { id: 'costura', name: 'Costura', icon: '🪡', color: '#F43F5E', deps: ['corte'], pos: { x: 290, y: 190 } },
  { id: 'embalagem', name: 'Embalagem', icon: '📦', color: '#FB923C', deps: ['tapecaria'], pos: { x: 1040, y: 215 } },
  { id: 'cq', name: 'Controle de qualidade', icon: '✅', color: '#84CC16', deps: ['embalagem'], pos: { x: 1280, y: 215 } },
  { id: 'finalizado', name: 'Finalizado', icon: '🏁', color: '#22C55E', deps: ['cq'], pos: { x: 1510, y: 215 } },
];

const OPERATORS: Record<string, string> = {
  cnc: 'Carlos',
  metalurgica: 'Marina',
  laminacao: 'João',
  marcenaria: 'Fernanda',
  espumacao: 'Pedro',
  preparacao: 'Luciana',
  tapecaria: 'Rafael',
  corte: 'Aline',
  costura: 'Sônia',
  embalagem: 'Diego',
  cq: 'Paula',
  finalizado: 'Expedição',
};

export type ProgressStatus = 'run' | 'wait' | 'pause' | 'stop' | 'done';

export interface ProgressCell {
  sectorId: string;
  status: ProgressStatus;
  progress: number;
  startedAt?: string;
  finishedAt?: string;
}

export interface OrderRecord {
  id: string;
  product: string;
  quantity: number;
  batch: string;
  client: string;
  orderCode: string;
  urgent: boolean;
  dueDate: string;
  progressBySector: Record<string, ProgressCell>;
}

export interface PauseRecord {
  id: string;
  orderId: string;
  sectorId: string;
  reason: string;
  note?: string;
  by: string;
  at: string;
  state: 'new' | 'seen' | 'handled';
}

export interface FeedRecord {
  id: string;
  text: string;
  at: string;
}

export interface UserRecord {
  id: string;
  name: string;
  role: 'manager' | 'operator';
  email: string | null;
  sectorId: string | null;
  passwordHash: string | null;
  pinHash: string | null;
}

let database: DatabaseSync | null = null;

export function dbPath(): string {
  return process.env.FLUXO_DB ?? path.join(process.cwd(), 'data', 'fluxo.sqlite');
}

export function db(): DatabaseSync {
  if (database) return database;
  const file = dbPath();
  mkdirSync(path.dirname(file), { recursive: true });
  database = new DatabaseSync(file);
  database.exec('PRAGMA foreign_keys = ON');
  migrate(database);
  seedIfEmpty(database);
  return database;
}

export function closeDb(): void {
  database?.close();
  database = null;
}

function appliedVersions(conn: DatabaseSync): Set<number> {
  const rows = conn.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>;
  return new Set(rows.map((row) => row.version));
}

function markVersion(conn: DatabaseSync, version: number): void {
  conn
    .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
    .run(version, new Date().toISOString());
}

function migrate(conn: DatabaseSync): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const done = appliedVersions(conn);
  if (!done.has(1)) {
    applySchemaV1(conn);
    markVersion(conn, 1);
  }
  if (!done.has(2)) {
    const columns = conn.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === 'updated_at')) {
      conn.exec('ALTER TABLE users ADD COLUMN updated_at TEXT');
    }
    markVersion(conn, 2);
  }
}

function applySchemaV1(conn: DatabaseSync): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('manager', 'operator')),
      email TEXT UNIQUE,
      sector_id TEXT,
      password_hash TEXT,
      pin_hash TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sectors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      pos_x REAL NOT NULL,
      pos_y REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sector_deps (
      sector_id TEXT NOT NULL,
      dep_id TEXT NOT NULL,
      PRIMARY KEY (sector_id, dep_id),
      CHECK (sector_id <> dep_id)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      product TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      batch TEXT NOT NULL,
      client TEXT NOT NULL,
      order_code TEXT NOT NULL,
      urgent INTEGER NOT NULL,
      due_date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_sector_progress (
      order_id TEXT NOT NULL,
      sector_id TEXT NOT NULL,
      status TEXT NOT NULL,
      progress REAL NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      PRIMARY KEY (order_id, sector_id)
    );
    CREATE TABLE IF NOT EXISTS pauses (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      sector_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      note TEXT,
      by_name TEXT NOT NULL,
      at TEXT NOT NULL,
      state TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT NOT NULL,
      text TEXT NOT NULL,
      at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      created_at TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      actor_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sector_time_segments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      sector_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sector_time_samples (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product TEXT NOT NULL,
      product_key TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      sector_id TEXT NOT NULL,
      active_ms INTEGER NOT NULL,
      pause_ms INTEGER NOT NULL,
      wall_ms INTEGER NOT NULL,
      finished_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'live',
      UNIQUE (order_id, sector_id)
    );
    CREATE INDEX IF NOT EXISTS sector_time_segments_open
      ON sector_time_segments(order_id, sector_id, ended_at);
    CREATE INDEX IF NOT EXISTS sector_time_samples_product
      ON sector_time_samples(product_key, sector_id);
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_active ON users(email) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_operator_sector ON users(sector_id) WHERE role = 'operator' AND active = 1;
  `);
}

function seedIfEmpty(conn: DatabaseSync): void {
  const row = conn.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (row.n > 0) return;

  const insertUser = conn.prepare(
    `INSERT INTO users (id, name, role, email, sector_id, password_hash, pin_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  insertUser.run(
    'user-gerencia',
    'Gerência',
    'manager',
    DEMO.managerEmail,
    null,
    hashSecret(DEMO.managerPassword),
    null,
  );
  for (const sector of SECTORS) {
    const pin = DEMO.pins[sector.id];
    insertUser.run(
      `user-${sector.id}`,
      OPERATORS[sector.id] ?? sector.name,
      'operator',
      null,
      sector.id,
      null,
      pin ? hashSecret(pin) : null,
    );
  }

  const insertSector = conn.prepare(
    'INSERT INTO sectors (id, name, icon, color, pos_x, pos_y) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const insertDep = conn.prepare('INSERT INTO sector_deps (sector_id, dep_id) VALUES (?, ?)');
  for (const sector of SECTORS) {
    insertSector.run(sector.id, sector.name, sector.icon, sector.color, sector.pos.x, sector.pos.y);
    for (const dep of sector.deps) insertDep.run(sector.id, dep);
  }

  const samples: Array<{
    id: string;
    product: string;
    quantity: number;
    batch: string;
    client: string;
    orderCode: string;
    urgent: boolean;
    dueDate: string;
    cells: ProgressCell[];
  }> = [
    {
      id: 'OP-4821',
      product: 'Sofá Milano 3 lugares',
      quantity: 6,
      batch: 'L-0928-A',
      client: 'Móveis Aurora',
      orderCode: 'PED-1901',
      urgent: true,
      dueDate: '2026-10-05',
      cells: [{ sectorId: 'cnc', status: 'run', progress: 42 }],
    },
    {
      id: 'OP-4822',
      product: 'Poltrona Aurora',
      quantity: 10,
      batch: 'L-0928-A',
      client: 'Casa & Conforto',
      orderCode: 'PED-1902',
      urgent: false,
      dueDate: '2026-10-06',
      cells: [{ sectorId: 'corte', status: 'wait', progress: 0 }],
    },
    {
      id: 'OP-4823',
      product: 'Cama Box Luna',
      quantity: 4,
      batch: 'L-0928-B',
      client: 'Lar Ideal',
      orderCode: 'PED-1903',
      urgent: false,
      dueDate: '2026-10-08',
      cells: [{ sectorId: 'laminacao', status: 'pause', progress: 30 }],
    },
  ];

  const insertOrder = conn.prepare(
    `INSERT INTO orders (id, product, quantity, batch, client, order_code, urgent, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertCell = conn.prepare(
    `INSERT INTO order_sector_progress (order_id, sector_id, status, progress, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const order of samples) {
    insertOrder.run(
      order.id,
      order.product,
      order.quantity,
      order.batch,
      order.client,
      order.orderCode,
      order.urgent ? 1 : 0,
      order.dueDate,
    );
    for (const cell of order.cells) {
      insertCell.run(order.id, cell.sectorId, cell.status, cell.progress, null, null);
    }
  }

  conn
    .prepare('INSERT INTO activity_log (actor_id, text, at) VALUES (?, ?, ?)')
    .run('user-gerencia', 'Base de produção iniciada', new Date().toISOString());
}

export function findUserByEmail(email: string): UserRecord | null {
  const row = db()
    .prepare(
      `SELECT id, name, role, email, sector_id AS sectorId, password_hash AS passwordHash, pin_hash AS pinHash
       FROM users WHERE email = ? AND active = 1`,
    )
    .get(email) as UserRecord | undefined;
  return row ?? null;
}

export function findOperator(sectorId: string): UserRecord | null {
  const row = db()
    .prepare(
      `SELECT id, name, role, email, sector_id AS sectorId, password_hash AS passwordHash, pin_hash AS pinHash
       FROM users WHERE role = 'operator' AND sector_id = ? AND active = 1`,
    )
    .get(sectorId) as UserRecord | undefined;
  return row ?? null;
}

export function findUserById(id: string): UserRecord | null {
  const row = db()
    .prepare(
      `SELECT id, name, role, email, sector_id AS sectorId, password_hash AS passwordHash, pin_hash AS pinHash
       FROM users WHERE id = ? AND active = 1`,
    )
    .get(id) as UserRecord | undefined;
  return row ?? null;
}

export interface AccountPublic {
  id: string;
  name: string;
  role: 'manager' | 'operator';
  email: string | null;
  sectorId: string | null;
  active: boolean;
}

interface AccountSql {
  id: string;
  name: string;
  role: 'manager' | 'operator';
  email: string | null;
  sectorId: string | null;
  active: number;
}

function toPublic(row: AccountSql): AccountPublic {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    sectorId: row.sectorId,
    active: row.active === 1,
  };
}

export function listAccounts(): AccountPublic[] {
  const rows = db()
    .prepare(
      `SELECT id, name, role, email, sector_id AS sectorId, active
       FROM users ORDER BY role DESC, name`,
    )
    .all() as unknown as AccountSql[];
  return rows.map(toPublic);
}

export function getAccount(id: string): AccountPublic | null {
  const row = db()
    .prepare(
      `SELECT id, name, role, email, sector_id AS sectorId, active
       FROM users WHERE id = ?`,
    )
    .get(id) as unknown as AccountSql | undefined;
  return row ? toPublic(row) : null;
}

export function emailTaken(email: string, exceptId?: string): boolean {
  const row = db()
    .prepare('SELECT id FROM users WHERE lower(email) = ? AND id <> ?')
    .get(email.toLowerCase(), exceptId ?? '') as { id: string } | undefined;
  return Boolean(row);
}

export function sectorTaken(sectorId: string, exceptId?: string): boolean {
  const row = db()
    .prepare(
      `SELECT id FROM users
       WHERE role = 'operator' AND sector_id = ? AND active = 1 AND id <> ?`,
    )
    .get(sectorId, exceptId ?? '') as { id: string } | undefined;
  return Boolean(row);
}

export function otherActiveManagers(exceptId: string): number {
  const row = db()
    .prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'manager' AND active = 1 AND id <> ?`)
    .get(exceptId) as { n: number };
  return row.n;
}

export function insertAccount(input: {
  id: string;
  name: string;
  role: 'manager' | 'operator';
  email: string | null;
  sectorId: string | null;
  passwordHash: string | null;
  pinHash: string | null;
}): void {
  db()
    .prepare(
      `INSERT INTO users (id, name, role, email, sector_id, password_hash, pin_hash, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .run(
      input.id,
      input.name,
      input.role,
      input.email,
      input.sectorId,
      input.passwordHash,
      input.pinHash,
    );
}

export function updateAccount(
  id: string,
  patch: {
    name?: string;
    email?: string | null;
    sectorId?: string | null;
    passwordHash?: string | null;
    pinHash?: string | null;
    active?: boolean;
  },
): void {
  const current = getAccount(id);
  if (!current) return;
  db()
    .prepare(
      `UPDATE users
       SET name = ?, email = ?, sector_id = ?, password_hash = COALESCE(?, password_hash),
           pin_hash = COALESCE(?, pin_hash), active = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      patch.name ?? current.name,
      patch.email === undefined ? current.email : patch.email,
      patch.sectorId === undefined ? current.sectorId : patch.sectorId,
      patch.passwordHash ?? null,
      patch.pinHash ?? null,
      patch.active === undefined ? (current.active ? 1 : 0) : patch.active ? 1 : 0,
      new Date().toISOString(),
      id,
    );
}

export function listOperatorSectors(): Array<{ id: string; name: string; icon: string }> {
  return db()
    .prepare(
      `SELECT s.id, s.name, s.icon
       FROM sectors s
       JOIN users u ON u.sector_id = s.id AND u.role = 'operator' AND u.active = 1
       ORDER BY s.pos_y, s.pos_x`,
    )
    .all() as Array<{ id: string; name: string; icon: string }>;
}

export function listSectors(): SectorRow[] {
  const rows = db()
    .prepare('SELECT id, name, icon, color, pos_x AS x, pos_y AS y FROM sectors')
    .all() as Array<{ id: string; name: string; icon: string; color: string; x: number; y: number }>;
  const deps = db().prepare('SELECT sector_id, dep_id FROM sector_deps').all() as Array<{
    sector_id: string;
    dep_id: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    pos: { x: row.x, y: row.y },
    deps: deps.filter((d) => d.sector_id === row.id).map((d) => d.dep_id),
  }));
}

export function listOrders(): OrderRecord[] {
  const orders = db()
    .prepare(
      `SELECT id, product, quantity, batch, client, order_code AS orderCode, urgent, due_date AS dueDate
       FROM orders ORDER BY id`,
    )
    .all() as Array<Omit<OrderRecord, 'progressBySector' | 'urgent'> & { urgent: number }>;
  const cells = db()
    .prepare(
      `SELECT order_id AS orderId, sector_id AS sectorId, status, progress, started_at AS startedAt, finished_at AS finishedAt
       FROM order_sector_progress`,
    )
    .all() as unknown as Array<ProgressCell & { orderId: string }>;
  return orders.map((order) => {
    const progressBySector: Record<string, ProgressCell> = {};
    for (const cell of cells) {
      if (cell.orderId !== order.id) continue;
      progressBySector[cell.sectorId] = {
        sectorId: cell.sectorId,
        status: cell.status,
        progress: cell.progress,
        startedAt: cell.startedAt ?? undefined,
        finishedAt: cell.finishedAt ?? undefined,
      };
    }
    return {
      id: order.id,
      product: order.product,
      quantity: order.quantity,
      batch: order.batch,
      client: order.client,
      orderCode: order.orderCode,
      urgent: order.urgent === 1,
      dueDate: order.dueDate,
      progressBySector,
    };
  });
}

export function listPauses(): PauseRecord[] {
  const rows = db()
    .prepare(
      `SELECT id, order_id AS orderId, sector_id AS sectorId, reason, note, by_name AS by, at, state
       FROM pauses ORDER BY at DESC`,
    )
    .all() as unknown as PauseRecord[];
  return rows;
}

export function listFeed(limit = 40): FeedRecord[] {
  const rows = db()
    .prepare('SELECT id, text, at FROM activity_log ORDER BY id DESC LIMIT ?')
    .all(limit) as Array<{ id: number; text: string; at: string }>;
  return rows.map((row) => ({
    id: `feed-${row.id}`,
    text: row.text,
    at: row.at.slice(11, 16),
  }));
}

export function orderVisibleToOperator(order: OrderRecord, sectorId: string, sectors: SectorRow[]): boolean {
  const cell = order.progressBySector[sectorId];
  if (cell && cell.status !== 'done') return true;
  if (cell?.status === 'done') return false;
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return false;
  return canStartProgress(order, sector.deps);
}

function canStartProgress(order: OrderRecord, deps: string[]): boolean {
  return deps.every((d) => order.progressBySector[d]?.status === 'done');
}

export function ordersFor(role: 'manager' | 'operator', sectorId: string | null): OrderRecord[] {
  const orders = listOrders();
  if (role === 'manager' || !sectorId) return orders;
  const sectors = listSectors();
  return orders.filter((order) => orderVisibleToOperator(order, sectorId, sectors));
}

export function pausesFor(role: 'manager' | 'operator', sectorId: string | null): PauseRecord[] {
  const pauses = listPauses();
  if (role === 'manager' || !sectorId) return pauses;
  return pauses.filter((pause) => pause.sectorId === sectorId);
}

export function patchSectorPos(id: string, pos: { x: number; y: number }): void {
  db().prepare('UPDATE sectors SET pos_x = ?, pos_y = ? WHERE id = ?').run(pos.x, pos.y, id);
}

export function patchSectorMeta(id: string, meta: { name?: string; icon?: string; color?: string }): void {
  const current = listSectors().find((s) => s.id === id);
  if (!current) return;
  db()
    .prepare('UPDATE sectors SET name = ?, icon = ?, color = ? WHERE id = ?')
    .run(meta.name ?? current.name, meta.icon ?? current.icon, meta.color ?? current.color, id);
}

export function replaceDeps(sectorId: string, deps: string[]): void {
  const conn = db();
  conn.exec('BEGIN');
  try {
    conn.prepare('DELETE FROM sector_deps WHERE sector_id = ?').run(sectorId);
    const insert = conn.prepare('INSERT INTO sector_deps (sector_id, dep_id) VALUES (?, ?)');
    for (const dep of deps) insert.run(sectorId, dep);
    conn.exec('COMMIT');
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
}

export function getOrder(id: string): OrderRecord | null {
  return listOrders().find((order) => order.id === id) ?? null;
}

export function saveProgress(orderId: string, cell: ProgressCell): void {
  db()
    .prepare(
      `INSERT INTO order_sector_progress (order_id, sector_id, status, progress, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (order_id, sector_id) DO UPDATE SET
         status = excluded.status,
         progress = excluded.progress,
         started_at = excluded.started_at,
         finished_at = excluded.finished_at`,
    )
    .run(
      orderId,
      cell.sectorId,
      cell.status,
      cell.progress,
      cell.startedAt ?? null,
      cell.finishedAt ?? null,
    );
}

export function insertPause(pause: PauseRecord): void {
  db()
    .prepare(
      `INSERT INTO pauses (id, order_id, sector_id, reason, note, by_name, at, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      pause.id,
      pause.orderId,
      pause.sectorId,
      pause.reason,
      pause.note ?? null,
      pause.by,
      pause.at,
      pause.state,
    );
}

export function setPauseState(id: string, state: PauseRecord['state']): void {
  db().prepare('UPDATE pauses SET state = ? WHERE id = ?').run(state, id);
}

export function addFeed(actorId: string, text: string): FeedRecord {
  const at = new Date().toISOString();
  const result = db()
    .prepare('INSERT INTO activity_log (actor_id, text, at) VALUES (?, ?, ?)')
    .run(actorId, text, at);
  const item = { id: `feed-${Number(result.lastInsertRowid)}`, text, at: at.slice(11, 16) };
  eachClient((client) => {
    if (client.role === 'manager') client.send('feed.created', item);
  });
  return item;
}

export function insertOrder(order: OrderRecord, actorId: string): void {
  const conn = db();
  conn.exec('BEGIN');
  try {
    conn
      .prepare(
        `INSERT INTO orders (id, product, quantity, batch, client, order_code, urgent, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        order.id,
        order.product,
        order.quantity,
        order.batch,
        order.client,
        order.orderCode,
        order.urgent ? 1 : 0,
        order.dueDate,
      );
    const insertCell = conn.prepare(
      `INSERT INTO order_sector_progress (order_id, sector_id, status, progress, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const cell of Object.values(order.progressBySector)) {
      insertCell.run(order.id, cell.sectorId, cell.status, cell.progress, cell.startedAt ?? null, cell.finishedAt ?? null);
    }
    conn.exec('COMMIT');
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
  addFeed(actorId, `Importada: ${order.id} · ${order.product}`);
}

export function recordImport(id: string, filename: string, rowCount: number, actorId: string): void {
  db()
    .prepare('INSERT INTO import_jobs (id, filename, created_at, row_count, actor_id) VALUES (?, ?, ?, ?, ?)')
    .run(id, filename, new Date().toISOString(), rowCount, actorId);
}

export interface SectorTimeSampleRow {
  id: string;
  orderId: string;
  product: string;
  productKey: string;
  quantity: number;
  sectorId: string;
  activeMs: number;
  pauseMs: number;
  wallMs: number;
  finishedAt: string;
  source: string;
}

function openSegment(orderId: string, sectorId: string, at: string): void {
  const open = db()
    .prepare(
      `SELECT id FROM sector_time_segments
       WHERE order_id = ? AND sector_id = ? AND ended_at IS NULL LIMIT 1`,
    )
    .get(orderId, sectorId) as { id: string } | undefined;
  if (open) return;
  db()
    .prepare(
      `INSERT INTO sector_time_segments (id, order_id, sector_id, started_at, ended_at)
       VALUES (?, ?, ?, ?, NULL)`,
    )
    .run(`TS${randomUUID().slice(0, 10)}`, orderId, sectorId, at);
}

function closeOpenSegment(orderId: string, sectorId: string, at: string): void {
  db()
    .prepare(
      `UPDATE sector_time_segments SET ended_at = ?
       WHERE order_id = ? AND sector_id = ? AND ended_at IS NULL`,
    )
    .run(at, orderId, sectorId);
}

function sumActiveMs(orderId: string, sectorId: string): number {
  const rows = db()
    .prepare(
      `SELECT started_at AS startedAt, ended_at AS endedAt
       FROM sector_time_segments WHERE order_id = ? AND sector_id = ?`,
    )
    .all(orderId, sectorId) as Array<{ startedAt: string; endedAt: string | null }>;
  let total = 0;
  for (const row of rows) {
    if (!row.endedAt) continue;
    const start = Date.parse(row.startedAt);
    const end = Date.parse(row.endedAt);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      total += end - start;
    }
  }
  return total;
}

function sampleExists(orderId: string, sectorId: string): boolean {
  const row = db()
    .prepare(
      `SELECT 1 AS ok FROM sector_time_samples WHERE order_id = ? AND sector_id = ? LIMIT 1`,
    )
    .get(orderId, sectorId) as { ok: number } | undefined;
  return Boolean(row);
}

/** Atualiza segmentos de tempo e grava amostra ao concluir o setor. */
export function trackSectorTime(
  order: OrderRecord,
  sectorId: string,
  prevStatus: ProgressStatus | undefined,
  nextStatus: ProgressStatus,
  at = new Date().toISOString(),
): void {
  if (nextStatus === 'run' && prevStatus !== 'run') {
    openSegment(order.id, sectorId, at);
    return;
  }
  if (
    (nextStatus === 'pause' || nextStatus === 'stop') &&
    prevStatus === 'run'
  ) {
    closeOpenSegment(order.id, sectorId, at);
    return;
  }
  if (nextStatus !== 'done') return;

  const cell = order.progressBySector[sectorId];
  closeOpenSegment(order.id, sectorId, cell?.finishedAt ?? at);
  if (sampleExists(order.id, sectorId)) return;

  const startedAt = cell?.startedAt;
  const finishedAt = cell?.finishedAt ?? at;
  const wallMs =
    startedAt && finishedAt
      ? Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt))
      : 0;
  const activeMs = sumActiveMs(order.id, sectorId);
  const pauseMs = Math.max(0, wallMs - activeMs);
  const productKey = normalizeProductKey(order.product);

  db()
    .prepare(
      `INSERT INTO sector_time_samples
         (id, order_id, product, product_key, quantity, sector_id,
          active_ms, pause_ms, wall_ms, finished_at, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live')`,
    )
    .run(
      `SM${randomUUID().slice(0, 10)}`,
      order.id,
      order.product,
      productKey,
      order.quantity,
      sectorId,
      activeMs,
      pauseMs,
      wallMs,
      finishedAt,
    );
}

export function listTimeSamples(filters?: {
  product?: string;
  sectorId?: string;
}): SectorTimeSampleRow[] {
  const clauses: string[] = [];
  const params: string[] = [];
  if (filters?.product) {
    clauses.push('product_key = ?');
    params.push(normalizeProductKey(filters.product));
  }
  if (filters?.sectorId) {
    clauses.push('sector_id = ?');
    params.push(filters.sectorId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT id, order_id AS orderId, product, product_key AS productKey,
              quantity, sector_id AS sectorId, active_ms AS activeMs,
              pause_ms AS pauseMs, wall_ms AS wallMs,
              finished_at AS finishedAt, source
       FROM sector_time_samples ${where}
       ORDER BY finished_at DESC`,
    )
    .all(...params) as unknown as SectorTimeSampleRow[];
  return rows;
}

export { canStartProgress as depsDone };
