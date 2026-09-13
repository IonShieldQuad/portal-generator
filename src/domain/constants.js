// Central tunables for the simulation. Every balance number lives here.

export const CONFIG = Object.freeze({
  // Portal geometry
  DISTANCE_MIN: 1,
  DISTANCE_MAX: 10,

  // Coefficient ("Коэффициент Мерлина")
  C_OPT_BASE: 40,
  C_OPT_PER_DISTANCE: 3,
  C_SAFE_OFFSET: 20,

  // Throughput
  THROUGHPUT_DIVISOR: 5,
  THROUGHPUT_MIN: 1,
  THROUGHPUT_MAX: 20,

  // Stability — additive model
  STABILITY_PASSIVE_GAIN: 4,
  STABILITY_DISTANCE_K: 0.12,
  STABILITY_COEFF_LOSS_K: 0.12,
  ENERGY_LOW: 20,
  ENERGY_HIGH: 80,
  ENERGY_HIGH_K: 0.15,
  ENERGY_LOSS_K: 0.7,
  STARVE_LOSS: 12,
  STABILIZE_PASSIVE_GAIN: 5,

  // Upkeep
  UPKEEP_K: 0.06,
  UPKEEP_DISTANCE: 0.1,
  ASSISTANT_UPKEEP_MULT: 0.7,

  // Energy pool ("Резерв лаборатории")
  POOL_MAX: 200,
  POOL_START: 120,
  POOL_RECHARGE: 45,

  // Stabilize
  STABILIZE_COST: 60,
  STABILIZE_GAIN: 20,
  STABILIZE_BUFF_TURNS: 3,

  // Tune (-- / - / + / ++), randomised around a base; imperfect control
  TUNE_STEPS: Object.freeze({
    '--': Object.freeze({ base: -12, spread: 8 }),
    '-': Object.freeze({ base: -6, spread: 6 }),
    '+': Object.freeze({ base: 6, spread: 6 }),
    '++': Object.freeze({ base: 12, spread: 8 }),
  }),
  TUNE_MISFIRE_CHANCE: 0.2,

  // Per-turn coefficient drift; scales with instability (lower stability = more drift)
  COEFF_DRIFT_BASE: 2,
  COEFF_DRIFT_STABILITY: 0.08,

  // Score
  SCORE_PER_GNOME: 1,
  SCORE_DISTANCE_K: 0.15,

  // Penalties
  STRAND_PENALTY: 30,
  INJURY_PENALTY: 15,
  INJURY_RATE: 0.05,

  // Risk
  RISK_WEIGHTS: Object.freeze({
    STABILITY: 0.3,
    COEFFICIENT: 0.2,
    RESERVES: 0.15,
    TIME: 0.35,
  }),
  RISK_COEFF_SCALE: 1.5,
  RISK_TIME_SCALE: 8,
  // Time-to-collapse floors: <3 turns → critical, <5 turns → high.
  RISK_TIME_FLOORS: Object.freeze([
    Object.freeze({ turns: 2, floor: 80 }),
    Object.freeze({ turns: 4, floor: 60 }),
    Object.freeze({ turns: 7, floor: 40 }),
  ]),
  RISK_BANDS: Object.freeze({ LOW: 25, MEDIUM: 50, HIGH: 75 }),

  // Collapse prediction
  COLLAPSE_PREDICTION_CAP: 60,

  // Spawn
  SPAWN_BASE: 0.05,
  SPAWN_SOFTCAP: 8,
  SPAWN_MAX: 0.5,
  SCORE_REF: 100,
  SPAWN_GNOMES_MIN: 0,
  SPAWN_GNOMES_MAX: 40,
  SPAWN_COEFF_MIN: 30,
  SPAWN_COEFF_MAX: 70,
  SPAWN_STABILITY_MIN: 40,
  SPAWN_STABILITY_MAX: 80,
  SPAWN_RESERVES_MIN: 40,
  SPAWN_RESERVES_MAX: 80,

  // Roster
  START_GNOMES: 30,
  ASSISTANTS_TOTAL: 2,

  // Caps
  RESERVES_MAX: 100,
  STABILITY_MAX: 100,
  COEFFICIENT_MAX: 100,
});
