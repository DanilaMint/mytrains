// Страница «О проекте».

import { h } from "../util/dom.js";

export function aboutView(_params, _query, mount) {
  mount(h("article", {},
    h("h2", {}, "О проекте"),
    h("p", {}, "Сборник тренировочных задач. Чистая статика, без сервера и без сборки."),
    h("h3", {}, "Как добавить задачу"),
    h("p", {}, "Скажите Claude Code: «добавь задание про …». Подгрузится skill .claude/skills/add-task, прочитает схему, создаст JSON-файл и пропатчит манифест."),
    h("h3", {}, "Стек"),
    h("ul", {},
      h("li", {}, "Pico.css (CDN, classless)"),
      h("li", {}, "Vanilla ES-модули"),
      h("li", {}, "localStorage для прогресса"),
      h("li", {}, "GitHub Pages для хостинга"),
    ),
    h("h3", {}, "Известные ограничения"),
    h("ul", {},
      h("li", {}, "DnD в matching не работает на iOS Safari (тач). Tap-to-select — fallback."),
      h("li", {}, "Картинки в задачах не поддерживаются (квота localStorage)."),
      h("li", {}, "Streak считается по локальной TZ пользователя."),
    ),
  ));
}