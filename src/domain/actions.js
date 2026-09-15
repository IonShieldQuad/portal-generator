import { CONFIG } from './constants.js';
import { clamp } from './util.js';
import { randInt, chance } from './rng.js';
import { getPortal, updatePortal, assistantsFree } from './game.js';
import { makeEntry, appendLog } from './log.js';
import {
  isActive,
  isCollapsing,
  isTerminal,
  throughput,
  risk,
  riskBand,
  injuryProbability,
} from './portal.js';

export const ActionId = Object.freeze({
  ENERGIZE: 'energize',
  STABILIZE: 'stabilize',
  TUNE: 'tune',
  ASSIGN_ASSISTANT: 'assignAssistant',
  UNASSIGN_ASSISTANT: 'unassignAssistant',
  SEND_IN: 'sendIn',
  SEND_OUT: 'sendOut',
  CLOSE: 'close',
  REVIEW: 'review',
});

// ---------------------------------------------------------------------------
// Actions — each is a pure object: { id, label, turnCost, isValid(ctx), apply(ctx) }
// ctx = { state, portal, params, config, rng }
// apply returns { state, entry, rng } and never mutates.
// ---------------------------------------------------------------------------

const energize = {
  id: ActionId.ENERGIZE,
  label: 'Энергизовать',
  turnCost: false,
  isValid({ state, portal, params }) {
    const amount = Number(params.amount ?? 0);
    if (isTerminal(portal)) return 'Портал недоступен';
    if (!Number.isFinite(amount) || amount <= 0) return 'Укажите количество энергии';
    if (amount > state.energyPool) return 'Недостаточно энергии в резерве лаборатории';
    if (portal.reserves + amount > CONFIG.RESERVES_MAX) return 'Резервы портала уже заполнены';
    return true;
  },
  apply({ state, portal, params }) {
    const amount = Number(params.amount);
    const withPortal = updatePortal(state, portal.id, (p) => ({
      ...p,
      reserves: clamp(p.reserves + amount, 0, CONFIG.RESERVES_MAX),
    }));
    return {
      state: { ...withPortal, energyPool: withPortal.energyPool - amount },
      entry: makeEntry(state, portal, ActionId.ENERGIZE, 'success', `Передано энергии: ${amount}`),
      rng: state.rng,
    };
  },
};

const stabilize = {
  id: ActionId.STABILIZE,
  label: 'Стабилизировать',
  turnCost: true,
  isValid({ state, portal }) {
    if (!isActive(portal) && !isCollapsing(portal)) return 'Портал недоступен';
    if (state.energyPool < CONFIG.STABILIZE_COST) return 'Недостаточно энергии для стабилизации';
    return true;
  },
  apply({ state, portal }) {
    const withPortal = updatePortal(state, portal.id, (p) => ({
      ...p,
      stability: clamp(p.stability + CONFIG.STABILIZE_GAIN, 0, CONFIG.STABILITY_MAX),
      decayBuffTurns: CONFIG.STABILIZE_BUFF_TURNS,
      status: p.status === 'collapsing' ? 'open' : p.status,
    }));
    return {
      state: { ...withPortal, energyPool: withPortal.energyPool - CONFIG.STABILIZE_COST },
      entry: makeEntry(state, portal, ActionId.STABILIZE, 'success', 'Портал стабилизирован'),
      rng: state.rng,
    };
  },
};

const tune = {
  id: ActionId.TUNE,
  label: 'Настроить коэффициент',
  turnCost: true,
  isValid({ portal, params }) {
    if (!isActive(portal)) return 'Портал недоступен';
    if (!CONFIG.TUNE_STEPS[params.step]) return 'Неверный шаг настройки';
    return true;
  },
  apply({ state, portal, params, rng }) {
    const { base, spread } = CONFIG.TUNE_STEPS[params.step];
    const spreadRoll = randInt(rng, -spread, spread);
    let r = spreadRoll.rng;
    let delta = base + spreadRoll.value;
    let message;
    const misfire = chance(r, CONFIG.TUNE_MISFIRE_CHANCE);
    r = misfire.rng;
    if (misfire.value) {
      const kind = chance(r, 0.5);
      r = kind.rng;
      if (kind.value) {
        delta *= 2;
        message = `Сбой настройки: изменение удвоено (${delta >= 0 ? '+' : ''}${delta})`;
      } else {
        delta = 0;
        message = 'Сбой настройки: без изменений';
      }
    } else {
      message = `Коэффициент изменён на ${delta >= 0 ? '+' : ''}${delta}`;
    }
    const coefficient = clamp(portal.coefficient + delta, 0, CONFIG.COEFFICIENT_MAX);
    const withPortal = updatePortal(state, portal.id, (p) => ({ ...p, coefficient }));
    return {
      state: withPortal,
      entry: makeEntry(state, portal, ActionId.TUNE, 'success', message),
      rng: r,
    };
  },
};

