// Страница области: список задач.

import { loadManifest } from "../engine.js";
import { getAllProgress } from "../store.js";
import { h } from "../util/dom.js";

export async function areaView(areaKey, mount) {
  try {
    const manifest = await loadManifest();
    const area = manifest.areas[areaKey];
    if (!area) {
      mount(h("article", {},
        h("h2", {}, "Область не найдена"),
        h("p", {}, `Ключ «${areaKey}» отсутствует в манифесте.`),
        h("p", {}, h("a", { href: "#/" }, "← на главную")),
      ));
      return;
    }

    const progress = getAllProgress();
    const wrap = h("div", { class: "app-area" });

    const header = h("div", { style: { marginBottom: "1rem" } },
      h("p", { style: { margin: 0 } }, h("a", { href: "#/" }, "← Главная")),
      h("h2", { style: { marginTop: "0.25rem" } }, area.title || areaKey),
      area.subtitle ? h("p", { style: { color: "var(--pico-muted-color)", margin: 0 } }, area.subtitle) : null,
    );
    wrap.appendChild(header);

    const tasks = area.tasks || [];
    if (tasks.length === 0) {
      wrap.appendChild(h("div", { class: "empty-state" },
        h("p", {}, "Пока нет задач в этой области."),
        h("p", { style: { fontSize: "0.85rem" } }, "Скажите Claude Code: «добавь задание про …» — skill создаст файл и пропатчит манифест.")
      ));
    } else {
      const list = h("div", { style: { display: "grid", gap: "0.5rem" } });
      for (const id of tasks) {
        const p = progress[id];
        const done = p && p.completed;
        const card = h("a", { class: "task-card", href: `#/task/${areaKey}/${id}` },
          h("h3", {}, id),
          h("small", {}, `area: ${areaKey}`),
          h("span", { class: `badge ${done ? "done" : ""}`, style: { float: "right" } }, done ? "✓" : "—"),
        );
        list.appendChild(card);
      }
      wrap.appendChild(list);
    }

    mount(wrap);
  } catch (e) {
    mount(h("div", { style: { color: "var(--app-wrong)" } }, `Ошибка: ${e.message}`));
  }
}