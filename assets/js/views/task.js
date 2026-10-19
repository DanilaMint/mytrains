// Страница одной задачи: рендерит заголовок + вызывает engine.runTask.

import { loadTask, runTask } from "../engine.js";
import { recordAttempt } from "../store.js";
import { h } from "../util/dom.js";

export async function taskView(id, mount) {
  let session = null;
  try {
    const task = await loadTask(id);

    const container = h("div", { class: "app-task-container" });
    container.appendChild(h("p", { style: { margin: 0 } },
      h("a", { href: "#/" }, "← Главная")));
    container.appendChild(h("h2", { style: { marginTop: "0.25rem" } }, task.title || id));

    const meta = [];
    if (task.subarea) meta.push(task.subarea);
    if (task.level) meta.push(task.level);
    if (task.tags && task.tags.length) meta.push(task.tags.join(", "));
    if (meta.length) {
      container.appendChild(h("p", { style: { color: "var(--pico-muted-color)", margin: 0, fontSize: "0.85rem" } }, meta.join(" · ")));
    }

    const body = h("div", { class: "app-task-body", style: { marginTop: "1rem" } });
    container.appendChild(body);

    mount(container);

    session = await runTask(task, body, {
      onAnswer: (result) => {
        recordAttempt(task.id, {
          correct: !!result.isCorrect,
          score: result.score,
          raw: result.raw,
        });
      },
    });

    return () => session && session.destroy && session.destroy();
  } catch (e) {
    mount(h("article", {},
      h("h2", {}, "Не удалось загрузить задачу"),
      h("p", { style: { color: "var(--app-wrong)" } }, e.message),
      h("p", {}, h("a", { href: "#/" }, "← на главную")),
    ));
    return () => session && session.destroy && session.destroy();
  }
}