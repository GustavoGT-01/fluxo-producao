import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dir = mkdtempSync(path.join(tmpdir(), 'fluxo-api-'));
process.env.FLUXO_DB = path.join(dir, 't.sqlite');
process.env.AUTH_SECRET = 'test-secret';

const { buildApp, DEMO } = await import('./server');
const { closeDb } = await import('./db');

function cookieOf(setCookie: string | string[] | undefined): string {
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return raw?.split(';')[0] ?? '';
}

test('login da gerência e bloqueio do operador', async () => {
  const app = await buildApp();

  const bad = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { kind: 'manager', email: DEMO.managerEmail, password: 'errada' },
  });
  assert.equal(bad.statusCode, 401);

  const manager = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { kind: 'manager', email: DEMO.managerEmail, password: DEMO.managerPassword },
  });
  assert.equal(manager.statusCode, 200);
  const managerCookie = cookieOf(manager.headers['set-cookie']);

  const operator = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { kind: 'operator', sectorId: 'cnc', pin: DEMO.pins.cnc },
  });
  assert.equal(operator.statusCode, 200);
  const operatorCookie = cookieOf(operator.headers['set-cookie']);

  const denied = await app.inject({
    method: 'PUT',
    url: '/api/sectors/cnc/dependencies',
    headers: { cookie: operatorCookie },
    payload: { deps: ['metalurgica'] },
  });
  assert.equal(denied.statusCode, 403);

  const stop = await app.inject({
    method: 'PATCH',
    url: '/api/orders/OP-4821/progress',
    headers: { cookie: operatorCookie },
    payload: { sectorId: 'cnc', status: 'stop' },
  });
  assert.equal(stop.statusCode, 403);

  const otherSector = await app.inject({
    method: 'PATCH',
    url: '/api/orders/OP-4822/progress',
    headers: { cookie: operatorCookie },
    payload: { sectorId: 'corte', status: 'run' },
  });
  assert.equal(otherSector.statusCode, 403);

  const cycle = await app.inject({
    method: 'PUT',
    url: '/api/sectors/cnc/dependencies',
    headers: { cookie: managerCookie },
    payload: { deps: ['metalurgica'] },
  });
  assert.equal(cycle.statusCode, 409);

  const metrics = await app.inject({
    method: 'GET',
    url: '/api/metrics',
    headers: { cookie: operatorCookie },
  });
  assert.equal(metrics.statusCode, 403);

  const forbiddenUsers = await app.inject({
    method: 'GET',
    url: '/api/users',
    headers: { cookie: operatorCookie },
  });
  assert.equal(forbiddenUsers.statusCode, 403);

  const created = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { cookie: managerCookie },
    payload: {
      kind: 'manager',
      name: 'Ana Gestora',
      email: 'ana@fabrica.local',
      password: 'Senha#1234',
    },
  });
  assert.equal(created.statusCode, 201);

  const ana = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { kind: 'manager', email: 'ana@fabrica.local', password: 'Senha#1234' },
  });
  assert.equal(ana.statusCode, 200);

  const clash = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { cookie: managerCookie },
    payload: { kind: 'operator', name: 'Outro', sectorId: 'cnc', pin: '2222' },
  });
  assert.equal(clash.statusCode, 409);

  const list = await app.inject({
    method: 'GET',
    url: '/api/users',
    headers: { cookie: managerCookie },
  });
  assert.equal(list.statusCode, 200);
  const users = list.json().users as Array<{ id: string; sectorId: string | null; role: string }>;
  const carlos = users.find((item) => item.role === 'operator' && item.sectorId === 'cnc');
  assert.ok(carlos);

  const pin = await app.inject({
    method: 'PATCH',
    url: `/api/users/${carlos.id}`,
    headers: { cookie: managerCookie },
    payload: { pin: '9090' },
  });
  assert.equal(pin.statusCode, 200);

  const oldPin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { kind: 'operator', sectorId: 'cnc', pin: DEMO.pins.cnc },
  });
  assert.equal(oldPin.statusCode, 401);

  const newPin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { kind: 'operator', sectorId: 'cnc', pin: '9090' },
  });
  assert.equal(newPin.statusCode, 200);

  await app.close();
});

test.after(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});
