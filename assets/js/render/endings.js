// Endings renderer: shows a context + base word, then two cards with two
// alternative forms; the user clicks the correct one. After feedback the
// renderer auto-advances to the next item; at the end a per-item review.
//
// Items may carry an optional `countRange: [min, max]`. When present, the
// renderer picks a random integer in that range at session start and replaces
// `{N}` in `context` / `correct` / `wrong` with the matching Russian cardinal
// ("пять", "шесть", …, "двадцать"); the same number is used across all three
// fields so the cards stay aligned.
//
// Контракт session — такой же, как у других рендереров:
//   { submit(), getAnswer(), reset(), destroy() }
// onAnswer вызывается ровно один раз — в финале, агрегированной оценкой.

import { h } from "../util/dom.js";

const ADVANCE_MS = 1100;

// 1..20 в именительном падеже. Индексируем по n, поэтому пустая строка в [0].
const RU_CARDINALS = [
  "", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь",
  "девять", "десять", "одиннадцать", "двенадцать", "тринадцать",
  "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать",
  "девятнадцать", "двадцать",
];

function ruCardinal(n) {
  if (Number.isInteger(n) && n >= 1 && n <= 20) return RU_CARDINALS[n];
  return String(n);
}

function subToken(s, replacement) {
  if (typeof s !== "string") return "";
  return s.replace(/\{N\}/g, replacement);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function pickCount(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return null;
  const a = Math.round(min);
  const b = Math.round(max);
  if (b === a) return a;
  return a + Math.floor(Math.random() * (b - a + 1));
}

function resolveItem(it) {
  const ctx = typeof it.context === "string" ? it.context : "";
  const word = typeof it.word === "string" ? it.word : "";
  const correct = typeof it.correct === "string" ? it.correct : "";
  const wrong = typeof it.wrong === "string" ? it.wrong : "";
  const note = typeof it.note === "string" ? it.note : "";
  const cr = Array.isArray(it.countRange) && it.countRange.length === 2
    ? it.countRange
    : null;
  if (!cr) {
    return { context: ctx, word, correct, wrong, note, n: null };
  }
  const n = pickCount(Number(cr[0]), Number(cr[1]));
  if (n == null) {
    return { context: ctx, word, correct, wrong, note, n: null };
  }
  const numWord = ruCardinal(n);
  return {
    context: subToken(ctx, numWord),
    word: subToken(word, numWord),
    correct: subToken(correct, numWord),
    wrong: subToken(wrong, numWord),
    note,
    n,
  };
}

export function mount(task, container, hooks = {}) {
  const rawItems = Array.isArray(task.items) ? task.items : [];

  // Валидация и дедупликация: оставляем только осмысленные элементы.
  const cleanItems = [];
  const seen = new Set();
  for (const it of rawItems) {
    if (!it || typeof it !== "object") continue;
    const word = typeof it.word === "string" ? it.word.trim() : "";
    const correct = typeof it.correct === "string" ? it.correct.trim() : "";
    const wrong = typeof it.wrong === "string" ? it.wrong.trim() : "";
    if (!word || !correct || !wrong) continue;
    if (correct === wrong) continue;
    const context = typeof it.context === "string" ? it.context.trim() : "";
    const note = typeof it.note === "string" ? it.note.trim() : "";
    // Сохраняем countRange, если пара задана и диапазон валидный.
    let countRange = null;
    if (Array.isArray(it.countRange) && it.countRange.length === 2) {
      const a = Number(it.countRange[0]);
      const b = Number(it.countRange[1]);
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
        countRange = [Math.round(a), Math.round(b)];
      }
    }
    const key = `${context}${word}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cleanItems.push({ context, word, correct, wrong, note, countRange });
  }

  if (cleanItems.length < 2) {
    container.innerHTML = "";
    container.appendChild(h("p", { style: { color: "var(--app-wrong)" } },
      "Нужно минимум 2 элемента с непустыми полями word / correct / wrong."));
    return null;
  }

  const wrap = h("div", { class: "app-task app-endings" });
  if (task.prompt) wrap.appendChild(h("p", {}, task.prompt));

  const main = h("div", { class: "endings-main" });
  wrap.appendChild(main);

  const live = h("div", { class: "endings-live", "aria-live": "polite", style: { position: "absolute", left: "-9999px", height: "1px", overflow: "hidden" } });
  wrap.appendChild(live);

  container.appendChild(wrap);

  // ─── стейт ─────────────────────────────────────────────────────────────
  let phase = "setup";          // "setup" | "running" | "feedback" | "done"
  let count = clampInt(task.defaultCount, 1, cleanItems.length, cleanItems.length);
  let order = [];               // [{context,word,correct,wrong,note}] в случайном/исходном порядке
  let cursor = 0;               // индекс текущего элемента в order
  let correctCount = 0;
  let perItem = [];             // [{context,word,correct,wrong,isCorrect,chosen}]
  let resultReported = false;
  let advanceTimer = null;
  let currentLayout = null;     // { correctOnLeft: boolean }

  // ─── рендеры ───────────────────────────────────────────────────────────
  function renderSetup() {
    clearTimer();
    phase = "setup";
    cursor = 0;
    correctCount = 0;
    perItem = [];
    order = [];
    resultReported = false;
    currentLayout = null;
    count = clampInt(task.defaultCount, 1, cleanItems.length, count || cleanItems.length);

    main.innerHTML = "";
    const box = h("div", { class: "endings-setup" });

    box.appendChild(h("p", { style: { margin: "0 0 0.5rem" } },
      `Доступно пар: ${cleanItems.length}. Выберите, сколько разобрать:`));

    const ctrl = h("div", { class: "endings-counter" });
    const range = h("input", {
      type: "range",
      min: "1",
      max: String(cleanItems.length),
      value: String(count),
      "aria-label": "Количество слов",
      oninput: (e) => {
        count = Number(e.target.value);
        label.textContent = String(count);
      },
    });
    const label = h("strong", { class: "endings-counter-label" }, String(count));
    const total = h("span", {
      class: "endings-counter-total",
      style: { color: "var(--pico-muted-color)" },
    }, `/ ${cleanItems.length}`);
    ctrl.append(range, total, label);
    box.appendChild(ctrl);

    box.appendChild(h("button", { type: "button", onclick: () => start() }, "Начать"));
    main.appendChild(box);
  }

  function start() {
    const pool = cleanItems.slice();
    if (task.shuffle !== false) shuffleInPlace(pool);
    // Разрешаем плейсхолдеры {N} сразу на старте сессии: одно число на элемент.
    order = pool.slice(0, count).map(resolveItem);
    phase = "running";
    cursor = 0;
    correctCount = 0;
    perItem = [];
    renderItem();
  }

  function renderItem() {
    clearTimer();
    if (cursor >= order.length) { finish(); return; }
    const it = order[cursor];

    // Случайно кладём правильный вариант на левую или правую карточку — иначе
    // пользователь запомнит расположение, а не форму.
    currentLayout = { correctOnLeft: Math.random() < 0.5 };
    const leftText = currentLayout.correctOnLeft ? it.correct : it.wrong;
    const rightText = currentLayout.correctOnLeft ? it.wrong : it.correct;

    main.innerHTML = "";
    main.appendChild(h("div", { class: "endings-head" },
      h("span", { style: { color: "var(--pico-muted-color)" } },
        `Пара ${cursor + 1} из ${order.length}`)
    ));

    const q = h("div", { class: "endings-question" });
    if (it.context) {
      q.appendChild(h("span", { class: "endings-context" }, it.context));
    }
    q.appendChild(h("strong", { class: "endings-word" }, it.word));
    main.appendChild(q);

    const pair = h("div", { class: "endings-pair", role: "group", "aria-label": `Выбор формы для «${it.word}»` });

    const cardA = h("button", {
      type: "button",
      class: "endings-card",
      onclick: () => choose("a"),
      "data-side": "a",
      "aria-label": `Вариант 1: ${leftText}`,
    }, leftText);

    const cardB = h("button", {
      type: "button",
      class: "endings-card",
      onclick: () => choose("b"),
      "data-side": "b",
      "aria-label": `Вариант 2: ${rightText}`,
    }, rightText);

    pair.append(cardA, cardB);
    main.appendChild(pair);

    main.appendChild(h("p", { class: "endings-hint" },
      "Нажмите на карточку с правильной формой."));
  }

  function choose(whichCard) {
    if (phase !== "running" || !currentLayout) return;
    phase = "feedback";

    const it = order[cursor];
    const clickedCorrect = (whichCard === "a")
      ? currentLayout.correctOnLeft
      : !currentLayout.correctOnLeft;

    if (clickedCorrect) correctCount++;
    const chosenText = whichCard === "a"
      ? (currentLayout.correctOnLeft ? it.correct : it.wrong)
      : (currentLayout.correctOnLeft ? it.wrong : it.correct);

    perItem.push({
      context: it.context,
      word: it.word,
      correct: it.correct,
      wrong: it.wrong,
      isCorrect: clickedCorrect,
      chosen: chosenText,
      note: it.note,
    });

    // Заблокированный рендер — одна карточка «выбрана», другая «проиграла».
    main.innerHTML = "";

    main.appendChild(h("div", { class: "endings-head" },
      h("span", { style: { color: "var(--pico-muted-color)" } },
        `Пара ${cursor + 1} из ${order.length}`)
    ));

    const q = h("div", { class: "endings-question" });
    if (it.context) {
      q.appendChild(h("span", { class: "endings-context" }, it.context));
    }
    q.appendChild(h("strong", { class: "endings-word" }, it.word));
    main.appendChild(q);

    const leftText = currentLayout.correctOnLeft ? it.correct : it.wrong;
    const rightText = currentLayout.correctOnLeft ? it.wrong : it.correct;
    const aChosen = whichCard === "a";
    const bChosen = whichCard === "b";

    let aClass = "endings-card locked";
    if (currentLayout.correctOnLeft) {
      aClass += aChosen ? " chosen-correct" : " revealed-correct";
    } else {
      aClass += aChosen ? " chosen-wrong" : " faded";
    }
    let bClass = "endings-card locked";
    if (!currentLayout.correctOnLeft) {
      bClass += bChosen ? " chosen-correct" : " revealed-correct";
    } else {
      bClass += bChosen ? " chosen-wrong" : " faded";
    }

    const pair = h("div", { class: "endings-pair locked", role: "group", "aria-hidden": "true" });
    pair.append(
      h("div", { class: aClass }, leftText),
      h("div", { class: bClass }, rightText),
    );
    main.appendChild(pair);

    main.appendChild(h("p", {
      class: clickedCorrect ? "endings-fb correct" : "endings-fb wrong",
    }, clickedCorrect
      ? "✓ Верно"
      : `✗ Правильно: ${it.correct}`));

    if (clickedCorrect) {
      live.textContent = "Верно";
    } else {
      live.textContent = `Неверно. Правильно: ${it.correct}`;
    }

    advanceTimer = setTimeout(() => {
      cursor++;
      currentLayout = null;
      phase = "running";
      renderItem();
    }, ADVANCE_MS);
  }

  function finish() {
    clearTimer();
    phase = "done";

    const total = order.length;
    const pct = total > 0 ? correctCount / total : 0;

    main.innerHTML = "";
    main.appendChild(h("h3", { style: { marginTop: 0 } }, "Готово!"));
    main.appendChild(h("p", { class: "endings-big" },
      `${correctCount} / ${total} (${Math.round(pct * 100)}%)`));

    if (task.explanation) {
      main.appendChild(h("p", { class: "endings-explanation" }, task.explanation));
    }

    const review = h("ul", { class: "endings-review" });
    for (const r of perItem) {
      const label = r.context ? `${r.context}: ${r.word}` : r.word;
      review.appendChild(h("li", {
        class: r.isCorrect ? "review-ok" : "review-no",
      }, `${label} → ${r.correct} ${r.isCorrect ? "✓" : "✗"}`));
    }
    main.appendChild(h("details", { open: "" },
      h("summary", {}, "Разбор пар"),
      review));

    const actions = h("div", { class: "endings-actions" });
    actions.appendChild(h("button", { type: "button", onclick: () => renderSetup() }, "Ещё раз"));
    actions.appendChild(h("a", {
      role: "button",
      class: "secondary",
      href: "#/",
      style: { textDecoration: "none" },
    }, "К списку"));
    main.appendChild(actions);

    if (!resultReported) {
      resultReported = true;
      const isCorrect = pct >= 0.5;
      const result = { score: pct, isCorrect, raw: { correctCount, total, perItem } };
      if (hooks.onAnswer) hooks.onAnswer(result);
    }
  }

  function clearTimer() {
    if (advanceTimer != null) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  function destroy() {
    clearTimer();
    wrap.remove();
  }

  function getAnswer() {
    return { phase, correctCount, total: order.length, perItem };
  }

  function reset() {
    renderSetup();
  }

  async function submit() {
    if (phase === "done") {
      const total = order.length;
      const pct = total > 0 ? correctCount / total : 0;
      return { score: pct, isCorrect: pct >= 0.5, raw: getAnswer() };
    }
    return { score: 0, isCorrect: false, raw: getAnswer() };
  }

  renderSetup();

  return { submit, getAnswer, reset, destroy };
}