const assignAssistant = {
  id: ActionId.ASSIGN_ASSISTANT,
  label: 'Назначить ассистента',
  turnCost: true,
  isValid({ state, portal }) {
    if (!isActive(portal)) return 'Портал недоступен';
    if (portal.assistant) return 'У портала уже есть ассистент';
    if (assistantsFree(state) <= 0) return 'Нет свободных ассистентов';
    return true;
  },
  apply({ state, portal }) {
    const withPortal = updatePortal(state, portal.id, (p) => ({ ...p, assistant: true }));
    return {
      state: withPortal,
      entry: makeEntry(state, portal, ActionId.ASSIGN_ASSISTANT, 'success', 'Ассистент назначен'),
      rng: state.rng,
    };
  },
};

const unassignAssistant = {
  id: ActionId.UNASSIGN_ASSISTANT,
  label: 'Снять ассистента',
  turnCost: true,
  isValid({ portal }) {
    if (!isActive(portal)) return 'Портал недоступен';
    if (!portal.assistant) return 'У портала нет ассистента';
    return true;
  },
  apply({ state, portal }) {
    const withPortal = updatePortal(state, portal.id, (p) => ({ ...p, assistant: false }));
    return {
      state: withPortal,
      entry: makeEntry(state, portal, ActionId.UNASSIGN_ASSISTANT, 'success', 'Ассистент снят'),
      rng: state.rng,
    };
  },
};

// Gnomes are only hurt while passing through an overcharged portal.
function rollTransitInjuries(amount, portal, rng) {
  const probability = injuryProbability(portal);
  if (probability <= 0 || amount <= 0) return { injured: 0, rng };
  let r = rng;
  let injured = 0;
  for (let i = 0; i < amount; i += 1) {
    const roll = chance(r, probability);
    r = roll.rng;
    if (roll.value) injured += 1;
  }
  return { injured, rng: r };
}

const sendIn = {
  id: ActionId.SEND_IN,
  label: 'Отправить гномов',
  turnCost: true,
  isValid({ state, portal, params }) {
    const amount = Number(params.amount ?? 0);
    if (!isActive(portal)) return 'Портал недоступен';
    if (!Number.isFinite(amount) || amount <= 0) return 'Укажите количество гномов';
    if (amount > throughput(portal)) return 'Превышена пропускная способность';
    if (amount > state.idleGnomes) return 'Недостаточно свободных гномов';
    if (riskBand(risk(portal)) === 'critical') return 'Нельзя отправлять гномов в портал с критическим риском';
    return true;
  },
  apply({ state, portal, params, rng }) {
    const amount = Number(params.amount);
    const roll = rollTransitInjuries(amount, portal, rng);
    const arrived = amount - roll.injured;
    const penalty = roll.injured * CONFIG.INJURY_PENALTY;
    const withPortal = updatePortal(state, portal.id, (p) => ({ ...p, gnomes: p.gnomes + arrived }));
    return {
      state: {
        ...withPortal,
        idleGnomes: withPortal.idleGnomes - amount,
        score: withPortal.score - penalty,
      },
      entry: makeEntry(
        state,
        portal,
        ActionId.SEND_IN,
        'success',
        roll.injured > 0
          ? `Отправлено гномов: ${arrived}. Травмировано в переходе: ${roll.injured}`
          : `Отправлено гномов: ${arrived}`,
        -penalty,
        { loss: roll.injured > 0 },
      ),
      rng: roll.rng,
    };
  },
};

const sendOut = {
  id: ActionId.SEND_OUT,
  label: 'Вывести гномов',
  turnCost: true,
  isValid({ portal, params }) {
    const amount = Number(params.amount ?? 0);
    if (!isActive(portal) && !isCollapsing(portal)) return 'Портал недоступен';
    if (!Number.isFinite(amount) || amount <= 0) return 'Укажите количество гномов';
    if (amount > throughput(portal)) return 'Превышена пропускная способность';
    if (amount > portal.gnomes) return 'В портале нет столько гномов';
    return true;
  },
  apply({ state, portal, params, rng }) {
    const amount = Number(params.amount);
    const roll = rollTransitInjuries(amount, portal, rng);
    const returned = amount - roll.injured;
    const penalty = roll.injured * CONFIG.INJURY_PENALTY;
    const withPortal = updatePortal(state, portal.id, (p) => ({ ...p, gnomes: p.gnomes - amount }));
    return {
      state: {
        ...withPortal,
        idleGnomes: withPortal.idleGnomes + returned,
        score: withPortal.score - penalty,
      },
      entry: makeEntry(
        state,
        portal,
        ActionId.SEND_OUT,
        'success',
        roll.injured > 0
          ? `Выведено гномов: ${returned}. Травмировано в переходе: ${roll.injured}`
          : `Выведено гномов: ${returned}`,
        -penalty,
        { loss: roll.injured > 0 },
      ),
      rng: roll.rng,
    };
  },
};

