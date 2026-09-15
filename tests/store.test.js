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

test('overcharged send preview projects the expected arrival and a capped injury note', () => {
  const state = createGameState(1, {
    portals: [createPortal({ id: 'p1', distance: 5, coefficient: 80, reserves: 50, stability: 60, gnomes: 2 })],
    idleGnomes: 10,
  });
  const store = createStore(state);
  store.selectAction('p1', ActionId.SEND_IN, { amount: 4 });
  const preview = store.preview('p1');
  assert.equal(preview.before.gnomes, 2);
  assert.equal(preview.after.gnomes, 5);
  assert.match(preview.note, /25%/);
  assert.equal(store.getState().portals[0].gnomes, 2);
});

test('attemptAction logs a blocked entry and surfaces the reason', () => {
  const state = createGameState(1, { portals: [createPortal({ id: 'p1', status: 'closed' })] });
  const store = createStore(state);
  store.attemptAction('p1', ActionId.STABILIZE);
  const log = store.getState().log;
  assert.equal(log.length, 1);
  assert.equal(log[0].result, 'blocked');
  assert.ok(store.getUi().toast, 'expected a toast');
  assert.equal(store.getState().portals[0].status, 'closed');
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

test('commit blockers report energy that cannot be paid across portals', () => {
  const state = createGameState(1, {
    energyPool: 60,
    portals: [
      createPortal({ id: 'a', reserves: 0, stability: 50 }),
      createPortal({ id: 'b', reserves: 0, stability: 50 }),
    ],
  });
  const store = createStore(state);
  store.selectAction('a', ActionId.STABILIZE);
  store.selectAction('b', ActionId.STABILIZE);
  const blockers = store.commitBlockers();
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].portalId, 'b');
  assert.equal(blockers[0].kind, 'energy');
});

test('commit blockers account for close refunds', () => {
  const state = createGameState(1, {
    energyPool: 0,
    portals: [
      createPortal({ id: 'a', reserves: 100, gnomes: 0, stability: 50 }),
      createPortal({ id: 'b', reserves: 0, stability: 50 }),
    ],
  });
  const store = createStore(state);
  store.selectAction('a', ActionId.CLOSE, { confirm: true });
  store.selectAction('b', ActionId.STABILIZE);
  assert.deepEqual(store.commitBlockers(), []);
});

test('advanceTurn refuses when the staged turn is not committable', () => {
  const state = createGameState(1, {
    energyPool: 0,
    portals: [createPortal({ id: 'a', reserves: 0, stability: 50 })],
  });
  const store = createStore(state);
  store.selectAction('a', ActionId.STABILIZE);
  store.advanceTurn();
  assert.equal(store.getState().tick, 0);
});
