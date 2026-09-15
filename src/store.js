import { createSeededGame } from './domain/seed.js';
import { createGameState } from './domain/game.js';
import { createPortal } from './domain/portal.js';
import { resolveTurn } from './domain/sim.js';
import { applyAction, canApply, ActionId } from './domain/actions.js';
import { getPortal } from './domain/game.js';
import { isActive, risk, injuryProbability } from './domain/portal.js';
import { CONFIG } from './domain/constants.js';
import { loadState, saveState, clearState } from './storage.js';

function randomSeed() {
  const fromUrl = Number(new URLSearchParams(location.search).get('seed'));
  if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl;
  return Math.floor(Math.random() * 1e9) || 1;
}

function onboardingSeen() {
  try {
    return localStorage.getItem('portal-lab:onboarding:v1') === '1';
  } catch {
    return true;
  }
}

function markOnboardingSeen() {
  try {
    localStorage.setItem('portal-lab:onboarding:v1', '1');
  } catch {
    /* ignore */
  }
}

const DEFAULT_PENDING = Object.freeze({ action: ActionId.REVIEW, params: {}, energize: 0 });

const PREVIEW_NOTES = {
  [ActionId.STABILIZE]: 'Стабильность вырастет, распад замедлится на 3 хода.',
  [ActionId.ASSIGN_ASSISTANT]: 'Ассистент снизит расход энергии и замедлит распад.',
  [ActionId.UNASSIGN_ASSISTANT]: 'Ассистент будет освобождён.',
  [ActionId.CLOSE]: 'Портал будет закрыт, гномы внутри погибнут.',
};

// Preset scenarios for the verification checklist.
const PRESETS = {
  critical: () => createGameState(101, {
    energyPool: 200,
    idleGnomes: 30,
    portals: [createPortal({ id: 'p1', name: 'Портал «Пепел»', destinationWorld: 'Пепельная пустошь', distance: 5, coefficient: 100, stability: 5, reserves: 10, gnomes: 0 })],
  }),
  empty: () => createGameState(102, { energyPool: 200, idleGnomes: 30, portals: [] }),
  forbidden: () => createGameState(103, {
    energyPool: 200,
    idleGnomes: 30,
    portals: [
      createPortal({ id: 'p1', name: 'Портал «Сумрак»', status: 'closed', distance: 5, coefficient: 55, stability: 40, reserves: 0 }),
      createPortal({ id: 'p2', name: 'Портал «Эхо»', destinationWorld: 'Лунный архипелаг', distance: 3, coefficient: 49, stability: 60, reserves: 50, gnomes: 5 }),
    ],
  }),
  'no-throughput': () => createGameState(104, {
    energyPool: 200,
    idleGnomes: 0,
    portals: [createPortal({ id: 'p1', name: 'Портал «Вихрь»', destinationWorld: 'Огненные пустоши', distance: 5, coefficient: 30, stability: 60, reserves: 60, gnomes: 6 })],
  }),
};

