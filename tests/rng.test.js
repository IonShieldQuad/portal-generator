import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, nextRandom, randInt } from '../src/domain/rng.js';

test('same seed produces the same sequence', () => {
  let a = createRng(42);
  let b = createRng(42);
  for (let i = 0; i < 20; i += 1) {
    const ra = nextRandom(a);
    const rb = nextRandom(b);
    assert.equal(ra.value, rb.value);
    a = ra.rng;
    b = rb.rng;
  }
});

test('different seeds produce different sequences', () => {
  const a = nextRandom(createRng(1)).value;
  const b = nextRandom(createRng(2)).value;
  assert.notEqual(a, b);
});

test('randInt stays within inclusive bounds', () => {
  let rng = createRng(7);
  for (let i = 0; i < 200; i += 1) {
    const roll = randInt(rng, 3, 9);
    assert.ok(roll.value >= 3 && roll.value <= 9);
    rng = roll.rng;
  }
});
