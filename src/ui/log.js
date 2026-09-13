import { esc } from './components.js';

export function renderLog(state) {
  const entries = state.log.slice().reverse();
  if (entries.length === 0) {
    return '<p class="empty">Действий пока не было.</p>';
  }
  return `<ul class="log-list">
    ${entries.map((e) => `
      <li>
        <span class="tick mono">Ход ${e.tick}</span>
        <span class="${e.result === 'blocked' ? 'blocked' : ''}">${esc(e.message)}</span>
        ${e.scoreDelta ? `<span class="muted mono">${e.scoreDelta > 0 ? '+' : ''}${e.scoreDelta}</span>` : ''}
      </li>`).join('')}
  </ul>`;
}
