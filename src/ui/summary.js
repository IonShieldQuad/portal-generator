import { countsByStatus, needsAttention, criticalPortals, assistantsAssigned } from '../domain/game.js';
import { risk, riskBand, recommendedAction, throughput } from '../domain/portal.js';
import { esc, badge, radialGauge } from './components.js';
import { BAND_LABEL, STATUS_LABEL } from './visual.js';

const RECOMMENDATION_LABEL = {
  'stabilize-or-evacuate': 'Стабилизировать или вывести гномов',
  'evacuate-and-stabilize': 'Вывести гномов и стабилизировать',
  energize: 'Энергизовать',
  tune: 'Настроить коэффициент',
  'send-in': 'Отправить гномов',
  review: 'Под наблюдением',
};

export function renderSummary(state) {
  const counts = countsByStatus(state);
  const critical = criticalPortals(state).length;
  const deployed = state.portals.reduce((sum, p) => sum + p.gnomes, 0);
  const attention = needsAttention(state).slice(0, 8);

  const card = (label, value) => `<div class="summary-card"><div class="muted">${label}</div><div class="value">${value}</div></div>`;

  return `
    <div class="summary-cards">
      ${card('Очки', state.score)}
      ${card('Открыто', counts.open)}
      ${card('Критичных', critical)}
      ${card('Закрыто', counts.closed)}
      ${card('Схлопнулось', counts.collapsed)}
      ${card('Гномов в порталах', deployed)}
      ${card('Ассистентов занято', assistantsAssigned(state))}
    </div>
    <h2>Требуют внимания</h2>
    ${attention.length === 0
      ? '<p class="empty">Нет активных порталов.</p>'
      : `<ul class="attention">
          ${attention.map((p) => {
            const band = riskBand(risk(p));
            const rec = recommendedAction(p);
            return `<li>
              ${radialGauge(risk(p), band)}
              <div style="flex:1">
                <b>${esc(p.name)}</b>
                <div class="muted">${STATUS_LABEL[p.status]} · риск ${risk(p)} (${BAND_LABEL[band]}) · гномы ${p.gnomes} · ${throughput(p)} гномов/ход</div>
                <div class="muted">Рекомендация: ${rec ? RECOMMENDATION_LABEL[rec] : '—'}</div>
              </div>
              <button class="act" data-act="detail" data-portal="${p.id}">Открыть</button>
            </li>`;
          }).join('')}
        </ul>`}
  `;
}
