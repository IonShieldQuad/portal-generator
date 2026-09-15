import { ringPathD, boltPoints, rand01 } from './portalShape.js';

export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

export function fmtNum(value) {
  return Number.isFinite(value) ? Math.round(value) : '∞';
}

export function num(value, extra = '') {
  const text = typeof value === 'number' ? fmtNum(value) : value;
  return `<b class="num ${extra}">${text}</b>`;
}

function clamp01(value) {
  return Math.max(0, Math.min(100, value));
}

export function badge(text, kind = '') {
  return `<span class="badge ${kind}">${esc(text)}</span>`;
}

export function collapseChip(time, urgency) {
  const text = Number.isFinite(time) ? `${Math.round(time)} ход.` : '∞';
  return `<span class="collapse-chip urgency-${urgency}" title="Прогноз времени до схлопывания">⏳ ${text}</span>`;
}

export function vial(value, { kind = 'mana', max = 100, title = '', preview = null } = {}) {
  const pct = clamp01((value / max) * 100);
  const ghost = preview != null
    ? `<div class="vial-ghost" style="bottom:${clamp01((preview / max) * 100)}%"></div>`
    : '';
  return `<div class="vial vial-${kind}" role="img" aria-label="${esc(title)}: ${Math.round(value)} из ${max}" title="${esc(title)}">
    <div class="vial-fill" style="height:${pct}%"></div>
    ${ghost}
    <span class="vial-value">${Math.round(value)}</span>
  </div>`;
}

export function crystalColumn(value, { max = 100, segments = 10, preview = null } = {}) {
  const filled = Math.round((value / max) * segments);
  let blocks = '';
  for (let i = segments; i >= 1; i -= 1) {
    blocks += `<span class="seg ${i <= filled ? 'on' : 'off'}"></span>`;
  }
  const ghost = preview != null
    ? `<div class="crystal-ghost" style="bottom:${clamp01((preview / max) * 100)}%"></div>`
    : '';
  return `<div class="crystal" role="img" aria-label="Стабильность: ${Math.round(value)}" title="Стабильность">
    ${blocks}${ghost}<span class="vial-value crystal-value">${Math.round(value)}</span>
  </div>`;
}

export function bandGauge(value, optimum, safe, { preview = null, previewRange = 0 } = {}) {
  const pos = (v) => clamp01(v);
  const low = pos(optimum - 20);
  const opt = pos(optimum);
  const high = pos(safe);
  const ghost = preview != null ? `<div class="bg-ghost" style="left:${pos(preview)}%"></div>` : '';
  const range = preview != null && previewRange > 0
    ? `<div class="bg-range" style="left:${pos(preview - previewRange)}%; width:${Math.max(0, pos(preview + previewRange) - pos(preview - previewRange))}%"></div>`
    : '';
  return `<div class="band-gauge" role="img" aria-label="Коэффициент Мерлина: ${value}, оптимум ${optimum}">
    <div class="bg-low" style="width:${low}%"></div>
    <div class="bg-safe" style="left:${low}%; width:${Math.max(0, high - low)}%"></div>
    <div class="bg-high" style="left:${high}%; right:0"></div>
    <div class="bg-opt" style="left:${opt}%" title="Оптимум ${optimum}"></div>
    <div class="bg-marker" style="left:${pos(value)}%"></div>
    ${range}
    ${ghost}
  </div>`;
}

export function portalImage(v, { size = 104 } = {}) {
  const hue = v.hue;
  const stability = clamp01(v.stability);
  const energy = clamp01(v.reserves);
  const glow = v.coefficientGlow;
  const fade = clamp01(v.coefficientFade);
  const dead = v.terminal;
  const seed = v.seed ?? 0.5;
  const cx = 50;
  const cy = 50;
  const R = 34;
  const classes = [
    'portal-image',
    dead ? 'dead' : '',
    v.collapsing ? 'collapsing' : '',
    fade > 0.25 ? 'faded' : '',
  ].filter(Boolean).join(' ');

  if (dead) {
    return `<svg class="${classes}" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Мёртвый портал (остаток)">
      <circle cx="${cx}" cy="${cy}" r="${R}" class="pi-dead-ring" />
      <circle cx="${cx}" cy="${cy}" r="14" class="pi-dead-core" />
    </svg>`;
  }

  const ringD = ringPathD(cx, cy, R, stability, seed * 6.283, seed, 48);
  const sat = Math.round(80 * (1 - 0.7 * fade));
  const ringAlpha = ((0.4 + stability * 0.5) * (1 - 0.5 * fade)).toFixed(2);
  const ringWidth = (3.5 - fade * 1.5).toFixed(2);

  let bolts = '';
  const boltCount = Math.round(glow * 4);
  for (let i = 0; i < boltCount; i += 1) {
    const angle = (i / 4) * Math.PI * 2 + seed * 6.283;
    const pts = boltPoints(cx, cy, R, angle, seed + i, 5, 0.45);
    const d = `M ${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')}`;
    bolts += `<path d="${d}" class="pi-bolt-glow" style="stroke:hsla(${hue},100%,70%,${(glow * 0.5).toFixed(2)})" />`;
    bolts += `<path d="${d}" class="pi-bolt" style="stroke:hsla(${hue},100%,88%,${glow.toFixed(2)})" />`;
  }

  let leaks = '';
  if (fade > 0.2) {
    for (let i = 0; i < 4; i += 1) {
      const a = rand01(seed, i) * Math.PI * 2;
      const rr = R * (1.12 + rand01(seed, i + 10) * 0.55);
      leaks += `<circle cx="${(cx + Math.cos(a) * rr).toFixed(1)}" cy="${(cy + Math.sin(a) * rr).toFixed(1)}"
        r="${(0.8 + rand01(seed, i + 20) * 1.4).toFixed(1)}" fill="hsla(${hue},40%,72%,${(fade * 0.5).toFixed(2)})" />`;
    }
  }

  const openingR = (14 + energy * 12).toFixed(1);
  const opening = fade > 0.35
    ? `<circle cx="${cx}" cy="${cy}" r="${openingR}" fill="none"
        stroke="hsla(${hue},${sat}%,70%,${(0.5 * (1 - fade * 0.4)).toFixed(2)})" stroke-width="1.2" stroke-dasharray="3 4" />`
    : `<circle cx="${cx}" cy="${cy}" r="${openingR}" fill="hsla(${hue},${sat}%,58%,${((0.12 + energy * 0.42) * (1 - fade * 0.75)).toFixed(3)})" />`;

  return `<svg class="${classes}" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Образ портала">
    <path d="${ringD}" class="pi-ring" style="stroke:hsla(${hue},${sat}%,62%,${ringAlpha});stroke-width:${ringWidth}" />
    ${opening}
    ${bolts}
    ${leaks}
  </svg>`;
}

