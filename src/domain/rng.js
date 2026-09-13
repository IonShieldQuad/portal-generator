// Deterministic PRNG (mulberry32), wrapped purely.
// An rng is `{ state }`; every call returns a new rng instead of mutating.

export function createRng(seed = 1) {
  const state = (Number(seed) >>> 0) || 1;
  return { state };
}

export function nextRandom(rng) {
  const a = (rng.state + 0x6d2b79f5) | 0;
  const nextState = a >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rng: { state: nextState } };
}

// Inclusive integer in [min, max].
export function randInt(rng, min, max) {
  const { value, rng: next } = nextRandom(rng);
  const span = max - min + 1;
  return { value: min + Math.floor(value * span), rng: next };
}

// True with the given probability.
export function chance(rng, probability) {
  const { value, rng: next } = nextRandom(rng);
  return { value: value < probability, rng: next };
}