const close = {
  id: ActionId.CLOSE,
  label: 'Закрыть портал',
  turnCost: true,
  isValid({ portal, params }) {
    if (!isActive(portal)) return 'Портал недоступен';
    if (portal.gnomes > 0 && params.confirm !== true) {
      return 'Внутри остались гномы. Требуется подтверждение';
    }
    return true;
  },
  apply({ state, portal }) {
    const stranded = portal.gnomes;
    const penalty = stranded * CONFIG.STRAND_PENALTY;
    const refund = Math.round(portal.reserves);
    const withPortal = updatePortal(state, portal.id, (p) => ({
      ...p,
      status: 'closed',
      gnomes: 0,
      gnomesLost: stranded,
      reserves: 0,
      assistant: false,
      actionUsed: true,
    }));
    const next = {
      ...withPortal,
      energyPool: Math.min(withPortal.poolMax, withPortal.energyPool + refund),
      score: withPortal.score - penalty,
    };
    const message =
      stranded > 0
        ? `Портал закрыт. Возвращено энергии: ${refund}. Оставлено гномов: ${stranded}`
        : `Портал закрыт. Возвращено энергии: ${refund}`;
    return {
      state: next,
      entry: makeEntry(state, portal, ActionId.CLOSE, 'success', message, -penalty, { loss: stranded > 0 }),
      rng: state.rng,
    };
  },
};

const review = {
  id: ActionId.REVIEW,
  label: 'Ожидать',
  turnCost: true,
  isValid({ portal }) {
    if (!isActive(portal)) return 'Портал недоступен';
    return true;
  },
  apply({ state, portal }) {
    return {
      state,
      entry: makeEntry(state, portal, ActionId.REVIEW, 'info', 'Портал оставлен без действий'),
      rng: state.rng,
    };
  },
};

export const REGISTRY = Object.freeze({
  [ActionId.ENERGIZE]: energize,
  [ActionId.STABILIZE]: stabilize,
  [ActionId.TUNE]: tune,
  [ActionId.ASSIGN_ASSISTANT]: assignAssistant,
  [ActionId.UNASSIGN_ASSISTANT]: unassignAssistant,
  [ActionId.SEND_IN]: sendIn,
  [ActionId.SEND_OUT]: sendOut,
  [ActionId.CLOSE]: close,
  [ActionId.REVIEW]: review,
});

export function canApply(state, portalId, actionId, params = {}) {
  const action = REGISTRY[actionId];
  if (!action) return { ok: false, reason: 'Неизвестное действие' };
  const portal = getPortal(state, portalId);
  if (!portal) return { ok: false, reason: 'Портал не найден' };
  if (action.turnCost && portal.actionUsed) {
    return { ok: false, reason: 'Действие уже использовано в этом ходу' };
  }
  const verdict = action.isValid({ state, portal, params, config: CONFIG });
  return verdict === true ? { ok: true } : { ok: false, reason: verdict };
}

export function applyAction(state, portalId, actionId, params = {}) {
  const portal = getPortal(state, portalId);
  const action = REGISTRY[actionId];

  if (!action || !portal) {
    const entry = makeEntry(state, portal, actionId, 'blocked', 'Неизвестное действие', 0);
    return { state: appendLog(state, entry), entry, ok: false };
  }

  const check = canApply(state, portalId, actionId, params);
  if (!check.ok) {
    const entry = makeEntry(state, portal, actionId, 'blocked', check.reason, 0);
    return { state: appendLog(state, entry), entry, ok: false };
  }

  const result = action.apply({ state, portal, params, config: CONFIG, rng: state.rng });
  let next = result.state;
  const nextRng = result.rng ?? state.rng;

  if (action.turnCost) {
    next = updatePortal(next, portalId, (p) => ({ ...p, actionUsed: true }));
  }

  next = { ...next, rng: nextRng };
  next = appendLog(next, result.entry);
  return { state: next, entry: result.entry, ok: true };
}
