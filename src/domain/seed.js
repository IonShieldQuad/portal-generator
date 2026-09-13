import { createGameState } from './game.js';
import { spawnPortal } from './spawn.js';

// Build a fresh game with a few already-open portals.
export function createSeededGame(seed = 1, initialPortals = 3) {
  let state = createGameState(seed);
  for (let i = 0; i < initialPortals; i += 1) {
    const { portal, rng } = spawnPortal(state, state.rng);
    state = { ...state, portals: [...state.portals, portal], rng };
  }
  return state;
}
