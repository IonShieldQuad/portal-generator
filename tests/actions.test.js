import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../src/domain/game.js';
import { createPortal, risk, riskBand } from '../src/domain/portal.js';
import { applyAction, canApply, ActionId } from '../src/domain/actions.js';

function stateWith(portal, overrides = {}) {
  return createGameState(1, { portals: [portal], ...overrides });
}

test('cannot stabilize a closed portal', () => {
  const state = stateWith(createPortal({ id: 'p', status: 'closed' }));
  assert.equal(canApply(state, 'p', ActionId.STABILIZE).ok, false);
});

test('cannot send more gnomes than throughput', () => {
  const state = stateWith(createPortal({ id: 'p', coefficient: 50 }));
  assert.equal(canApply(state, 'p', ActionId.SEND_IN, { amount: 999 }).ok, false);
});

test('cannot send gnomes into a critical-risk portal', () => {
  const critical = createPortal({ id: 'p', distance: 5, coefficient: 100, stability: 10, reserves: 5 });
  assert.equal(riskBand(risk(critical)), 'critical');
  assert.equal(canApply(stateWith(critical), 'p', ActionId.SEND_IN, { amount: 1 }).ok, false);
});

test('cannot assign a second assistant to one portal', () => {
  const state = stateWith(createPortal({ id: 'p', assistant: true }));
  assert.equal(canApply(state, 'p', ActionId.ASSIGN_ASSISTANT).ok, false);
});

test('cannot assign an assistant when none is free', () => {
  const state = createGameState(1, {
    portals: [
      createPortal({ id: 'a', assistant: true }),
      createPortal({ id: 'b', assistant: true }),
      createPortal({ id: 'c' }),
    ],
  });
  assert.equal(canApply(state, 'c', ActionId.ASSIGN_ASSISTANT).reason, 'Нет свободных ассистентов');
});

test('cannot energize beyond the pool', () => {
  const state = stateWith(createPortal({ id: 'p', reserves: 50 }), { energyPool: 10 });
  assert.equal(canApply(state, 'p', ActionId.ENERGIZE, { amount: 20 }).ok, false);
});

test('closing with gnomes inside requires confirmation', () => {
  const state = stateWith(createPortal({ id: 'p', gnomes: 3 }));
  assert.equal(canApply(state, 'p', ActionId.CLOSE).ok, false);
  assert.equal(canApply(state, 'p', ActionId.CLOSE, { confirm: true }).ok, true);
});

test('only one turn-costing action per portal', () => {
  let state = stateWith(createPortal({ id: 'p', reserves: 50 }));
  state = applyAction(state, 'p', ActionId.STABILIZE).state;
  assert.equal(canApply(state, 'p', ActionId.TUNE, { step: '+' }).ok, false);
});

test('energize stays available after the turn action is used', () => {
  let state = stateWith(createPortal({ id: 'p', reserves: 50 }));
  state = applyAction(state, 'p', ActionId.STABILIZE).state;
  assert.equal(canApply(state, 'p', ActionId.ENERGIZE, { amount: 10 }).ok, true);
});

test('a blocked action is logged and does not mutate state', () => {
  const portal = createPortal({ id: 'p', status: 'closed' });
  const state = stateWith(portal);
  const result = applyAction(state, 'p', ActionId.STABILIZE);
  assert.equal(result.ok, false);
  assert.equal(result.state.log.length, 1);
  assert.equal(result.state.log[0].result, 'blocked');
  assert.deepEqual(result.state.portals[0], portal);
});

test('closing with gnomes strands them and applies the penalty', () => {
  const state = stateWith(createPortal({ id: 'p', gnomes: 2, reserves: 30, status: 'open' }), {
    energyPool: 0,
  });
  const result = applyAction(state, 'p', ActionId.CLOSE, { confirm: true });
  assert.equal(result.ok, true);
  assert.equal(result.state.score, -30);
  assert.equal(result.state.portals[0].gnomes, 0);
  assert.equal(result.state.portals[0].status, 'closed');
});

test('review is a no-op that keeps the portal open', () => {
  const state = stateWith(createPortal({ id: 'p', reserves: 50 }));
  const result = applyAction(state, 'p', ActionId.REVIEW);
  assert.equal(result.ok, true);
  assert.equal(result.state.portals[0].status, 'open');
});

test('transit through an overcharged portal can injure gnomes', () => {
  const portal = createPortal({ id: 'p', coefficient: 100, distance: 1, gnomes: 0, stability: 80, reserves: 80 });
  const state = createGameState(1, { portals: [portal], idleGnomes: 10 });
  const result = applyAction(state, 'p', ActionId.SEND_IN, { amount: 5 });
  assert.equal(result.ok, true);
  assert.ok(result.state.portals[0].gnomes < 5);
  assert.ok(result.state.log.some((e) => e.message.includes('Травмировано')));
});
