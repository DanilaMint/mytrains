// Free-text рендерер. Проверка через util/matcher.js — никаких RegExp от пользователя.

import { h } from "../util/dom.js";
import { evaluate } from "../util/matcher.js";

export function mount(task, container, hooks = {}) {
  container.innerHTML = "";

  const wrap = h("div", { class: "app-task" });
  if (task.prompt) wrap.appendChild(h("p", {}, task.prompt));
  if (task.question) wrap.appendChild(h("p", { style: { fontWeight: "500" } }, task.question));
  if (task.source) wrap.appendChild(h("blockquote", {}, task.source));

  const textarea = h("textarea", { rows: 3, placeholder: "Введите ответ..." });
  wrap.appendChild(textarea);

  const actions = h("div", { style: { marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" } });
  const submitBtn = h("button", { type: "button", onclick: () => submit() }, "Проверить");
  const resetBtn = h("button", { type: "button", class: "secondary", onclick: () => reset() }, "Сбросить");
  actions.append(submitBtn, resetBtn);
  wrap.appendChild(actions);

  const feedback = h("div", { class: "app-feedback" });
  wrap.appendChild(feedback);

  container.appendChild(wrap);

  let submitted = false;
  let lastResult = null;

  function submit() {
    if (submitted) return lastResult;
    submitted = true;
    const raw = textarea.value;
    const ev = evaluate(raw, task);
    lastResult = { score: ev.score, isCorrect: ev.isCorrect, raw };
    showFeedback(ev, raw);
    if (hooks.onAnswer) hooks.onAnswer(lastResult);
    return lastResult;
  }

  function showFeedback(ev, raw) {
    submitBtn.disabled = true;
    textarea.disabled = true;
    feedback.innerHTML = "";

    const klass = ev.isCorrect ? "correct" : "wrong";
    const banner = h("div", { class: `app-result-banner ${klass}` });
    if (ev.isCorrect) {
      banner.textContent = `✓ Принято (${(ev.score * 100).toFixed(0)}%)`;
    } else {
      banner.textContent = `✗ Не принято. Совпадений ключевых слов: ${ev.keywordHits}.`;
    }
    feedback.appendChild(banner);

    if (task.explanation) {
      feedback.appendChild(h("p", { style: { marginTop: "0.5rem" } }, task.explanation));
    }

    if (!ev.isCorrect && Array.isArray(task.expectedAnswers) && task.expectedAnswers.length > 0) {
      const sample = task.expectedAnswers.slice(0, 3).map((e) => e.text).join(" / ");
      feedback.appendChild(h("p", {
        style: { fontStyle: "italic", color: "var(--pico-muted-color)", marginTop: "0.25rem" }
      }, `Возможные формулировки: ${sample}`));
    }
  }

  function reset() {
    submitted = false;
    lastResult = null;
    submitBtn.disabled = false;
    textarea.disabled = false;
    textarea.value = "";
    feedback.innerHTML = "";
  }

  function destroy() {
    wrap.remove();
  }

  return {
    submit: async () => submit(),
    getAnswer: () => textarea.value,
    reset,
    destroy,
  };
}