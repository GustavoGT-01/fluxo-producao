import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dir = mkdtempSync(path.join(tmpdir(), 'fluxo-mig-'));
const file = path.join(dir, 'old.sqlite');

const old = new DatabaseSync(file);
old.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT UNIQUE,
    sector_id TEXT,
    password_hash TEXT,
    pin_hash TEXT,
    active INTEGER NOT NULL DEFAULT 1
  );
  INSERT INTO users (id, name, role, active) VALUES ('user-old', 'Antigo', 'manager', 1);
`);
old.close();

process.env.FLUXO_DB = file;
process.env.AUTH_SECRET = 'migrate-secret';

test('banco antigo ganha updated_at na versão 2', async () => {
  const { db, closeDb } = await import('./db');
  const columns = db().prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  assert.ok(columns.some((column) => column.name === 'updated_at'));
  const versions = db().prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{
    version: number;
  }>;
  assert.deepEqual(
    versions.map((row) => row.version),
    [1, 2],
  );
  const kept = db().prepare('SELECT name FROM users WHERE id = ?').get('user-old') as { name: string };
  assert.equal(kept.name, 'Antigo');
  closeDb();
});

test.after(() => {
  rmSync(dir, { recursive: true, force: true });
});
