import { esc } from './components.js';

export function renderLog(state) {
  const entries = state.log.slice().reverse();
  if (entries.length === 0) {
    return '<p class="empty">Действий пока не было.</p>';
  }
  return `<ul class="log-list">
    ${entries.map((e) => {
      const cls = e.loss ? 'loss' : e.result === 'blocked' ? 'blocked' : '';
      const portal = e.portalName ?? e.portalId ?? '—';
      const delta = e.scoreDelta
        ? `<span class="log-delta mono">${e.scoreDelta > 0 ? '+' : ''}${e.scoreDelta}</span>`
        : '';
      return `<li class="${cls}">
        <span class="tick mono">Ход ${e.tick}</span>
        <span class="log-portal">${esc(portal)}</span>
        <span class="log-msg">${esc(e.message)}</span>
        ${delta}
      </li>`;
    }).join('')}
  </ul>`;
}
