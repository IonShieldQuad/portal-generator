import { canApply, ActionId } from '../domain/actions.js';
import { throughput, risk } from '../domain/portal.js';
import { visualState, BAND_LABEL, STATUS_LABEL } from './visual.js';
import { TIP } from './tooltips.js';
import {
  esc,
  num,
  badge,
  vial,
  crystalColumn,
  bandGauge,
  radialGauge,
  pipRow,
  slider,
  actionButton,
  collapseChip,
  portalImage,
  gnomePips,
} from './components.js';

function proj(label, a, b) {
  const changed = Math.abs(a - b) >= 0.5;
  return `<span class="proj ${changed ? 'changed' : ''}">${label} ${num(a)} → ${num(b)}</span>`;
}

function trend(v) {
  const d = v.stabilityDelta;
  if (v.stabilityTrend === 'up') return `<span class="trend up">↑ +${d.toFixed(1)}/ход</span>`;
  if (v.stabilityTrend === 'down') return `<span class="trend down">↓ ${d.toFixed(1)}/ход</span>`;
  return '<span class="trend flat">→ 0/ход</span>';
}

function previewLine(preview) {
  if (!preview) return '';
  if (preview.blocked) {
    return `<div class="row-preview"><span class="delta down">Недоступно: ${esc(preview.blocked)}</span></div>`;
  }
  const { before, after } = preview;
  const coefPart = preview.coefficientPreview != null
    ? `<span class="proj changed">Коэф. ${num(before.coefficient)} → ${num(preview.coefficientPreview)} ±${preview.coefficientRange}</span>`
    : proj('Коэф.', before.coefficient, after.coefficient);
  const poolPart = preview.poolAfter != null && preview.poolAfter !== preview.poolBefore
    ? proj('Пул', preview.poolBefore, preview.poolAfter)
    : '';
  return `<div class="row-preview">
    ${proj('Стабильность', before.stability, after.stability)}
    ${proj('Энергия', before.reserves, after.reserves)}
    ${coefPart}
    ${proj('Гномы', before.gnomes, after.gnomes)}
    ${proj('Риск', preview.riskBefore, preview.riskAfter)}
    ${poolPart}
    ${preview.note ? `<span class="proj-note muted">${esc(preview.note)}</span>` : ''}
  </div>`;
}

function tuneButton(portalId, pending, check, step, label) {
  const c = check(ActionId.TUNE, { step });
  return actionButton(portalId, ActionId.TUNE, label, {
    selected: pending.action === ActionId.TUNE && pending.params?.step === step,
    params: { step },
    disabled: !c.ok,
    reason: c.reason,
    tooltip: TIP.tune,
  });
}