export function gnomePips(gnomes, { divisor = 5, cap = 8 } = {}) {
  if (gnomes <= 0) return '<span class="muted">нет гномов</span>';
  const total = Math.ceil(gnomes / divisor);
  const shown = Math.min(total, cap);
  let pips = '';
  for (let i = 0; i < shown; i += 1) pips += '<span class="gpip"></span>';
  const more = total > cap ? `<span class="gpip-more">+${(total - cap) * divisor}</span>` : '';
  return `<span class="gnome-pips" title="Гномов внутри: ${gnomes}">${pips}${more}</span>`;
}

export function radialGauge(value, band, { preview = null } = {}) {
  const r = 15;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamp01(value) / 100);
  const ghost = preview != null
    ? `<circle class="radial-ghost" cx="20" cy="20" r="${r}"
        stroke-dasharray="${circumference.toFixed(2)}"
        stroke-dashoffset="${(circumference * (1 - clamp01(preview) / 100)).toFixed(2)}" />`
    : '';
  return `<svg class="radial band-${band}" viewBox="0 0 40 40" role="img"
      aria-label="Риск: ${value}${preview != null ? `, прогноз ${preview}` : ''}">
    <circle class="radial-track" cx="20" cy="20" r="${r}" />
    ${ghost}
    <circle class="radial-value" cx="20" cy="20" r="${r}"
      stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" />
    <text x="20" y="24" text-anchor="middle">${value}</text>
  </svg>`;
}

export function pipRow(portalId, count, max, kind) {
  if (max <= 0) return '<span class="muted">нет доступных</span>';
  let pips = '';
  for (let n = 1; n <= max; n += 1) {
    pips += `<button class="pip ${n <= count ? 'on' : ''}" data-act="pip" data-portal="${portalId}"
      data-kind="${kind}" data-value="${n}" aria-label="Выбрать ${n}" title="Выбрать ${n}"></button>`;
  }
  return `<div class="pips" data-portal="${portalId}">${pips}</div>`;
}

export function slider(portalId, value, max, tooltip = '') {
  return `<div class="slider-row">
    <input type="range" min="0" max="${max}" step="1" value="${value}"
      data-act="energize" data-portal="${portalId}"
      aria-label="Приток энергии" title="${esc(tooltip)}" />
    <span class="slider-value num" id="energize-${portalId}">${value}</span>
  </div>`;
}

export function actionButton(portalId, actionId, label, options = {}) {
  const {
    selected = false,
    disabled = false,
    reason = '',
    params = null,
    variant = '',
    tooltip = '',
    attempt = false,
  } = options;
  const classes = ['act', variant, selected ? 'selected' : ''].filter(Boolean).join(' ');
  const attrs = [
    `class="${classes}"`,
    `data-act="${attempt ? 'attempt' : 'select-action'}"`,
    `data-portal="${portalId}"`,
    `data-action="${actionId}"`,
  ];
  if (params) attrs.push(`data-params='${JSON.stringify(params)}'`);
  if (disabled) attrs.push('disabled');
  const title = disabled && reason ? reason : tooltip;
  if (title) attrs.push(`title="${esc(title)}"`);
  return `<button ${attrs.join(' ')}>${esc(label)}</button>`;
}

export function delta(before, after, field, label) {
  if (!before || !after) return '';
  const a = before[field];
  const b = after[field];
  const diff = b - a;
  if (Math.abs(diff) < 0.5) return `<span class="delta muted">${label} ${num(b)}</span>`;
  const sign = diff > 0 ? '+' : '';
  const cls = diff > 0 ? 'up' : 'down';
  return `<span class="delta ${cls}">${label} ${num(a)} → ${num(b)} (${sign}${Math.round(diff)})</span>`;
}
