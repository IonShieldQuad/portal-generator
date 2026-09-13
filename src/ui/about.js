import { WORKLOG } from './worklog.js';

const CHECKLIST = [
  ['Пустой список порталов', 'Пресет «Пустой список»: показывается пустое состояние, ошибок нет.'],
  ['Портал с критическим риском', 'Пресет «Критический портал»: красный бейдж, отправка гномов запрещена.'],
  ['Попытка запрещённого действия', 'Пресет «Запрещённое действие»: стабилизировать закрытый портал — причина и запись в журнале.'],
  ['Изменение риска после стабилизации', 'Отметьте риск, стабилизируйте, сделайте ход: риск снижается.'],
  ['Журнал после нескольких операций', 'Энергизовать, отправить гномов, настроить, ход ×2: все записи по порядку.'],
  ['Схлопывание и потери', 'Дайте порталу с гномами схлопнуться: один ход «схлопывается», затем потеря и штраф.'],
  ['Нет пропускной способности', 'Пресет «Нет пропускной способности»: отправить гномов нельзя.'],
  ['Сохранение', 'Сделайте действие, обновите страницу: состояние восстановлено.'],
  ['Ошибка', 'Повредите сохранение в localStorage, обновите: баннер ошибки и сброс.'],
];

const PRESETS = [
  ['critical', 'Критический портал'],
  ['empty', 'Пустой список'],
  ['forbidden', 'Запрещённое действие'],
  ['no-throughput', 'Нет пропускной способности'],
];

const TEST_FILES = [
  'rng.test.js — детерминированный PRNG',
  'portal.test.js — формулы, риск, дрейф, предсказание',
  'game.test.js — инварианты и селекторы',
  'log.test.js — журнал',
  'actions.test.js — правила действий и травмы при переходе',
  'sim.test.js — разрешение хода',
  'spawn.test.js — появление порталов',
  'store.test.js — поэтапные действия и превью',
];

function checklistKey() {
  return 'portal-lab:checklist:v1';
}

function loadChecks() {
  try {
    return JSON.parse(localStorage.getItem(checklistKey())) ?? {};
  } catch {
    return {};
  }
}

function saveChecks(checks) {
  try {
    localStorage.setItem(checklistKey(), JSON.stringify(checks));
  } catch {
    /* ignore */
  }
}

function list(items) {
  return `<ul class="wl-list">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

function renderWorklog() {
  const stages = WORKLOG.stages.map((s) => `
    <div class="wl-stage">
      <h4>${s.name}</h4>
      <div class="wl-split">
        <div><span class="wl-tag">Человек</span><p>${s.human}</p></div>
        <div><span class="wl-tag">AI</span><p>${s.ai}</p></div>
      </div>
      <p class="muted">Промпт: «${s.prompts}»</p>
    </div>`).join('');

  const block = (title, html) => `<h4>${title}</h4>${html}`;

  return `
    <h2>AI Worklog</h2>
    ${block('Инструменты', list(WORKLOG.tools))}
    ${block('Общее время', `<p>${WORKLOG.time}</p>`)}
    ${block('Токены', `<p>${WORKLOG.tokens}</p>`)}
    <h4>Этапы</h4>
    ${stages}
    ${block('3–5 решений автора', list(WORKLOG.decisions))}
    ${block('Где AI ошибся', list(WORKLOG.aiErrors))}
    ${block('Что переписано вручную', list(WORKLOG.manualRework))}
    ${block('Как проверялось', list(WORKLOG.verification))}
    ${block('Что улучшить', list(WORKLOG.improvements))}
  `;
}

export function renderAbout() {
  const checks = loadChecks();
  const items = CHECKLIST.map(([title, text], i) => `
    <li>
      <label>
        <input type="checkbox" data-act="check" data-index="${i}" ${checks[i] ? 'checked' : ''} />
        <span><b>${title}</b><br /><span class="muted">${text}</span></span>
      </label>
    </li>`).join('');

  const presets = PRESETS.map(([id, label]) =>
    `<button class="act" data-act="preset" data-preset="${id}">${label}</button>`).join('');

  return `
    <h2>О приложении</h2>
    <p>Мини-игра «Лаборатория нестабильных порталов» — тестовое задание MOX «AI-first Developer 2.0». Ванильный JS, ES-модули, без бэкенда; хостинг — GitHub Pages.</p>

    ${renderWorklog()}

    <h2>Проверка (чек-лист)</h2>
    <p class="muted">Отметьте, что проверили. Пресеты загружают нужное состояние в один клик.</p>
    <div class="preset-row">${presets}</div>
    <ul class="attention">${items}</ul>

    <h2>Автотесты</h2>
    <p class="muted">${TEST_FILES.length} файлов, 53 теста. Запуск: <code>npm test</code>.</p>
    ${list(TEST_FILES)}
  `;
}

export function persistCheck(index, checked) {
  const checks = loadChecks();
  checks[index] = checked;
  saveChecks(checks);
}
