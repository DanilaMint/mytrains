// Matching-рендерер: drag-and-drop (HTML5) + tap-to-select fallback для тача.

import { h } from "../util/dom.js";

export function mount(task, container, hooks = {}) {
  container.innerHTML = "";

  const pairs = task.pairs || [];
  if (pairs.length < 2) {
    container.innerHTML = `<p>Matching требует минимум 2 пары.</p>`;
    return null;
  }

  const wrap = h("div", { class: "app-task" });
  if (task.prompt) wrap.appendChild(h("p", {}, task.prompt));

  // Внутренняя модель: пары → левая колонка с id "L{idx}", правая "R{idx}".
  const leftItems = pairs.map((p, i) => ({ id: `L${i}`, text: p.left }));
  const rightItems = pairs.map((p, i) => ({ id: `R${i}`, text: p.right }));
  const shuffleMode = task.shuffle || "both";
  if (shuffleMode === "both" || shuffleMode === "left") shuffleInPlace(leftItems);
  if (shuffleMode === "both" || shuffleMode === "right") shuffleInPlace(rightItems);

  // selection: rightId -> leftId
  const selection = new Map();
  let dragLeftId = null;
  let tapLeftId = null;

  const grid = h("div", { class: "matching-grid" });
  const leftCol = h("div", { class: "matching-col" });
  const rightCol = h("div", { class: "matching-col" });
  leftCol.appendChild(h("h4", {}, task.leftHeader || "Term"));
  rightCol.appendChild(h("h4", {}, task.rightHeader || "Definition"));

  const leftNodes = new Map();
  const rightNodes = new Map();

  leftItems.forEach((it) => {
    const el = h("div", {
      class: "matching-item",
      draggable: "true",
      "data-left-id": it.id,
    }, it.text);
    el.addEventListener("dragstart", (e) => {
      dragLeftId = it.id;
      try { e.dataTransfer.setData("text/plain", it.id); } catch {}
      el.classList.add("dragging");
    });
    el.addEventListener("dragend", () => {
      dragLeftId = null;
      el.classList.remove("dragging");
    });
    el.addEventListener("click", () => onLeftTap(it.id));
    leftNodes.set(it.id, el);
    leftCol.appendChild(el);
  });

  rightItems.forEach((it) => {
    const el = h("div", {
      class: "matching-item",
      "data-right-id": it.id,
    }, it.text);
    el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("drop-target"); });
    el.addEventListener("dragleave", () => el.classList.remove("drop-target"));
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("drop-target");
      const lid = (() => { try { return e.dataTransfer.getData("text/plain"); } catch { return ""; } })() || dragLeftId;
      if (lid) assign(lid, it.id);
    });
    el.addEventListener("click", () => onRightTap(it.id));
    rightNodes.set(it.id, el);
    rightCol.appendChild(el);
  });

  grid.append(leftCol, rightCol);
  wrap.appendChild(grid);

  const hint = h("p", { style: { fontSize: "0.8rem", color: "var(--pico-muted-color)" } },
    "Перетащите термин на определение, либо нажмите на термин, затем на определение.");
  wrap.appendChild(hint);

  const actions = h("div", { style: { marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" } });
  const submitBtn = h("button", { type: "button", onclick: () => submit() }, "Проверить");
  const resetBtn = h("button", { type: "button", class: "secondary", onclick: () => reset() }, "Сбросить");
  actions.append(submitBtn, resetBtn);
  wrap.appendChild(actions);

  const feedback = h("div", { class: "app-feedback" });
  wrap.appendChild(feedback);

  container.appendChild(wrap);

  function assign(leftId, rightId) {
    // Удалить предыдущие привязки, где участвует этот leftId или этот rightId.
    for (const [rid, lid] of [...selection.entries()]) {
      if (lid === leftId || rid === rightId) selection.delete(rid);
    }
    selection.set(rightId, leftId);
    renderSelections();
    tapLeftId = null;
    clearTapHighlights();
  }

  function renderSelections() {
    for (const el of leftNodes.values()) el.classList.remove("matched");
    for (const el of rightNodes.values()) el.classList.remove("matched");
    for (const [rid, lid] of selection.entries()) {
      leftNodes.get(lid)?.classList.add("matched");
      rightNodes.get(rid)?.classList.add("matched");
    }
  }

  function clearTapHighlights() {
    for (const el of leftNodes.values()) el.classList.remove("drop-target");
    for (const el of rightNodes.values()) el.classList.remove("drop-target");
  }

  function onLeftTap(leftId) {
    if (tapLeftId === leftId) {
      tapLeftId = null;
      clearTapHighlights();
      return;
    }
    tapLeftId = leftId;
    clearTapHighlights();
    leftNodes.get(leftId)?.classList.add("drop-target");
  }

  function onRightTap(rightId) {
    if (tapLeftId) assign(tapLeftId, rightId);
  }

  function countCorrect() {
    let c = 0;
    for (const [rid, lid] of selection.entries()) {
      if (lid === rid.replace(/^R/, "L")) c++; // L0↔R0, L1↔R1 и т.п.
    }
    return c;
  }

  function submit() {
    const total = pairs.length;
    const correct = countCorrect();
    const score = total > 0 ? correct / total : 0;
    const isCorrect = correct === total;
    const result = { score, isCorrect, raw: Object.fromEntries(selection) };
    showFeedback(correct, total);
    if (hooks.onAnswer) hooks.onAnswer(result);
    return result;
  }

  function showFeedback(correct, total) {
    submitBtn.disabled = true;
    feedback.innerHTML = "";

    const klass = correct === total ? "correct" : "wrong";
    const banner = h("div", { class: `app-result-banner ${klass}` });
    banner.textContent = correct === total
      ? `✓ Все пары верны (${correct}/${total})`
      : `✗ ${correct}/${total} пар верно`;
    feedback.appendChild(banner);

    if (task.explanation) feedback.appendChild(h("p", { style: { marginTop: "0.5rem" } }, task.explanation));
  }

  function reset() {
    submitBtn.disabled = false;
    selection.clear();
    tapLeftId = null;
    renderSelections();
    clearTapHighlights();
    feedback.innerHTML = "";
  }

  function destroy() {
    wrap.remove();
  }

  return {
    submit: async () => submit(),
    getAnswer: () => Object.fromEntries(selection),
    reset,
    destroy,
  };
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}