import { CONFIG } from './constants.js';
import { createRng } from './rng.js';
import { risk, riskBand } from './portal.js';

// ---------------------------------------------------------------------------
// World state
// ---------------------------------------------------------------------------

export function createGameState(seed = 1, overrides = {}) {
  return {
    version: 1,
    tick: 0,
    score: overrides.score ?? 0,
    energyPool: overrides.energyPool ?? CONFIG.POOL_START,
    poolMax: overrides.poolMax ?? CONFIG.POOL_MAX,
    idleGnomes: overrides.idleGnomes ?? CONFIG.START_GNOMES,
    assistantsTotal: overrides.assistantsTotal ?? CONFIG.ASSISTANTS_TOTAL,
    portals: overrides.portals ?? [],
    rng: overrides.rng ?? createRng(seed),
    log: overrides.log ?? [],
    settings: {
      autoplay: false,
      interval: 5,
      onboardingSeen: false,
      ...(overrides.settings ?? {}),
    },
  };
}

export function getPortal(state, id) {
  return state.portals.find((p) => p.id === id) ?? null;
}

export function updatePortal(state, id, updater) {
  return {
    ...state,
    portals: state.portals.map((p) => (p.id === id ? updater(p) : p)),
  };
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function activePortals(state) {
  return state.portals.filter((p) => p.status === 'open');
}

export function collapsingPortals(state) {
  return state.portals.filter((p) => p.status === 'collapsing');
}

export function terminalPortals(state) {
  return state.portals.filter((p) => p.status === 'closed' || p.status === 'collapsed');
}

export function criticalPortals(state) {
  return state.portals.filter(
    (p) => p.status !== 'closed' && p.status !== 'collapsed' && riskBand(risk(p)) === 'critical',
  );
}

export function countsByStatus(state) {
  const counts = { open: 0, collapsing: 0, closed: 0, collapsed: 0 };
  for (const p of state.portals) counts[p.status] = (counts[p.status] ?? 0) + 1;
  return counts;
}

export function assistantsAssigned(state) {
  return state.portals.filter((p) => p.assistant).length;
}

export function assistantsFree(state) {
  return state.assistantsTotal - assistantsAssigned(state);
}

function attentionScore(portal) {
  const base = risk(portal);
  const urgency = portal.status === 'collapsing' ? 100 : 0;
  return base + urgency;
}

export function needsAttention(state) {
  return state.portals
    .filter((p) => p.status !== 'closed' && p.status !== 'collapsed')
    .slice()
    .sort((a, b) => attentionScore(b) - attentionScore(a));
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

export function validateState(state) {
  const problems = [];
  for (const p of state.portals) {
    if (p.stability < 0 || p.stability > CONFIG.STABILITY_MAX) problems.push(`${p.id}: stability out of range`);
    if (p.reserves < 0 || p.reserves > CONFIG.RESERVES_MAX) problems.push(`${p.id}: reserves out of range`);
    if (p.coefficient < 0 || p.coefficient > CONFIG.COEFFICIENT_MAX) problems.push(`${p.id}: coefficient out of range`);
    if (p.gnomes < 0) problems.push(`${p.id}: negative gnomes`);
  }
  if (state.idleGnomes < 0) problems.push('idleGnomes negative');
  if (state.energyPool < 0 || state.energyPool > state.poolMax) problems.push('energyPool out of range');
  if (assistantsAssigned(state) > state.assistantsTotal) problems.push('too many assistants assigned');
  return problems;
}
