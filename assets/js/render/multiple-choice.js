// Multiple-choice рендерер.
// Контракт session: { submit(), getAnswer(), reset(), destroy() }

import { h } from "../util/dom.js";

export function mount(task, container, hooks = {}) {
  container.innerHTML = "";

  const wrap = h("div", { class: "app-task" });
  if (task.prompt) wrap.appendChild(h("p", {}, task.prompt));
  if (task.question) wrap.appendChild(h("p", { style: { fontWeight: "500" } }, task.question));

  const fieldset = h("fieldset", { role: task.multi ? "group" : "radiogroup" });

  let order = task.choices.map((_, i) => i);
  if (task.shuffle !== false) order = shuffle(order);

  const inputType = task.multi ? "checkbox" : "radio";
  const inputName = `mc-${task.id}`;

  for (const idx of order) {
    const c = task.choices[idx];
    const id = `${inputName}-${c.id}`;
    const input = h("input", { type: inputType, id, name: inputName, value: c.id });
    const label = h("label", { for: id }, input, " ", c.text);
    fieldset.appendChild(label);
  }

  wrap.appendChild(fieldset);

  const actions = h("div", { style: { marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" } });
  const submitBtn = h("button", { type: "button", onclick: () => submit() }, "Проверить");
  const resetBtn = h("button", { type: "button", class: "secondary", onclick: () => reset() }, "Сбросить");
  actions.append(submitBtn, resetBtn);
  wrap.appendChild(actions);

  const feedback = h("div", { class: "app-feedback" });
  wrap.appendChild(feedback);

  container.appendChild(wrap);

  let submitted = false;
  let lastResult = null;

  function getAnswer() {
    const inputs = fieldset.querySelectorAll("input");
    const ids = [];
    inputs.forEach((i) => { if (i.checked) ids.push(i.value); });
    return ids;
  }

  function arraysEqualAsSets(a, b) {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    return b.every((x) => setA.has(x));
  }

  function submit() {
    if (submitted) return lastResult;
    submitted = true;
    const chosen = getAnswer();
    const isCorrect = arraysEqualAsSets(chosen, task.answer || []);
    const score = isCorrect ? 1 : 0;
    lastResult = { score, isCorrect, raw: chosen };
    showFeedback(isCorrect, chosen);
    if (hooks.onAnswer) hooks.onAnswer(lastResult);
    return lastResult;
  }

  function showFeedback(isCorrect, chosen) {
    submitBtn.disabled = true;
    fieldset.querySelectorAll("input").forEach((i) => { i.disabled = true; });
    feedback.innerHTML = "";

    const banner = h("div", { class: `app-result-banner ${isCorrect ? "correct" : "wrong"}` });
    if (isCorrect) {
      banner.textContent = "✓ Верно";
    } else {
      const correctIds = task.answer || [];
      const correctTexts = task.choices.filter((c) => correctIds.includes(c.id)).map((c) => c.text);
      banner.textContent = `✗ Неверно. Правильный ответ: ${correctTexts.join(" / ")}`;
    }
    feedback.appendChild(banner);

    if (task.explanation) feedback.appendChild(h("p", { style: { marginTop: "0.5rem" } }, task.explanation));
  }

  function reset() {
    submitted = false;
    lastResult = null;
    submitBtn.disabled = false;
    fieldset.querySelectorAll("input").forEach((i) => { i.checked = false; i.disabled = false; });
    feedback.innerHTML = "";
  }

  function destroy() {
    wrap.remove();
  }

  return {
    submit: async () => submit(),
    getAnswer,
    reset,
    destroy,
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}