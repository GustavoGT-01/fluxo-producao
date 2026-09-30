import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchPauseAlert, type PauseAlert } from './alert';

const payload: PauseAlert = {
  kind: 'pause.created',
  pauseId: 'P1',
  orderId: 'OP-1',
  sectorId: 'cnc',
  reason: 'Falta de material',
  at: '2026-09-30T12:00:00.000Z',
};

test('sem URL não chama a rede', async () => {
  let called = false;
  const sent = await dispatchPauseAlert(undefined, payload, async () => {
    called = true;
    return new Response(null, { status: 204 });
  });
  assert.equal(sent, false);
  assert.equal(called, false);
});

test('POST JSON no webhook', async () => {
  let body = '';
  const sent = await dispatchPauseAlert('http://alert.local/hook', payload, async (_url, init) => {
    body = String(init?.body ?? '');
    return new Response(null, { status: 204 });
  });
  assert.equal(sent, true);
  assert.equal(JSON.parse(body).pauseId, 'P1');
});
