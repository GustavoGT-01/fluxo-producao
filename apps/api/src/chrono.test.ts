import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dir = mkdtempSync(path.join(tmpdir(), 'fluxo-chrono-'));
process.env.FLUXO_DB = path.join(dir, 't.sqlite');
process.env.AUTH_SECRET = 'test-secret-chrono';

const { buildApp, DEMO } = await import('./server');
const { closeDb } = await import('./db');

function cookieOf(setCookie: string | string[] | undefined): string {
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return raw?.split(';')[0] ?? '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('crono: run → pause → run → done grava amostra ativa < bruta', async () => {
  const app = await buildApp();

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { kind: 'manager', email: DEMO.managerEmail, password: DEMO.managerPassword },
  });
  assert.equal(login.statusCode, 200);
  const cookie = cookieOf(login.headers['set-cookie']);

  const orderId = 'OP-4821';
  const sectorId = 'cnc';

  const run1 = await app.inject({
    method: 'PATCH',
    url: `/api/orders/${orderId}/progress`,
    headers: { cookie },
    payload: { sectorId, status: 'run', progress: 10 },
  });
  assert.equal(run1.statusCode, 200);
  await sleep(40);

  const pause = await app.inject({
    method: 'POST',
    url: `/api/orders/${orderId}/pause`,
    headers: { cookie },
    payload: { sectorId, reason: 'Falta de material' },
  });
  assert.equal(pause.statusCode, 200);
  await sleep(40);

  const run2 = await app.inject({
    method: 'PATCH',
    url: `/api/orders/${orderId}/progress`,
    headers: { cookie },
    payload: { sectorId, status: 'run', progress: 50 },
  });
  assert.equal(run2.statusCode, 200);
  await sleep(40);

  const done = await app.inject({
    method: 'PATCH',
    url: `/api/orders/${orderId}/progress`,
    headers: { cookie },
    payload: { sectorId, status: 'done', progress: 100 },
  });
  assert.equal(done.statusCode, 200);

  const samples = await app.inject({
    method: 'GET',
    url: '/api/chrono/samples',
    headers: { cookie },
  });
  assert.equal(samples.statusCode, 200);
  const body = samples.json() as {
    samples: Array<{ orderId: string; sectorId: string; activeMs: number; wallMs: number; pauseMs: number }>;
  };
  const sample = body.samples.find((s) => s.orderId === orderId && s.sectorId === sectorId);
  assert.ok(sample);
  assert.ok(sample.activeMs > 0);
  assert.ok(sample.wallMs >= sample.activeMs);
  assert.ok(sample.pauseMs >= 0);
  assert.ok(sample.activeMs < sample.wallMs);

  const summary = await app.inject({
    method: 'GET',
    url: '/api/chrono/summary',
    headers: { cookie },
  });
  assert.equal(summary.statusCode, 200);
  assert.ok((summary.json() as { summary: unknown[] }).summary.length >= 1);

  const estimate = await app.inject({
    method: 'POST',
    url: '/api/chrono/estimate',
    headers: { cookie },
    payload: { product: 'Sofá Milano 3 lugares', quantity: 4 },
  });
  assert.equal(estimate.statusCode, 200);
  assert.ok(typeof (estimate.json() as { totalMs: number }).totalMs === 'number');

  await app.close();
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});
