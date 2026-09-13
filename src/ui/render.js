import { renderHud } from './hud.js';
import { renderPortals } from './portals.js';
import { renderLog } from './log.js';
import { renderSummary } from './summary.js';
import { renderTutorial, renderOnboarding } from './tutorial.js';
import { renderAbout, persistCheck } from './about.js';
import { renderDetail } from './portalDetail.js';
import { mountPortalCanvas, stopPortalCanvas } from './portalCanvas.js';
import { esc } from './components.js';

const TABS = [
  { id: 'portals', label: 'Порталы' },
  { id: 'log', label: 'Журнал' },
  { id: 'summary', label: 'Сводка' },
  { id: 'tutorial', label: 'Обучение' },
  { id: 'about', label: 'О программе' },
];

function shell() {
  return `
    <div class="app">
      <header>
        <h1>Лаборатория нестабильных порталов</h1>
        <p class="muted">Смотритель управляет порталами, энергией и гномами.</p>
      </header>
      <div class="sticky-top">
        <section class="hud" id="hud"></section>
        <nav class="tabs" id="tabs">
          ${TABS.map((t) => `<button class="tab" data-act="tab" data-tab="${t.id}">${t.label}</button>`).join('')}
        </nav>
      </div>
      <main id="view"></main>
    </div>
    <dialog id="detail-dialog">
      <div class="dialog-head">
        <h3 id="detail-title"></h3>
        <button class="icon-btn" data-act="close-detail" aria-label="Закрыть">×</button>
      </div>
      <div class="dialog-body" id="detail-body"></div>
    </dialog>
    <dialog id="warning-dialog">
      <div class="dialog-head"><h3>Продолжить ход?</h3></div>
      <div class="dialog-body" id="warning-body"></div>
      <div class="dialog-foot">
        <label class="muted" style="margin-right:auto"><input type="checkbox" id="skip-warning" /> больше не предупреждать</label>
        <button class="btn ghost" data-act="cancel-advance">Отмена</button>
        <button class="btn primary" data-act="confirm-advance">Продолжить</button>
      </div>
    </dialog>
    <dialog id="onboarding-dialog">
      <div class="dialog-head"><h3>Лаборатория нестабильных порталов</h3></div>
      <div class="dialog-body" id="onboarding-body"></div>
      <div class="dialog-foot">
        <button class="btn ghost" data-act="close-onboarding">Пропустить</button>
        <button class="btn primary" data-act="close-onboarding">Понятно</button>
      </div>
    </dialog>
    <div class="toasts" id="toasts"></div>
  `;
}

function renderView(state, ui, store) {
  switch (ui.tab) {
    case 'log': return renderLog(state);
    case 'summary': return renderSummary(state);
    case 'tutorial': return renderTutorial();
    case 'about': return renderAbout();
    default: return renderPortals(state, ui, store);
  }
}

function renderWarning(state, ui) {
  const names = ui.warning.portalIds
    .map((id) => state.portals.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => `<li>${esc(p.name)}</li>`)
    .join('');
  return `<p>Следующие порталы останутся без действий (по умолчанию «Ожидать»):</p><ul>${names}</ul>`;
}

