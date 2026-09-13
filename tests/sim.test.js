import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../src/domain/game.js';
import { createPortal } from '../src/domain/portal.js';
import { resolveTurn } from '../src/domain/sim.js';

function run(portals, seed = 1) {
  return resolveTurn(createGameState(seed, { portals })).state;
}

test('upkeep burns reserves', () => {
  const state = run([createPortal({ id: 'p', reserves: 50, coefficient: 55, distance: 5 })]);
  const portal = state.portals.find((p) => p.id === 'p');
  assert.ok(Math.abs(portal.reserves - 45.05) < 0.01);
});

test('starvation accelerates stability loss', () => {
  const state = run([
    createPortal({ id: 's', stability: 50, reserves: 0, coefficient: 55, distance: 5 }),
    createPortal({ id: 'f', stability: 50, reserves: 50, coefficient: 55, distance: 5 }),
  ]);
  const starved = state.portals.find((p) => p.id === 's');
  const fed = state.portals.find((p) => p.id === 'f');
  assert.ok(starved.stability < fed.stability);
});

test('stabilize buff adds passive stability gain and is consumed', () => {
  const state = run([
    createPortal({ id: 'b', stability: 50, reserves: 50, coefficient: 55, distance: 5, decayBuffTurns: 3 }),
    createPortal({ id: 'p', stability: 50, reserves: 50, coefficient: 55, distance: 5 }),
  ]);
  const buffed = state.portals.find((p) => p.id === 'b');
  const plain = state.portals.find((p) => p.id === 'p');
  assert.ok(buffed.stability > plain.stability);
  assert.equal(buffed.decayBuffTurns, 2);
});

test('reaching zero stability enters the collapsing telegraph, not collapse', () => {
  const state = run([
    createPortal({ id: 'p', stability: 0.5, reserves: 0, coefficient: 100, distance: 5, status: 'open' }),
  ]);
  const portal = state.portals.find((p) => p.id === 'p');
  assert.equal(portal.status, 'collapsing');
});

test('an unsaved collapsing portal collapses and strands its gnomes', () => {
  const state = run([
    createPortal({ id: 'p', status: 'collapsing', stability: 0, gnomes: 3, coefficient: 55, distance: 5 }),
  ]);
  const portal = state.portals.find((p) => p.id === 'p');
  assert.equal(portal.status, 'collapsed');
  assert.equal(portal.gnomes, 0);
  assert.ok(state.score <= -45);
});

test('gnomes on the far side earn score', () => {
  const state = run([
    createPortal({ id: 'p', stability: 80, reserves: 80, coefficient: 55, distance: 5, gnomes: 10 }),
  ]);
  assert.ok(state.score >= 10);
});

test('gnomes are not injured while idle on the far side', () => {
  const state = run([
    createPortal({ id: 'p', coefficient: 100, distance: 1, gnomes: 10, stability: 80, reserves: 80 }),
  ]);
  assert.equal(state.portals.find((p) => p.id === 'p').gnomes, 10);
});

test('turn resolution is deterministic for a fixed seed', () => {
  const make = () =>
    createGameState(9, {
      portals: [createPortal({ id: 'p', stability: 60, reserves: 60, coefficient: 55, distance: 5, gnomes: 5 })],
    });
  assert.deepEqual(resolveTurn(make()).state, resolveTurn(make()).state);
});

test('coefficient drifts over turns', () => {
  let state = createGameState(11, {
    portals: [createPortal({ id: 'p', coefficient: 50, stability: 80, reserves: 80, distance: 5 })],
  });
  let changed = false;
  for (let i = 0; i < 12; i += 1) {
    state = resolveTurn(state).state;
    if (state.portals[0].coefficient !== 50) {
      changed = true;
      break;
    }
  }
  assert.ok(changed, 'coefficient should drift over time');
});
