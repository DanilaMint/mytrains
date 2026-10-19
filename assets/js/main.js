// Bootstrap: поднимает store, регистрирует маршруты, запускает роутер.
// Это единственная точка входа — index.html подключает только этот файл.

import { initStore, getStreak, subscribe } from "./store.js";
import { initRouter, navigate } from "./router.js";
import { hubView } from "./views/hub.js";
import { areaView } from "./views/area.js";
import { taskView } from "./views/task.js";
import { progressView } from "./views/progress.js";
import { aboutView } from "./views/about.js";
import { notFoundView } from "./views/not-found.js";

const root = document.getElementById("app");
const streakEl = document.getElementById("streak-badge");

function renderStreak() {
  const s = getStreak();
  if (streakEl) streakEl.textContent = s.count > 0 ? `🔥 ${s.count}` : "";
}

function boot() {
  // 1. Стор прогресса — localStorage namespace.
  const storeOk = initStore();

  // 2. Регистрируем маршруты. Порядок важен: более специфичные паттерны первыми.
  initRouter(root, [
    { pattern: /^\/?$/,                       handler: hubView },
    { pattern: /^\/progress\/?$/,             handler: progressView },
    { pattern: /^\/about\/?$/,                handler: aboutView },
    { pattern: /^\/area\/([^/]+)\/?$/,        handler: (params, query, mount) => areaView(params[1], mount) },
    { pattern: /^\/task\/([^/]+)\/([^/]+)\/?$/, handler: (params, query, mount) => taskView(params[1], params[2], mount) },
    { pattern: /^.*$/,                        handler: notFoundView },
  ]);

  // 3. Стрик показываем сразу и обновляем при записи попытки.
  renderStreak();
  if (storeOk) {
    subscribe(() => renderStreak());
  } else {
    if (streakEl) streakEl.title = "Прогресс не сохраняется (localStorage недоступен)";
  }

  // 4. Стартуем роутер — он парсит location.hash и рендерит первый view.
  navigate(location.hash || "#/");
}

// Если DOM ещё не готов (script type=module по спецификации всегда defer, но на всякий случай):
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

// Глобальный хук для отладки и для e2e-проверок.
window.__app = { navigate };