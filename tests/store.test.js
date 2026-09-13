import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { createGameState } from '../src/domain/game.js';
import { createPortal } from '../src/domain/portal.js';
import { ActionId } from '../src/domain/actions.js';

function makeStore() {
  const state = createGameState(1, {
    portals: [createPortal({ id: 'p1', reserves: 50, stability: 50, coefficient: 55, distance: 5 })],
  });
  return createStore(state);
}

test('selecting an action stages it; selecting it again reverts to Review', () => {
  const store = makeStore();
  store.selectAction('p1', ActionId.STABILIZE);
  assert.equal(store.getPending('p1').action, ActionId.STABILIZE);
  store.selectAction('p1', ActionId.STABILIZE);
  assert.equal(store.getPending('p1').action, ActionId.REVIEW);
});

test('preview projects the effect without mutating state', () => {
  const store = makeStore();
  store.selectAction('p1', ActionId.STABILIZE);
  const preview = store.preview('p1');
  assert.equal(preview.before.stability, 50);
  assert.equal(preview.after.stability, 70);
  assert.equal(store.getState().portals[0].stability, 50);
});

test('energize is staged separately and included in the preview', () => {
  const store = makeStore();
  store.selectEnergize('p1', 20);
  const preview = store.preview('p1');
  assert.equal(preview.after.reserves, 70);
});

test('advanceTurn warns when portals are untouched, then commits on confirm', () => {
  const store = makeStore();
  store.advanceTurn();
  assert.ok(store.getUi().warning, 'expected a warning');
  assert.equal(store.getState().tick, 0);
  store.confirmAdvance();
  assert.equal(store.getUi().warning, null);
  assert.equal(store.getState().tick, 1);
});

test('a staged action is applied at commit', () => {
  const store = makeStore();
  store.selectAction('p1', ActionId.STABILIZE);
  store.confirmAdvance();
  const portal = store.getState().portals.find((p) => p.id === 'p1');
  assert.ok(portal.stability > 50);
  assert.ok(store.getState().log.some((e) => e.message.includes('стабилизирован')));
});
