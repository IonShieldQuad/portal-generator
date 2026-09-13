import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../src/domain/game.js';
import { createPortal } from '../src/domain/portal.js';
import { makeEntry, appendLog, portalHistory } from '../src/domain/log.js';

test('appendLog adds an entry with an id', () => {
  const state = createGameState(1);
  const portal = createPortal({ id: 'p1', name: 'Портал' });
  const next = appendLog(state, makeEntry(state, portal, 'test', 'info', 'привет'));
  assert.equal(next.log.length, 1);
  assert.equal(next.log[0].id, 'e1');
  assert.equal(next.log[0].portalId, 'p1');
});

test('portalHistory returns only that portal history, in order', () => {
  const state = createGameState(1);
  const a = createPortal({ id: 'a' });
  const b = createPortal({ id: 'b' });
  let next = appendLog(state, makeEntry(state, a, 'x', 'info', 'первый'));
  next = appendLog(next, makeEntry(next, b, 'x', 'info', 'второй'));
  next = appendLog(next, makeEntry(next, a, 'x', 'info', 'третий'));
  const history = portalHistory(next, 'a');
  assert.deepEqual(history.map((e) => e.message), ['первый', 'третий']);
});