export function createRenderer(store, root) {
  root.innerHTML = shell();
  const hud = root.querySelector('#hud');
  const tabs = root.querySelector('#tabs');
  const view = root.querySelector('#view');
  const detailDialog = root.querySelector('#detail-dialog');
  const detailTitle = root.querySelector('#detail-title');
  const detailBody = root.querySelector('#detail-body');
  const warningDialog = root.querySelector('#warning-dialog');
  const warningBody = root.querySelector('#warning-body');
  const skipWarning = root.querySelector('#skip-warning');
  const onboardingDialog = root.querySelector('#onboarding-dialog');
  root.querySelector('#onboarding-body').innerHTML = renderOnboarding();
  const toasts = root.querySelector('#toasts');

  let updating = false;

  function update() {
    if (updating) return;
    updating = true;
    const state = store.getState();
    const ui = store.getUi();

    hud.innerHTML = renderHud(state, ui, store);
    tabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === ui.tab));
    view.innerHTML = renderView(state, ui, store);

    const detail = renderDetail(state, ui, store);
    if (detail) {
      detailTitle.textContent = detail.title;
      detailBody.innerHTML = detail.body;
      const portal = state.portals.find((p) => p.id === ui.detailPortalId);
      if (portal) mountPortalCanvas(detailBody, portal);
      if (!detailDialog.open) detailDialog.showModal();
    } else {
      stopPortalCanvas();
      if (detailDialog.open) detailDialog.close();
    }

    if (ui.warning) {
      warningBody.innerHTML = renderWarning(state, ui);
      skipWarning.checked = ui.skipWarning;
      if (!warningDialog.open) warningDialog.showModal();
    } else if (warningDialog.open) {
      warningDialog.close();
    }

    if (ui.onboardingOpen) {
      if (!onboardingDialog.open) onboardingDialog.showModal();
    } else if (onboardingDialog.open) {
      onboardingDialog.close();
    }

    if (ui.toast) {
      toasts.innerHTML = `<div class="toast ${ui.toast.kind}">
        <span>${esc(ui.toast.message)}</span>
        ${ui.toast.action
          ? `<button class="toast-action" data-act="toast-action" data-toast-action="${esc(ui.toast.action)}">${esc(ui.toast.actionLabel ?? '')}</button>`
          : ''}
        <button class="toast-close" data-act="dismiss-toast" aria-label="Закрыть">×</button>
      </div>`;
    } else {
      toasts.innerHTML = '';
    }
    updating = false;
  }

  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-act]');
    if (!el) return;
    const { act, portal: portalId } = el.dataset;
    switch (act) {
      case 'tab':
        store.setTab(el.dataset.tab);
        break;
      case 'select-action': {
        let params = el.dataset.params ? JSON.parse(el.dataset.params) : {};
        if (el.dataset.action === 'close' && store.getPending(portalId).action !== 'close') {
          const portal = store.getState().portals.find((p) => p.id === portalId);
          if (portal && portal.gnomes > 0) {
            if (!window.confirm(`В портале ${portal.gnomes} гномов. Закрыть портал и оставить их?`)) break;
            params = { confirm: true };
          }
        }
        store.selectAction(portalId, el.dataset.action, params);
        break;
      }
      case 'pip':
        store.selectAction(portalId, el.dataset.kind, { amount: Number(el.dataset.value) }, { toggle: false });
        break;
      case 'detail':
        store.openDetail(portalId);
        break;
      case 'close-detail':
        store.closeDetail();
        break;
      case 'advance':
        store.advanceTurn();
        break;
      case 'confirm-advance':
        store.confirmAdvance();
        break;
      case 'cancel-advance':
        store.cancelAdvance();
        break;
      case 'new-game':
        if (window.confirm('Начать новую игру? Текущий прогресс будет потерян.')) store.newGame();
        break;
      case 'autoplay':
        store.toggleAutoplay();
        break;
      case 'toast-action':
        if (el.dataset.toastAction === 'log') store.setTab('log');
        store.dismissToast();
        break;
      case 'dismiss-toast':
        store.dismissToast();
        break;
      case 'preset':
        store.loadPreset(el.dataset.preset);
        break;
      case 'onboarding':
        store.openOnboarding();
        break;
      case 'close-onboarding':
        store.closeOnboarding();
        break;
      default:
        break;
    }
  });

  document.addEventListener('input', (event) => {
    const el = event.target;
    if (el.dataset?.act === 'energize') {
      const value = Number(el.value);
      store.selectEnergize(el.dataset.portal, value, { silent: true });
      const label = document.getElementById(`energize-${el.dataset.portal}`);
      if (label) label.textContent = value;
    }
  });

  document.addEventListener('change', (event) => {
    const el = event.target;
    if (el.dataset?.act === 'energize') store.selectEnergize(el.dataset.portal, Number(el.value));
    if (el.dataset?.act === 'interval') store.setAutoplayInterval(Number(el.value));
    if (el.dataset?.act === 'check') persistCheck(el.dataset.index, el.checked);
    if (el.id === 'skip-warning') store.toggleSkipWarning(el.checked);
  });

  detailDialog.addEventListener('close', () => {
    stopPortalCanvas();
    store.closeDetail();
  });
  warningDialog.addEventListener('close', () => store.cancelAdvance());
  onboardingDialog.addEventListener('close', () => store.closeOnboarding());
  [detailDialog, warningDialog, onboardingDialog].forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  store.subscribe(update);

  return { update };
}
