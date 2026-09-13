import { countsByStatus, criticalPortals, assistantsFree, activePortals } from '../domain/game.js';
import { riskBand, risk } from '../domain/portal.js';
import { vial } from './components.js';

function stagedEnergize(state, ui) {
  let total = 0;
  for (const portal of state.portals) {
    const pending = ui.pending[portal.id];
    if (pending?.energize) total += pending.energize;
  }
  return total;
}

function countHighRisk(state) {
  return state.portals.filter(
    (p) => p.status !== 'closed' && p.status !== 'collapsed' && ['high', 'critical'].includes(riskBand(risk(p))),
  ).length;
}

function countUnspent(state, ui) {
  return activePortals(state).filter((p) => {
    const pending = ui.pending[p.id];
    return !pending || (pending.action === 'review' && !(pending.energize > 0));
  }).length;
}

export function renderHud(state, ui) {
  const counts = countsByStatus(state);
  const critical = criticalPortals(state).length;
  const autoplayLabel = ui.autoplay ? '⏸ Пауза' : '▶ Авто';

  const staged = stagedEnergize(state, ui);
  const projectedPool = Math.max(0, state.energyPool - staged);
  const overBudget = staged > state.energyPool;
  const unspent = countUnspent(state, ui);
  const highRisk = countHighRisk(state);

  const poolValue = staged > 0
    ? `${Math.round(state.energyPool)} <span class="muted">→</span> <b class="num">${Math.round(projectedPool)}</b>`
    : `${Math.round(state.energyPool)}`;

  return `
    <div class="hud-stat"><span class="label">Очки</span><span class="value">${Math.round(state.score)}</span></div>
    <div class="hud-stat"><span class="label">Ход</span><span class="value">${state.tick}</span></div>
    <div class="hud-pool">
      ${vial(state.energyPool, { kind: 'pool', max: state.poolMax, title: 'Резерв лаборатории', preview: staged > 0 ? projectedPool : null })}
      <div class="hud-stat">
        <span class="label">Резерв лаборатории</span>
        <span class="value">${poolValue}<small class="muted"> / ${state.poolMax} · +45/ход</small></span>
      </div>
    </div>
    <div class="hud-stat"><span class="label">Гномы (свободно)</span><span class="value">${state.idleGnomes}</span></div>
    <div class="hud-stat"><span class="label">Ассистенты</span><span class="value">${assistantsFree(state)} / ${state.assistantsTotal}</span></div>
    <div class="hud-stat"><span class="label">Открыто · Критично</span><span class="value">${counts.open} · <span class="crit">${critical}</span></span></div>
    <div class="hud-spacer"></div>
    <div class="hud-actions">
      <span class="hud-flags">
        ${unspent > 0 ? `<span class="hud-flag warn" title="Порталов без действия: ${unspent}">⏳ ${unspent}</span>` : ''}
        ${highRisk > 0 ? `<span class="hud-flag danger" title="Порталов с высоким или критическим риском: ${highRisk}">⚠ ${highRisk}</span>` : ''}
      </span>
      <button class="btn ghost" data-act="autoplay">${autoplayLabel}</button>
      <select class="btn ghost" data-act="interval" aria-label="Интервал автовоспроизведения">
        ${[15, 30, 60].map((s) => `<option value="${s}" ${ui.interval === s ? 'selected' : ''}>${s} с</option>`).join('')}
      </select>
      <button class="btn primary" data-act="advance" ${overBudget ? 'disabled title="Приток энергии превышает резерв лаборатории"' : ''}>Следующий ход</button>
      <button class="btn ghost" data-act="new-game">Новая игра</button>
    </div>
  `;
}
