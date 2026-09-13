import { createStore } from './store.js';
import { createRenderer } from './ui/render.js';

const root = document.getElementById('app');

function showFatal(message) {
  root.innerHTML = `<div class="app">
    <p class="empty">Что-то пошло не так: ${message}.
    <button class="btn" onclick="location.reload()">Перезагрузить</button></p>
  </div>`;
}

try {
  const store = createStore();
  const renderer = createRenderer(store, root);
  renderer.update();
} catch (error) {
  console.error(error);
  showFatal(error?.message ?? 'неизвестная ошибка');
}
