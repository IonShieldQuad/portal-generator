import { CONFIG } from './constants.js';
import { clamp } from './util.js';
import { randInt } from './rng.js';
import { upkeep, stabilityDelta, coefficientDriftMax, scorePerGnome } from './portal.js';
import { makeEntry, appendEntries } from './log.js';
import { maybeSpawn } from './spawn.js';

// Resolve one turn. Pure: returns { state, entries }.
export function resolveTurn(state) {
  const entries = [];
  let rng = state.rng;
  let score = state.score;
  const portals = [];

  for (const original of state.portals) {
    if (original.status === 'closed' || original.status === 'collapsed') {
      portals.push(original);
      continue;
    }

    let portal = { ...original };

    // Resolve a collapse telegraph left from a previous turn.
    if (portal.status === 'collapsing') {
      if (portal.stability > 0) {
        portal.status = 'open';
      } else {
        const stranded = portal.gnomes;
        const penalty = stranded * CONFIG.STRAND_PENALTY;
        score -= penalty;
        entries.push(
          makeEntry(
            state,
            portal,
            'collapse',
            'info',
            stranded > 0 ? `Портал схлопнулся. Потеряно гномов: ${stranded}` : 'Портал схлопнулся',
            -penalty,
          ),
        );
        portals.push({
          ...portal,
          status: 'collapsed',
          gnomes: 0,
          reserves: 0,
          assistant: false,
          actionUsed: true,
        });
        continue;
      }
    }

    // Upkeep burns reserves.
    portal.reserves = clamp(portal.reserves - upkeep(portal), 0, CONFIG.RESERVES_MAX);

    // Stability relaxes toward its target.
    portal.stability = clamp(portal.stability + stabilityDelta(portal), 0, CONFIG.STABILITY_MAX);
    if (portal.decayBuffTurns > 0) portal.decayBuffTurns -= 1;

    // Income from gnomes on the far side; longer portals pay more per gnome.
    score += Math.round(portal.gnomes * scorePerGnome(portal));

    // Collapse telegraph: give the player one turn to react.
    if (portal.status !== 'collapsing' && portal.stability <= 0) {
      portal.status = 'collapsing';
      entries.push(makeEntry(state, portal, 'collapsing', 'info', 'Портал начал схлопываться', 0));
    }

    // Coefficient drift: the portal wanders on its own, more so when unstable.
    const driftMax = coefficientDriftMax(portal.stability);
    if (driftMax > 0) {
      const drift = randInt(rng, -driftMax, driftMax);
      rng = drift.rng;
      portal.coefficient = clamp(portal.coefficient + drift.value, 0, CONFIG.COEFFICIENT_MAX);
    }

    portals.push(portal);
  }

  let next = { ...state, portals, score, rng };

  // Spawning.
  const spawned = maybeSpawn(next);
  next = spawned.state;
  entries.push(...spawned.entries);

  // Pool recharge.
  next = { ...next, energyPool: Math.min(next.poolMax, next.energyPool + CONFIG.POOL_RECHARGE) };

  // Advance the turn and reset per-turn action flags.
  next = {
    ...next,
    tick: next.tick + 1,
    portals: next.portals.map((p) => (p.actionUsed ? { ...p, actionUsed: false } : p)),
  };

  next = appendEntries(next, entries);
  return { state: next, entries };
}
