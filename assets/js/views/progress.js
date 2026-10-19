// Страница прогресса: статистика + импорт/экспорт/сброс.

import { exportJSON, importJSON, reset, getAllProgress, getStreak, isStorageAvailable } from "../store.js";
import { h } from "../util/dom.js";

export async function progressView(_params, _query, mount) {
  const wrap = h("div", { class: "app-progress" });
  wrap.appendChild(h("h2", {}, "Прогресс"));

  if (!isStorageAvailable()) {
    wrap.appendChild(h("p", { style: { color: "var(--app-wrong)" } },
      "localStorage недоступен — прогресс не сохраняется в этой сессии."));
  }

  const all = getAllProgress();
  const ids = Object.keys(all);
  const totalAttempts = ids.reduce((s, id) => s + (all[id].attempts || 0), 0);
  const totalCorrect = ids.reduce((s, id) => s + (all[id].correct || 0), 0);
  const completed = ids.filter((id) => all[id].completed).length;
  const streak = getStreak();

  const stats = h("div", { class: "stat-grid" },
    tile(`${ids.length}`, "задач тронуто"),
    tile(`${completed}`, "задач решено"),
    tile(`${totalAttempts}`, "попыток всего"),
    tile(`${totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0}%`, "точность"),
    tile(`🔥 ${streak.count}`, `день ${streak.lastDay || "—"}`),
  );
  wrap.appendChild(stats);

  if (ids.length === 0) {
    wrap.appendChild(h("div", { class: "empty-state" },
      h("p", {}, "Прогресса пока нет."),
      h("p", { style: { fontSize: "0.85rem" } }, "Решите хотя бы одну задачу — статистика появится здесь.")
    ));
  } else {
    wrap.appendChild(h("h3", { style: { marginTop: "1rem" } }, "По задачам"));
    const table = h("table", { style: { width: "100%" } });
    const tbody = h("tbody", {});
    for (const id of ids.sort()) {
      const p = all[id];
      const tr = h("tr", {},
        h("td", {}, h("a", { href: `#/task/${id}` }, id)),
        h("td", {}, `${p.correct}/${p.attempts}`),
        h("td", {}, p.completed ? h("span", { class: "badge done" }, "✓") : h("span", { class: "badge" }, "—")),
      );
      tbody.appendChild(tr);
    }
    table.appendChild(h("thead", {}, h("tr", {}, h("th", {}, "id"), h("th", {}, "correct/attempts"), h("th", {}, "done"))));
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  // Импорт / Экспорт / Сброс
  let fileInput = null;
  const tools = h("details", { style: { marginTop: "1.5rem" } },
    h("summary", {}, "Импорт / Экспорт / Сброс"),
    h("p", { style: { fontSize: "0.85rem", color: "var(--pico-muted-color)" } },
      "Экспортируйте прогресс перед очисткой кеша браузера. Импорт перезаписывает текущий прогресс."),
    h("div", { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap" } },
      h("button", { type: "button", onclick: doExport }, "Скачать JSON"),
      h("button", { type: "button", class: "secondary", onclick: doImport }, "Загрузить JSON"),
      h("button", { type: "button", class: "contrast", onclick: doReset }, "Сбросить прогресс"),
    ),
  );
  wrap.appendChild(tools);

  function ensureFileInput() {
    if (fileInput) return fileInput;
    fileInput = h("input", { type: "file", accept: "application/json", style: { display: "none" } });
    fileInput.addEventListener("change", () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          importJSON(String(reader.result));
          navigateRefresh();
        } catch (e) {
          alert("Невалидный JSON: " + e.message);
        }
      };
      reader.readAsText(fileInput);
      fileInput.value = "";
    });
    document.body.appendChild(fileInput);
    return fileInput;
  }

  function doImport() {
    ensureFileInput().click();
  }

  function doExport() {
    const text = exportJSON();
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: `learning-hub-progress-${Date.now()}.json` });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function doReset() {
    if (confirm("Точно сбросить весь прогресс?")) {
      reset();
      navigateRefresh();
    }
  }

  function navigateRefresh() {
    // Перерендерить текущий view — самый простой способ через роутер.
    location.hash = "#/progress?" + Date.now();
  }

  mount(wrap);
}

function tile(value, label) {
  return h("div", { class: "stat-tile" },
    h("div", { class: "stat-value" }, value),
    h("div", { class: "stat-label" }, label),
  );
}