export function portalRow(portal, state, ui, store, blockerReason = '') {
  const v = visualState(portal);
  const pending = store.getPending(portal.id);
  const preview = store.preview(portal.id);
  const projected = preview && !preview.blocked ? preview.after : null;
  const projectedRisk = preview && !preview.blocked ? preview.riskAfter : null;
  const coefficientPreview = preview && !preview.blocked
    ? (preview.coefficientPreview ?? (preview.after ? preview.after.coefficient : null))
    : null;
  const coefficientRange = preview && !preview.blocked ? (preview.coefficientRange ?? 0) : 0;
  const assistant = portal.assistant;
  const assignId = assistant ? ActionId.UNASSIGN_ASSISTANT : ActionId.ASSIGN_ASSISTANT;
  const assignLabel = assistant ? 'Снять ассистента' : 'Назначить ассистента';
  const capacity = throughput(portal);
  const check = (id, params = {}) => canApply(state, portal.id, id, params);
  const energizeMax = store.maxEnergize(portal.id);

  const sendInSel = pending.action === ActionId.SEND_IN;
  const sendOutSel = pending.action === ActionId.SEND_OUT;
  const sendInMax = Math.min(capacity, state.idleGnomes);
  const sendOutMax = Math.min(capacity, portal.gnomes);

  const gnomePipsRow = sendInSel || sendOutSel
    ? `<div class="row-extra">
        <span class="muted">${sendInSel ? 'Отправить' : 'Вывести'} (до ${sendInSel ? sendInMax : sendOutMax}):</span>
        ${pipRow(portal.id, pending.params?.amount ?? 0, sendInSel ? sendInMax : sendOutMax, pending.action)}
      </div>`
    : '';

  const actionTable = v.terminal
    ? '<p class="muted">Портал закрыт — действия недоступны.</p>'
    : `
      <div class="action-table">
        <span class="at-label">Ресурсы</span>
        <div class="at-cell">
          <div class="inline-control">
            <span class="muted">Приток энергии</span>
            ${slider(portal.id, Math.min(pending.energize, energizeMax), energizeMax, TIP.energize)}
          </div>
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
            ${tuneButton(portal.id, pending, check, '--', '−−')}
            ${tuneButton(portal.id, pending, check, '-', '−')}
            ${tuneButton(portal.id, pending, check, '+', '+')}
            ${tuneButton(portal.id, pending, check, '++', '++')}
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
          ${actionButton(portal.id, assignId, assignLabel, {
            selected: pending.action === assignId,
            disabled: !check(assignId).ok,
            reason: check(assignId).reason,
            tooltip: assistant ? TIP.unassign : TIP.assign,
          })}
          ${gnomePipsRow}
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

  return `
    <article class="portal-row band-${v.band} ${v.collapsing ? 'collapsing' : ''} ${v.terminal ? 'terminal' : ''}">
      <div class="row-main">
        <div class="row-image-wrap">
          ${portalImage(v, { size: 104 })}
          <div class="row-image-pips">${gnomePips(portal.gnomes)}</div>
        </div>
        <div class="row-vials">
          ${vial(portal.reserves, { kind: 'mana', title: 'Энергия (резервы)', preview: projected ? projected.reserves : null })}
          ${crystalColumn(portal.stability, { preview: projected ? projected.stability : null })}
        </div>
        <div class="row-stats">
          <div class="row-head">
            <div class="row-title">
              <h3>${esc(portal.name)}</h3>
              <div class="row-badges">
                ${badge(STATUS_LABEL[portal.status], `status-${portal.status}`)}
                ${badge(`риск ${v.risk} · ${BAND_LABEL[v.band]}`, `band-${v.band}`)}
              </div>
            </div>
            <div class="row-head-right">
              ${radialGauge(v.risk, v.band, { preview: projectedRisk })}
              <button class="act small" data-act="detail" data-portal="${portal.id}" title="${esc(TIP.detail)}">Подробнее</button>
            </div>
          </div>

          <div class="row-meta">
            ${esc(portal.destinationWorld)} · дистанция ${num(portal.distance)} · ${collapseChip(v.timeToCollapse, v.urgency)}
          </div>

          <div class="row-field">
            <span class="label">Коэффициент Мерлина</span>
            ${bandGauge(portal.coefficient, v.coefficientOptimum, v.coefficientSafe, { preview: coefficientPreview, previewRange: coefficientRange })}
            ${num(portal.coefficient)} <span class="muted">/ опт ${num(v.coefficientOptimum)}</span>
          </div>
          <div class="row-field">
            <span class="label">Гномы</span>
            ${num(portal.gnomes)} <span class="muted">внутри · ${num(capacity)} гномов/ход${assistant ? ' · ассистент' : ''}</span>
          </div>
          <div class="row-field">
            <span class="label">Стабильность</span>
            ${trend(v)} <span class="muted">· энергия ${num(-v.upkeep)}/ход</span>
          </div>
        </div>
      </div>

      <div class="row-actions">
        ${previewLine(preview)}
        ${blockerReason ? `<p class="row-block">⚠ ${esc(blockerReason)}</p>` : ''}
        ${actionTable}
      </div>
    </article>
  `;
}

export function renderPortals(state, ui, store) {
  if (state.portals.length === 0) {
    return '<p class="empty">Порталов пока нет. Новые открываются сами — следите за лабораторией.</p>';
  }
  const blockerMap = new Map((store.commitBlockers?.() ?? []).map((b) => [b.portalId, b.reason]));
  const active = state.portals.filter((p) => p.status !== 'closed' && p.status !== 'collapsed');
  const terminal = state.portals.filter((p) => p.status === 'closed' || p.status === 'collapsed');
  return `
    <div class="portal-list">
      ${active.map((p) => portalRow(p, state, ui, store, blockerMap.get(p.id))).join('')}
    </div>
    ${terminal.length ? `<h2 style="margin-top:24px">Закрытые и схлопнувшиеся</h2>
      <div class="portal-list">${terminal.map((p) => portalRow(p, state, ui, store, blockerMap.get(p.id))).join('')}</div>` : ''}
  `;
}
