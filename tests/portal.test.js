import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPortal,
  risk,
  riskBand,
  throughput,
  upkeep,
  coefficientOptimum,
  coefficientDriftMax,
  predictedTimeToCollapse,
  stabilityDelta,
  coefficientSafe,
  injuryProbability,
} from '../src/domain/portal.js';

function base(overrides = {}) {
  return createPortal({ distance: 5, coefficient: 55, stability: 90, reserves: 80, ...overrides });
}

test('lower stability raises risk', () => {
  assert.ok(risk(base({ stability: 20 })) > risk(base()));
});

test('coefficient below optimum raises risk', () => {
  assert.ok(risk(base({ coefficient: 35 })) > risk(base()));
});

test('coefficient above optimum raises risk', () => {
  assert.ok(risk(base({ coefficient: 75 })) > risk(base()));
});

test('lower reserves raises risk', () => {
  assert.ok(risk(base({ reserves: 10 })) > risk(base()));
});

test('shorter predicted collapse time raises risk', () => {
  const lowReserves = base({ reserves: 10 });
  assert.ok(predictedTimeToCollapse(lowReserves) < predictedTimeToCollapse(base()));
  assert.ok(risk(lowReserves) > risk(base()));
});

test('risk bands match thresholds', () => {
  assert.equal(riskBand(10), 'low');
  assert.equal(riskBand(30), 'medium');
  assert.equal(riskBand(60), 'high');
  assert.equal(riskBand(80), 'critical');
});

test('throughput scales with coefficient and is capped', () => {
  assert.equal(throughput(createPortal({ coefficient: 50 })), 10);
  assert.equal(throughput(createPortal({ coefficient: 0 })), 1);
  assert.equal(throughput(createPortal({ coefficient: 100 })), 20);
});

test('assistant lowers upkeep', () => {
  const plain = createPortal({ coefficient: 55, distance: 5 });
  const helped = createPortal({ coefficient: 55, distance: 5, assistant: true });
  assert.ok(upkeep(helped) < upkeep(plain));
});

test('coefficient optimum grows with distance', () => {
  assert.ok(coefficientOptimum(createPortal({ distance: 8 })) > coefficientOptimum(createPortal({ distance: 2 })));
});

test('coefficient drift grows as stability falls', () => {
  assert.equal(coefficientDriftMax(100), 2);
  assert.equal(coefficientDriftMax(0), 10);
  assert.ok(coefficientDriftMax(20) > coefficientDriftMax(80));
});

test('high energy improves stability regen', () => {
  const low = createPortal({ distance: 5, coefficient: 55, stability: 50, reserves: 50 });
  const high = createPortal({ distance: 5, coefficient: 55, stability: 50, reserves: 100 });
  assert.ok(stabilityDelta(high) > stabilityDelta(low));
});

test('injury probability is zero at or below the safe coefficient', () => {
  const safePortal = createPortal({ distance: 5, coefficient: coefficientSafe(createPortal({ distance: 5 })) });
  assert.equal(injuryProbability(safePortal), 0);
  assert.equal(injuryProbability(createPortal({ distance: 5, coefficient: 10 })), 0);
});

test('injury probability grows with overcharge and is capped at 1', () => {
  const mild = injuryProbability(createPortal({ distance: 5, coefficient: 80 }));
  const worse = injuryProbability(createPortal({ distance: 5, coefficient: 90 }));
  const extreme = injuryProbability(createPortal({ distance: 5, coefficient: 100 }));
  assert.ok(mild > 0 && mild < 1);
  assert.ok(worse > mild);
  assert.equal(extreme, 1);
});

test('low time to collapse forces a very high risk', () => {
  const critical = createPortal({ distance: 5, coefficient: 100, stability: 5, reserves: 90 });
  assert.ok(predictedTimeToCollapse(critical) <= 2);
  assert.equal(riskBand(risk(critical)), 'critical');

  const high = createPortal({ distance: 5, coefficient: 100, stability: 16, reserves: 90 });
  const turns = predictedTimeToCollapse(high);
  assert.ok(turns >= 3 && turns <= 4);
  assert.equal(riskBand(risk(high)), 'high');
});
