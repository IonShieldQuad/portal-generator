import { riskBreakdown, throughput, predictedTimeToCollapse, risk } from '../domain/portal.js';
import { portalHistory } from '../domain/log.js';
import { canApply, ActionId } from '../domain/actions.js';
import { visualState, BAND_LABEL, STATUS_LABEL } from './visual.js';
import { TIP } from './tooltips.js';
import {
  esc,
  num,
  badge,
  bandGauge,
  radialGauge,
  crystalColumn,
  vial,
  pipRow,
  slider,
  actionButton,
  collapseChip,
} from './components.js';

function proj(label, a, b) {
  const changed = Math.abs(a - b) >= 0.5;
  return `<span class="proj ${changed ? 'changed' : ''}">${label} ${num(a)} → ${num(b)}</span>`;
}

export function renderDetail(state, ui, store) {
  const portal = state.portals.find((p) => p.id === ui.detailPortalId);
  if (!portal) return null;
  const v = visualState(portal);
  const breakdown = riskBreakdown(portal);
  const history = portalHistory(state, portal.id).slice(-20).reverse();
  const pending = store.getPending(portal.id);
  const preview = store.preview(portal.id);
  const projected = preview && !preview.blocked ? preview.after : null;
  const projectedRisk = preview && !preview.blocked ? preview.riskAfter : null;
  const coefficientPreview = preview && !preview.blocked
    ? (preview.coefficientPreview ?? (preview.after ? preview.after.coefficient : null))
    : null;
  const coefficientRange = preview && !preview.blocked ? (preview.coefficientRange ?? 0) : 0;
  const terminal = portal.status === 'closed' || portal.status === 'collapsed';
  const capacity = throughput(portal);
  const check = (id, params = {}) => canApply(state, portal.id, id, params);
  const assistant = portal.assistant;
  const energizeMax = store.maxEnergize(portal.id);

  const part = (label, value) => `
    <div class="risk-part">
      <span class="muted">${label}</span>
      <span class="risk-bar"><i style="width:${Math.min(100, value)}%"></i></span>
      ${num(value)}
    </div>`;

  const tuneBtn = (step, label) => actionButton(portal.id, ActionId.TUNE, label, {
    selected: pending.action === ActionId.TUNE && pending.params?.step === step,
    params: { step },
    disabled: terminal || !check(ActionId.TUNE, { step }).ok,
    reason: check(ActionId.TUNE, { step }).reason,
    tooltip: TIP.tune,
  });

  const sendInMax = Math.min(capacity, state.idleGnomes);
  const sendOutMax = Math.min(capacity, portal.gnomes);
  const sendInSel = pending.action === ActionId.SEND_IN;
  const sendOutSel = pending.action === ActionId.SEND_OUT;

  const actions = terminal
    ? '<p class="muted">Портал закрыт — действия недоступны.</p>'
    : `
      <div class="action-table">
        <span class="at-label">Ресурсы</span>
        <div class="at-cell">
          <div class="inline-control"><span class="muted">Приток энергии</span>${slider(portal.id, Math.min(pending.energize, energizeMax), energizeMax, TIP.energize)}</div>
          ${actionButton(portal.id, ActionId.STABILIZE, 'Стабилизировать', {
            selected: pending.action === ActionId.STABILIZE,
            disabled: !check(ActionId.STABILIZE).ok,
            reason: check(ActionId.STABILIZE).reason,
            tooltip: TIP.stabilize,
          })}
        </div>
        <span class="at-label">Настройка</span>
        <div class="at-cell">
          <div class="segmented" title="${esc(TIP.tune)}">
            <span class="muted">Коэффициент</span>
            ${tuneBtn('--', '−−')}${tuneBtn('-', '−')}${tuneBtn('+', '+')}${tuneBtn('++', '++')}
          </div>
        </div>
        <span class="at-label">Персонал</span>
        <div class="at-cell">
          ${actionButton(portal.id, ActionId.SEND_IN, 'Отправить', {
            selected: sendInSel,
            params: { amount: sendInSel ? (pending.params?.amount ?? 1) : 1 },
            disabled: !check(ActionId.SEND_IN, { amount: 1 }).ok,
            reason: check(ActionId.SEND_IN, { amount: 1 }).reason,
            tooltip: TIP.sendIn(sendInMax),
          })}
          ${actionButton(portal.id, ActionId.SEND_OUT, 'Вывести', {
            selected: sendOutSel,
            params: { amount: sendOutSel ? (pending.params?.amount ?? 1) : 1 },
            disabled: !check(ActionId.SEND_OUT, { amount: 1 }).ok,
            reason: check(ActionId.SEND_OUT, { amount: 1 }).reason,
            tooltip: TIP.sendOut(sendOutMax),
          })}
          ${actionButton(portal.id, assistant ? ActionId.UNASSIGN_ASSISTANT : ActionId.ASSIGN_ASSISTANT,
            assistant ? 'Снять ассистента' : 'Назначить ассистента', {
              selected: pending.action === (assistant ? ActionId.UNASSIGN_ASSISTANT : ActionId.ASSIGN_ASSISTANT),
              disabled: !check(assistant ? ActionId.UNASSIGN_ASSISTANT : ActionId.ASSIGN_ASSISTANT).ok,
              reason: check(assistant ? ActionId.UNASSIGN_ASSISTANT : ActionId.ASSIGN_ASSISTANT).reason,
              tooltip: assistant ? TIP.unassign : TIP.assign,
            })}
          ${sendInSel || sendOutSel
            ? `<div class="row-extra"><span class="muted">Количество:</span>
                ${pipRow(portal.id, pending.params?.amount ?? 0, sendInSel ? sendInMax : sendOutMax, pending.action)}</div>`
            : ''}
        </div>
        <span class="at-label">Прочее</span>
        <div class="at-cell">
          ${actionButton(portal.id, ActionId.REVIEW, 'Ожидать', {
            selected: pending.action === ActionId.REVIEW,
            disabled: !check(ActionId.REVIEW).ok,
            reason: check(ActionId.REVIEW).reason,
            tooltip: TIP.review,
          })}
          ${actionButton(portal.id, ActionId.CLOSE, 'Закрыть', {
            selected: pending.action === ActionId.CLOSE,
            disabled: !check(ActionId.CLOSE, { confirm: true }).ok,
            reason: check(ActionId.CLOSE, { confirm: true }).reason,
            variant: 'danger',
            tooltip: TIP.close,
          })}
        </div>
      </div>`;

  const previewBlock = preview && !preview.blocked
    ? `<div class="row-preview">
        ${proj('Стабильность', preview.before.stability, preview.after.stability)}
        ${proj('Энергия', preview.before.reserves, preview.after.reserves)}
        ${coefficientPreview != null
          ? `<span class="proj changed">Коэф. ${num(preview.before.coefficient)} → ${num(coefficientPreview)} ±${coefficientRange}</span>`
          : proj('Коэф.', preview.before.coefficient, preview.after.coefficient)}
        ${proj('Гномы', preview.before.gnomes, preview.after.gnomes)}
        ${proj('Риск', preview.riskBefore, preview.riskAfter)}
        ${preview.poolAfter != null && preview.poolAfter !== preview.poolBefore ? proj('Пул', preview.poolBefore, preview.poolAfter) : ''}
      </div>`
    : '';

  return {
    title: portal.name,
    body: `
      <div class="row-badges">
        ${badge(STATUS_LABEL[portal.status], `status-${portal.status}`)}
        ${badge(`риск ${v.risk} · ${BAND_LABEL[v.band]}`, `band-${v.band}`)}
      </div>
      <p class="muted">${esc(portal.destinationWorld)} · дистанция ${num(portal.distance)} · ${collapseChip(v.timeToCollapse, v.urgency)}</p>

      <div class="detail-portal">
        <canvas class="portal-canvas" width="180" height="180" aria-label="Анимация портала"></canvas>
        <div class="detail-gauges">
          ${vial(portal.reserves, { kind: 'mana', title: 'Энергия', preview: projected ? projected.reserves : null })}
          ${crystalColumn(portal.stability, { preview: projected ? projected.stability : null })}
          <div style="flex:1">
            ${bandGauge(portal.coefficient, v.coefficientOptimum, v.coefficientSafe, { preview: coefficientPreview, previewRange: coefficientRange })}
            <p class="muted" style="margin:6px 0 0">Коэффициент Мерлина ${num(portal.coefficient)} · оптимум ${num(v.coefficientOptimum)}</p>
          </div>
          ${radialGauge(v.risk, v.band, { preview: projectedRisk })}
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-stat"><span class="muted">Стабильность/ход</span>${num(v.stabilityDelta)}</div>
        <div class="detail-stat"><span class="muted">Энергия/ход</span>${num(-v.upkeep)}</div>
        <div class="detail-stat"><span class="muted">гномов/ход</span>${num(capacity)}</div>
        <div class="detail-stat"><span class="muted">Гномов внутри</span>${num(portal.gnomes)}</div>
        <div class="detail-stat"><span class="muted">Ассистент</span><b>${assistant ? 'да' : 'нет'}</b></div>
        <div class="detail-stat"><span class="muted">До схлопывания</span>${num(predictedTimeToCollapse(portal))}</div>
      </div>

      <h2>Действия</h2>
      ${previewBlock}
      ${preview && preview.blocked ? `<p class="delta down">Недоступно: ${esc(preview.blocked)}</p>` : ''}
      ${actions}

      <h2>Расчёт риска</h2>
      <p class="muted">risk = 0.35·стабильность + 0.25·коэф + 0.20·резервы + 0.20·время</p>
      <div class="risk-parts">
        ${part('Нестабильность (35%)', breakdown.rS)}
        ${part('Отклонение коэф. (25%)', breakdown.rC)}
        ${part('Нехватка энергии (20%)', breakdown.rR)}
        ${part('Мало времени (20%)', breakdown.rT)}
      </div>
      <p>Итоговый риск: ${num(breakdown.risk)} (${BAND_LABEL[breakdown.band]})</p>

      <h2>История</h2>
      <ul class="history">
        ${history.length
          ? history.map((e) => `<li>Ход ${e.tick}: ${esc(e.message)}${e.result === 'blocked' ? ' <span class="muted">(заблокировано)</span>' : ''}</li>`).join('')
          : '<li class="muted">Изменений пока не было.</li>'}
      </ul>
    `,
  };
}
