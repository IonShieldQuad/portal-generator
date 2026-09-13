import { CONFIG } from './constants.js';
import { clamp } from './util.js';
import { randInt, chance } from './rng.js';
import { createPortal } from './portal.js';
import { activePortals } from './game.js';
import { makeEntry } from './log.js';

const WORLDS = [
  'Изумрудный лес',
  'Пепельная пустошь',
  'Лунный архипелаг',
  'Кристальные пещеры',
  'Затонувший город',
  'Огненные пустоши',
  'Туманные топи',
  'Звёздная крепость',
  'Ледяные пики',
  'Шёпот-долина',
];

const NAME_PARTS = [
  'Шёпот',
  'Разлом',
  'Мерцание',
  'Бездна',
  'Эхо',
  'Вихрь',
  'Пелена',
  'Искра',
  'Сумрак',
  'Прилив',
];

export function spawnProbability(state) {
  const active = activePortals(state).length;
  const headroom = clamp((CONFIG.SPAWN_SOFTCAP - active) / CONFIG.SPAWN_SOFTCAP, 0, 1);
  const momentum = clamp(state.score / CONFIG.SCORE_REF, 0, 2);
  const probability = CONFIG.SPAWN_BASE * (0.5 + 0.5 * momentum) * headroom;
  return Math.min(probability, CONFIG.SPAWN_MAX);
}

export function shouldSpawn(state, rng) {
  const probability = spawnProbability(state);
  if (probability <= 0) return { value: false, rng };
  return chance(rng, probability);
}

export function nextPortalId(state) {
  return `p${state.portals.length + 1}`;
}

export function spawnPortal(state, rng) {
  let r = rng;
  const distance = randInt(r, CONFIG.DISTANCE_MIN, CONFIG.DISTANCE_MAX);
  r = distance.rng;
  const coefficient = randInt(r, CONFIG.SPAWN_COEFF_MIN, CONFIG.SPAWN_COEFF_MAX);
  r = coefficient.rng;
  const stability = randInt(r, CONFIG.SPAWN_STABILITY_MIN, CONFIG.SPAWN_STABILITY_MAX);
  r = stability.rng;
  const reserves = randInt(r, CONFIG.SPAWN_RESERVES_MIN, CONFIG.SPAWN_RESERVES_MAX);
  r = reserves.rng;
  const gnomes = randInt(r, CONFIG.SPAWN_GNOMES_MIN, CONFIG.SPAWN_GNOMES_MAX);
  r = gnomes.rng;
  const world = randInt(r, 0, WORLDS.length - 1);
  r = world.rng;
  const namePart = randInt(r, 0, NAME_PARTS.length - 1);
  r = namePart.rng;

  const id = nextPortalId(state);
  const portal = createPortal({
    id,
    name: `Портал «${NAME_PARTS[namePart.value]}» №${id.slice(1)}`,
    destinationWorld: WORLDS[world.value],
    distance: distance.value,
    coefficient: coefficient.value,
    stability: stability.value,
    reserves: reserves.value,
    gnomes: gnomes.value,
    status: 'open',
  });

  return { portal, rng: r };
}

export function maybeSpawn(state) {
  const entries = [];
  const roll = shouldSpawn(state, state.rng);
  let next = { ...state, rng: roll.rng };
  if (!roll.value) return { state: next, entries };

  const spawned = spawnPortal(next, next.rng);
  next = { ...next, portals: [...next.portals, spawned.portal], rng: spawned.rng };
  entries.push(
    makeEntry(next, spawned.portal, 'spawn', 'info', `Открылся новый портал: ${spawned.portal.name}`, 0),
  );
  return { state: next, entries };
}