export function createStore(initialState) {
  const loaded = initialState ? { state: initialState, corrupt: false } : loadState();
  let state = loaded.state ?? createSeededGame(randomSeed());
  if (!initialState && loaded.corrupt) saveState(state);
  let ui = {
    tab: 'portals',
    pending: {},
    detailPortalId: null,
    warning: null,
    toast: null,
    autoplay: false,
    interval: 30,
    skipWarning: false,
    onboardingOpen: !onboardingSeen(),
    loadError: loaded.corrupt,
  };
  const listeners = new Set();
  let timer = null;
  let toastTimer = null;

  function notify() {
    for (const listener of listeners) listener();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  const getState = () => state;
  const getUi = () => ui;

  function getPending(portalId) {
    return ui.pending[portalId] ?? DEFAULT_PENDING;
  }

  // -------------------------------------------------------------------------
  // Staged actions
  // -------------------------------------------------------------------------

  function selectAction(portalId, actionId, params = {}, { toggle = true } = {}) {
    const current = getPending(portalId);
    const sameParams = JSON.stringify(current.params ?? {}) === JSON.stringify(params ?? {});
    let nextAction = actionId;
    if (toggle && current.action === actionId && sameParams) nextAction = ActionId.REVIEW;
    ui = {
      ...ui,
      pending: {
        ...ui.pending,
        [portalId]: {
          action: nextAction,
          params: nextAction === ActionId.REVIEW ? {} : params,
          energize: current.energize,
        },
      },
    };
    notify();
  }

  function maxEnergize(portalId) {
    const portal = getPortal(state, portalId);
    if (!portal) return 0;
    const room = Math.floor(CONFIG.RESERVES_MAX - portal.reserves);
    return Math.max(0, Math.min(Math.floor(state.energyPool), room));
  }

  function selectEnergize(portalId, amount, { silent = false } = {}) {
    const current = getPending(portalId);
    const clamped = Math.max(0, Math.min(Math.round(amount), maxEnergize(portalId)));
    ui = {
      ...ui,
      pending: {
        ...ui.pending,
        [portalId]: { ...current, energize: clamped },
      },
    };
    if (!silent) notify();
  }

  // Immediately attempt an action that is not offered normally (e.g. on a
  // terminal portal). A failed attempt is logged with result: blocked and
  // surfaced as a toast; state is otherwise untouched.
  function attemptAction(portalId, actionId, params = {}) {
    const result = applyAction(state, portalId, actionId, params);
    if (result.ok) return;
    state = result.state;
    ui = { ...ui, toast: { kind: 'warn', message: result.entry.message, duration: 4000 } };
    saveState(state);
    scheduleToastClear();
    notify();
  }

  // Preview reuses the pure action apply on a throwaway copy.
  function preview(portalId) {
    const pending = getPending(portalId);
    if (pending.action === ActionId.REVIEW && pending.energize <= 0) return null;

    const baseline = getPortal(state, portalId);
    const poolBefore = state.energyPool;
    let s = state;
    if (pending.energize > 0) {
      const check = canApply(s, portalId, ActionId.ENERGIZE, { amount: pending.energize });
      if (!check.ok) return { blocked: check.reason };
      s = applyAction(s, portalId, ActionId.ENERGIZE, { amount: pending.energize }).state;
    }
    const poolAfter = s.energyPool;
    const energized = getPortal(s, portalId);

    // Tune is random: show the expected value with an error bar, not a fake exact.
    if (pending.action === ActionId.TUNE) {
      const step = CONFIG.TUNE_STEPS[pending.params?.step];
      if (!step) return { blocked: 'Неверный шаг настройки' };
      const coefficientPreview = Math.max(0, Math.min(100, baseline.coefficient + step.base));
      return {
        before: baseline,
        after: energized,
        riskBefore: risk(baseline),
        riskAfter: risk(energized),
        coefficientPreview,
        coefficientRange: step.spread,
        poolBefore,
        poolAfter,
      };
    }

    // Transit through an overcharged portal can injure gnomes. Show the expected
    // (deterministic) outcome and the capped injury chance, never a sampled roll.
    if (pending.action === ActionId.SEND_IN || pending.action === ActionId.SEND_OUT) {
      const amount = Number(pending.params?.amount ?? 0);
      const probability = injuryProbability(baseline);
      if (probability > 0 && amount > 0) {
        const arrived = amount - Math.round(amount * probability);
        const after = pending.action === ActionId.SEND_IN
          ? { ...energized, gnomes: energized.gnomes + arrived }
          : { ...energized, gnomes: energized.gnomes - amount };
        return {
          before: baseline,
          after,
          riskBefore: risk(baseline),
          riskAfter: risk(after),
          poolBefore,
          poolAfter,
          note: `Риск травм в переходе: ${Math.round(probability * 100)}% на гнома (ожидается ~${arrived} из ${amount}).`,
        };
      }
    }

    let note = '';
    if (pending.action !== ActionId.REVIEW) {
      const check = canApply(s, portalId, pending.action, pending.params);
      if (!check.ok) return { blocked: check.reason };
      s = applyAction(s, portalId, pending.action, pending.params).state;
      note = PREVIEW_NOTES[pending.action] ?? '';
    }

    const after = getPortal(s, portalId);
    return { before: baseline, after, riskBefore: risk(baseline), riskAfter: risk(after), note, poolBefore, poolAfter };
  }

  // -------------------------------------------------------------------------
  // Turn flow
  // -------------------------------------------------------------------------

  function unselectedPortals() {
    return state.portals
      .filter(isActive)
      .filter((p) => {
        const pending = getPending(p.id);
        return pending.action === ActionId.REVIEW && pending.energize <= 0;
      })
      .map((p) => p.id);
  }

  function buildSummary(before, after, entries) {
    return {
      tick: after.tick,
      scoreDelta: after.score - before.score,
      collapsed: entries.filter((e) => e.action === 'collapse'),
      spawned: entries.filter((e) => e.action === 'spawn'),
      injuries: entries.filter((e) => e.action === 'injury'),
      events: entries,
    };
  }

  function summaryToast(summary) {
    const parts = [`Ход ${summary.tick}`, `Очки ${summary.scoreDelta >= 0 ? '+' : ''}${summary.scoreDelta}`];
    if (summary.collapsed.length) parts.push(`Схлопнулось: ${summary.collapsed.length}`);
    if (summary.spawned.length) parts.push(`Новые: ${summary.spawned.length}`);
    if (summary.injuries.length) parts.push(`Травмы: ${summary.injuries.length}`);
    return {
      kind: 'info',
      message: parts.join(' · '),
      action: 'log',
      actionLabel: 'Журнал',
      duration: 8000,
    };
  }

  function commit({ auto = false } = {}) {
    let s = state;
    const blocked = [];
    for (const portal of state.portals) {
      const pending = ui.pending[portal.id];
      if (!pending) continue;
      if (pending.energize > 0) {
        const result = applyAction(s, portal.id, ActionId.ENERGIZE, { amount: pending.energize });
        s = result.state;
        if (!result.ok) blocked.push(result.entry.message);
      }
      const actionId = pending.action ?? ActionId.REVIEW;
      const result = applyAction(s, portal.id, actionId, pending.params ?? {});
      s = result.state;
      if (!result.ok) blocked.push(result.entry.message);
    }

    const before = s;
    const resolved = resolveTurn(s);
    state = resolved.state;
    const summary = buildSummary(before, resolved.state, resolved.entries);
    ui = {
      ...ui,
      pending: {},
      warning: null,
      detailPortalId: ui.detailPortalId,
      toast: blocked.length
        ? { kind: 'warn', message: blocked[0], duration: 5000 }
        : auto
          ? ui.toast
          : summaryToast(summary),
    };
    saveState(state);
    scheduleToastClear();
    notify();
  }

  function blockerFor(portal, reason) {
    return {
      portalId: portal.id,
      portalName: portal.name,
      reason,
      kind: reason.includes('энерг') ? 'energy' : 'other',
    };
  }

  // Replay the staged turn on a throwaway copy to find any action that would fail.
  function commitBlockers() {
    let s = state;
    const blocked = [];
    for (const portal of state.portals) {
      const pending = ui.pending[portal.id];
      if (!pending) continue;
      if (pending.energize > 0) {
        const result = applyAction(s, portal.id, ActionId.ENERGIZE, { amount: pending.energize });
        if (!result.ok) blocked.push(blockerFor(portal, result.entry.message));
        s = result.state;
      }
      const actionId = pending.action ?? ActionId.REVIEW;
      const result = applyAction(s, portal.id, actionId, pending.params ?? {});
      if (!result.ok) blocked.push(blockerFor(portal, result.entry.message));
      s = result.state;
    }
    return blocked;
  }

  function advanceTurn() {
    const blockers = commitBlockers();
    if (blockers.length > 0) {
      showToast(`${blockers[0].portalName}: ${blockers[0].reason}`, 'warn', { duration: 4000 });
      return;
    }
    if (!ui.skipWarning) {
      const ids = unselectedPortals();
      if (ids.length > 0) {
        ui = { ...ui, warning: { portalIds: ids } };
        notify();
        return;
      }
    }
    commit();
  }

  function confirmAdvance() {
    const blockers = commitBlockers();
    if (blockers.length > 0) {
      ui = { ...ui, warning: null };
      showToast(`${blockers[0].portalName}: ${blockers[0].reason}`, 'warn', { duration: 4000 });
      notify();
      return;
    }
    ui = { ...ui, warning: null };
    commit();
  }

  function cancelAdvance() {
    ui = { ...ui, warning: null };
    notify();
  }

  function toggleSkipWarning(value) {
    ui = { ...ui, skipWarning: value ?? !ui.skipWarning };
    notify();
  }

  // -------------------------------------------------------------------------
  // Autoplay
  // -------------------------------------------------------------------------

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      if (ui.detailPortalId || ui.warning) return;
      commit({ auto: true });
    }, ui.interval * 1000);
  }

  function toggleAutoplay() {
    ui = { ...ui, autoplay: !ui.autoplay };
    if (ui.autoplay) startTimer();
    else stopTimer();
    notify();
  }

  function setAutoplayInterval(seconds) {
    ui = { ...ui, interval: seconds };
    if (ui.autoplay) startTimer();
    notify();
  }

  // -------------------------------------------------------------------------
  // UI helpers
  // -------------------------------------------------------------------------

  function setTab(tab) {
    ui = { ...ui, tab };
    notify();
  }

  function openDetail(portalId) {
    ui = { ...ui, detailPortalId: portalId };
    notify();
  }

  function closeDetail() {
    ui = { ...ui, detailPortalId: null };
    notify();
  }

  function dismissToast() {
    if (toastTimer) clearTimeout(toastTimer);
    ui = { ...ui, toast: null };
    notify();
  }

  function dismissLoadError() {
    ui = { ...ui, loadError: false };
    notify();
  }

  function showToast(message, kind = 'info', opts = {}) {
    ui = { ...ui, toast: { message, kind, ...opts } };
    scheduleToastClear();
    notify();
  }

  function scheduleToastClear() {
    if (toastTimer) clearTimeout(toastTimer);
    const duration = ui.toast?.duration ?? 3500;
    toastTimer = setTimeout(() => {
      ui = { ...ui, toast: null };
      notify();
    }, duration);
  }

  function openOnboarding() {
    ui = { ...ui, onboardingOpen: true };
    notify();
  }

  function closeOnboarding() {
    markOnboardingSeen();
    ui = { ...ui, onboardingOpen: false };
    notify();
  }

  function loadPreset(name) {
    const factory = PRESETS[name];
    if (!factory) return;
    state = factory();
    ui = { ...ui, pending: {}, detailPortalId: null, warning: null, toast: { kind: 'info', message: 'Загружен пресет' } };
    saveState(state);
    scheduleToastClear();
    notify();
  }

  function newGame() {
    stopTimer();
    clearState();
    state = createSeededGame(randomSeed());
    ui = {
      tab: 'portals',
      pending: {},
      detailPortalId: null,
      warning: null,
      toast: { kind: 'info', message: 'Новая игра начата' },
      autoplay: false,
      interval: 30,
      skipWarning: false,
    };
    saveState(state);
    scheduleToastClear();
    notify();
  }

  return {
    subscribe,
    getState,
    getUi,
    getPending,
    maxEnergize,
    commitBlockers,
    preview,
    selectAction,
    selectEnergize,
    attemptAction,
    advanceTurn,
    confirmAdvance,
    cancelAdvance,
    toggleSkipWarning,
    toggleAutoplay,
    setAutoplayInterval,
    setTab,
    openDetail,
    closeDetail,
    dismissToast,
    dismissLoadError,
    showToast,
    openOnboarding,
    closeOnboarding,
    loadPreset,
    newGame,
  };
}
