import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPortal } from '../src/domain/portal.js';
import {
  createGameState,
  assistantsAssigned,
  assistantsFree,
  countsByStatus,
  needsAttention,
  validateState,
} from '../src/domain/game.js';

function stateWith(portals) {
  return createGameState(1, { portals });
}

test('assistant accounting is derived from the portals', () => {
  const state = stateWith([
    createPortal({ id: 'a', assistant: true }),
    createPortal({ id: 'b' }),
    createPortal({ id: 'c', assistant: true }),
  ]);
  assert.equal(assistantsAssigned(state), 2);
  assert.equal(assistantsFree(state), 0);
});

test('countsByStatus counts every status', () => {
  const state = stateWith([
    createPortal({ id: 'a', status: 'open' }),
    createPortal({ id: 'b', status: 'collapsing' }),
    createPortal({ id: 'c', status: 'closed' }),
  ]);
  assert.deepEqual(countsByStatus(state), {
    open: 1,
    collapsing: 1,
    closed: 1,
    collapsed: 0,
  });
});

test('needsAttention excludes terminal portals', () => {
  const state = stateWith([
    createPortal({ id: 'a', status: 'open' }),
    createPortal({ id: 'b', status: 'closed' }),
    createPortal({ id: 'c', status: 'collapsed' }),
  ]);
  const ids = needsAttention(state).map((p) => p.id);
  assert.deepEqual(ids, ['a']);
});

test('needsAttention sorts by risk', () => {
  const risky = createPortal({ id: 'risky', status: 'open', stability: 20, coefficient: 90, distance: 5, reserves: 10 });
  const calm = createPortal({ id: 'calm', status: 'open', stability: 95, coefficient: 55, distance: 5, reserves: 95 });
  const state = stateWith([calm, risky]);
  assert.equal(needsAttention(state)[0].id, 'risky');
});

test('validateState reports out-of-range values', () => {
  const broken = { ...createPortal({ id: 'x' }), stability: 150 };
  const problems = validateState(stateWith([broken]));
  assert.ok(problems.length > 0);
});
