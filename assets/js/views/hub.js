// Главная страница: единый плоский список всех задач из манифеста.

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
      "Плоский список. Нажмите на карточку, чтобы открыть задание."
    ));

    const tasks = manifest.tasks || [];

    if (tasks.length === 0) {
      list.appendChild(h("div", { class: "empty-state" },
        h("p", {}, "Пока нет ни одной задачи."),
        h("p", { style: { fontSize: "0.85rem" } },
          "Скажите Claude Code: «добавь задание про …» — skill создаст файл и пропатчит манифест."
        )
      ));
    } else {
      const grid = h("div", { class: "task-grid" });
      for (const id of tasks) {
        const p = progress[id];
        const done = p && p.completed;
        grid.appendChild(
          h("a", { class: "task-card", href: `#/task/${id}` },
            h("h3", {}, id),
            h("span", { class: `badge ${done ? "done" : ""}`, style: { float: "right" } }, done ? "✓" : "—"),
          )
        );
      }
      list.appendChild(grid);
    }

    mount(list);
  } catch (e) {
    mount(h("div", { style: { color: "var(--app-wrong)" } }, `Не удалось загрузить манифест: ${e.message}`));
  }
}