// Главная страница: единый список всех задач из всех областей (сетка 3×N).

import { loadManifest } from "../engine.js";
import { getAllProgress } from "../store.js";
import { h } from "../util/dom.js";

export async function hubView(_params, _query, mount) {
  try {
    const manifest = await loadManifest();
    const progress = getAllProgress();

    const list = h("div", { class: "app-hub" });
    list.appendChild(h("h2", {}, "Все задачи"));
    list.appendChild(h("p", { style: { color: "var(--pico-muted-color)" } },
      "Все задания из всех областей в одном списке. Без деления по областям."
    ));

    // Собираем плоский список задач, сохраняя порядок: сначала области по ключу,
    // внутри области — порядок из манифеста.
    const tasks = [];
    for (const [areaKey, area] of Object.entries(manifest.areas || {})) {
      for (const id of area.tasks || []) {
        tasks.push({ areaKey, id });
      }
    }

    if (tasks.length === 0) {
      list.appendChild(h("div", { class: "empty-state" },
        h("p", {}, "Пока нет ни одной задачи."),
        h("p", { style: { fontSize: "0.85rem" } },
          "Скажите Claude Code: «добавь задание про …» — skill создаст файл и пропатчит манифест."
        )
      ));
    } else {
      const grid = h("div", { class: "task-grid" });
      for (const { areaKey, id } of tasks) {
        const p = progress[id];
        const done = p && p.completed;
        grid.appendChild(
          h("a", { class: "task-card", href: `#/task/${areaKey}/${id}` },
            h("h3", {}, id),
            h("small", {}, `area: ${areaKey}`),
            h("span", { class: `badge ${done ? "done" : ""}`, style: { float: "right" } }, done ? "✓" : "—"),
          )
        );
      }
      list.appendChild(grid);
    }

    if (Object.keys(manifest.areas || {}).length === 0) {
      list.appendChild(h("div", { class: "empty-state" },
        h("p", {}, "Манифест пуст — нет ни одной области. Проверьте content/tasks/manifest.json.")
      ));
    }

    mount(list);
  } catch (e) {
    mount(h("div", { style: { color: "var(--app-wrong)" } }, `Не удалось загрузить манифест: ${e.message}`));
  }
}