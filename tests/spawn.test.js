import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../src/domain/game.js';
import { createPortal } from '../src/domain/portal.js';
import { createRng } from '../src/domain/rng.js';
import { spawnProbability, shouldSpawn, spawnPortal } from '../src/domain/spawn.js';

test('no spawns at the softcap', () => {
  const portals = Array.from({ length: 8 }, (_, i) => createPortal({ id: `p${i}`, status: 'open' }));
  const state = createGameState(1, { portals });
  assert.equal(spawnProbability(state), 0);
  assert.equal(shouldSpawn(state, state.rng).value, false);
});

test('higher momentum raises spawn probability', () => {
  const cold = createGameState(1, { portals: [createPortal({ id: 'a' })], score: 0 });
  const hot = createGameState(1, { portals: [createPortal({ id: 'a' })], score: 200 });
  assert.ok(spawnProbability(hot) > spawnProbability(cold));
});

test('spawnPortal rolls within configured ranges', () => {
  const state = createGameState(3);
  const { portal } = spawnPortal(state, state.rng);
  assert.ok(portal.distance >= 1 && portal.distance <= 10);
  assert.ok(portal.coefficient >= 30 && portal.coefficient <= 70);
  assert.ok(portal.stability >= 40 && portal.stability <= 80);
  assert.ok(portal.reserves >= 40 && portal.reserves <= 80);
  assert.ok(portal.gnomes >= 0 && portal.gnomes <= 40);
  assert.equal(portal.status, 'open');
});

test('spawning is deterministic for a fixed seed', () => {
  const a = spawnPortal(createGameState(7), createRng(7));
  const b = spawnPortal(createGameState(7), createRng(7));
  assert.deepEqual(a.portal, b.portal);
});
