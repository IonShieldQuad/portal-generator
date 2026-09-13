import { CONFIG } from './constants.js';
import { clamp, clampInt } from './util.js';

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export function createPortal(overrides = {}) {
  return {
    id: overrides.id ?? 'portal',
    name: overrides.name ?? 'Портал',
    destinationWorld: overrides.destinationWorld ?? 'Неизвестный мир',
    distance: clampInt(overrides.distance ?? 5, CONFIG.DISTANCE_MIN, CONFIG.DISTANCE_MAX),
    coefficient: clampInt(overrides.coefficient ?? 50, 0, CONFIG.COEFFICIENT_MAX),
    stability: clamp(overrides.stability ?? 60, 0, CONFIG.STABILITY_MAX),
    reserves: clamp(overrides.reserves ?? 60, 0, CONFIG.RESERVES_MAX),
    gnomes: Math.max(0, Math.trunc(overrides.gnomes ?? 0)),
    assistant: overrides.assistant ?? false,
    decayBuffTurns: Math.max(0, Math.trunc(overrides.decayBuffTurns ?? 0)),
    status: overrides.status ?? 'open',
    actionUsed: overrides.actionUsed ?? false,
  };
}

// ---------------------------------------------------------------------------
// Portal-scoped mechanics (pure)
// ---------------------------------------------------------------------------

export function coefficientOptimum(portal) {
  return CONFIG.C_OPT_BASE + CONFIG.C_OPT_PER_DISTANCE * portal.distance;
}

export function coefficientSafe(portal) {
  return coefficientOptimum(portal) + CONFIG.C_SAFE_OFFSET;
}

// How far the coefficient can wander in one turn; worse when stability is low.
export function coefficientDriftMax(stability) {
  return Math.round(
    CONFIG.COEFF_DRIFT_BASE + (CONFIG.STABILITY_MAX - stability) * CONFIG.COEFF_DRIFT_STABILITY,
  );
}

export function throughput(portal) {
  return clampInt(
    Math.round(portal.coefficient / CONFIG.THROUGHPUT_DIVISOR),
    CONFIG.THROUGHPUT_MIN,
    CONFIG.THROUGHPUT_MAX,
  );
}

export function upkeep(portal) {
  const base = CONFIG.UPKEEP_K * portal.coefficient * (1 + CONFIG.UPKEEP_DISTANCE * portal.distance);
  return base * (portal.assistant ? CONFIG.ASSISTANT_UPKEEP_MULT : 1);
}

export function distancePenalty(portal) {
  return 1 + CONFIG.STABILITY_DISTANCE_K * portal.distance;
}

// Additive stability model: a small passive gain, losses from a bad coefficient
// and low energy, plus a gain while Stabilize is active. Scaled by distance.
export function stabilityDelta(portal) {
  const dp = distancePenalty(portal);
  const passiveGain = CONFIG.STABILITY_PASSIVE_GAIN / dp;
  const deviation = Math.abs(portal.coefficient - coefficientOptimum(portal));
  const coeffLoss = CONFIG.STABILITY_COEFF_LOSS_K * deviation * dp;
  const energyLoss =
    portal.reserves < CONFIG.ENERGY_LOW
      ? CONFIG.ENERGY_LOSS_K * (CONFIG.ENERGY_LOW - portal.reserves) * dp
      : 0;
  const energyBonus =
    portal.reserves > CONFIG.ENERGY_HIGH
      ? CONFIG.ENERGY_HIGH_K * (portal.reserves - CONFIG.ENERGY_HIGH)
      : 0;
  const starveLoss = portal.reserves <= 0 ? CONFIG.STARVE_LOSS * dp : 0;
  const stabilizeGain = portal.decayBuffTurns > 0 ? CONFIG.STABILIZE_PASSIVE_GAIN : 0;
  return passiveGain + energyBonus - coeffLoss - energyLoss - starveLoss + stabilizeGain;
}

// Deterministic forward simulation until stability reaches zero.
export function predictedTimeToCollapse(portal) {
  if (portal.status === 'closed' || portal.status === 'collapsed') return 0;
  let p = { ...portal };
  for (let t = 1; t <= CONFIG.COLLAPSE_PREDICTION_CAP; t += 1) {
    p.reserves = clamp(p.reserves - upkeep(p), 0, CONFIG.RESERVES_MAX);
    p.stability = clamp(p.stability + stabilityDelta(p), 0, CONFIG.STABILITY_MAX);
    if (p.decayBuffTurns > 0) p.decayBuffTurns -= 1;
    if (p.stability <= 0) return t;
  }
  return Infinity;
}

export function scorePerGnome(portal) {
  return CONFIG.SCORE_PER_GNOME * (1 + CONFIG.SCORE_DISTANCE_K * portal.distance);
}

export function riskBand(value) {
  if (value < CONFIG.RISK_BANDS.LOW) return 'low';
  if (value < CONFIG.RISK_BANDS.MEDIUM) return 'medium';
  if (value < CONFIG.RISK_BANDS.HIGH) return 'high';
  return 'critical';
}

// Low time-to-collapse always yields at least this much risk.
function timeFloor(time) {
  if (!Number.isFinite(time)) return 0;
  for (const { turns, floor } of CONFIG.RISK_TIME_FLOORS) {
    if (time <= turns) return floor;
  }
  return 0;
}

export function riskBreakdown(portal) {
  const rS = 100 - portal.stability;
  const deviation = Math.abs(portal.coefficient - coefficientOptimum(portal));
  const rC = Math.min(100, CONFIG.RISK_COEFF_SCALE * deviation);
  const rR = 100 - portal.reserves;
  const time = predictedTimeToCollapse(portal);
  const rT = Number.isFinite(time) ? clamp(100 - CONFIG.RISK_TIME_SCALE * time, 0, 100) : 0;
  const w = CONFIG.RISK_WEIGHTS;
  const weighted = w.STABILITY * rS + w.COEFFICIENT * rC + w.RESERVES * rR + w.TIME * rT;
  const value = Math.round(Math.max(weighted, timeFloor(time)));
  return { rS, rC, rR, rT, risk: clamp(value, 0, 100), band: riskBand(value) };
}

export function risk(portal) {
  return riskBreakdown(portal).risk;
}

export function recommendedAction(portal) {
  if (portal.status === 'closed' || portal.status === 'collapsed') return null;
  if (portal.status === 'collapsing') return 'stabilize-or-evacuate';
  const band = riskBand(risk(portal));
  if (band === 'critical' && portal.gnomes > 0) return 'evacuate-and-stabilize';
  if (portal.reserves <= 25) return 'energize';
  const deviation = Math.abs(portal.coefficient - coefficientOptimum(portal));
  if (deviation > 15) return 'tune';
  if (band !== 'critical' && portal.gnomes < throughput(portal)) return 'send-in';
  return 'review';
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

export function isActive(portal) {
  return portal.status === 'open';
}

export function isCollapsing(portal) {
  return portal.status === 'collapsing';
}

export function isClosed(portal) {
  return portal.status === 'closed';
}

export function isCollapsed(portal) {
  return portal.status === 'collapsed';
}

export function isTerminal(portal) {
  return isClosed(portal) || isCollapsed(portal);
}

export function hasAssistant(portal) {
  return portal.assistant === true;
}

export function isCritical(portal) {
  return riskBand(risk(portal)) === 'critical';
}
