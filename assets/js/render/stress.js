// Stress-task renderer.
// UX: setup screen (slider for count) → for each word: letters in squares,
// a button above every vowel; on hover the button reveals `.`; click sets
// the stress on that vowel and auto-advances to the next word; at the end
// a stats screen with a per-word review.
//
// Контракт session — такой же, как у других рендереров:
//   { submit(), getAnswer(), reset(), destroy() }
// onAnswer вызывается ровно один раз — в финале, агрегированной оценкой.

import { h } from "../util/dom.js";

const VOWELS = new Set(["а", "е", "ё", "и", "о", "у", "ы", "э", "ю", "я"]);
const ADVANCE_MS = 750;

function isVowel(ch) {
  return VOWELS.has((ch || "").toLowerCase());
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function markStress(word, idx) {
  // Поднять регистр ударной гласной — используется в разборе после финиша.
  return word.slice(0, idx) + word[idx].toUpperCase() + word.slice(idx + 1);
}

function clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function mount(task, container, hooks = {}) {
  const words = Array.isArray(task.words) ? task.words : [];
  if (words.length === 0) {
    container.innerHTML = "";
    container.appendChild(h("p", { style: { color: "var(--app-wrong)" } }, "Задача не содержит слов."));
    return null;
  }

  // Базовая валидация слов: фильтруем мусор и дедуплицируем.
  const cleanWords = [];
  const seen = new Set();
  for (const w of words) {
    if (!w || typeof w.word !== "string" || typeof w.stress !== "number") continue;
    const key = w.word.toLowerCase();
    if (seen.has(key)) continue;
    if (w.stress < 0 || w.stress >= w.word.length) continue;
    if (!isVowel(w.word[w.stress])) continue;
    seen.add(key);
    cleanWords.push({ word: w.word, stress: w.stress });
  }
  if (cleanWords.length < 2) {
    container.innerHTML = "";
    container.appendChild(h("p", { style: { color: "var(--app-wrong)" } },
      "Нужно как минимум 2 валидных слова (стресс — индекс ударной гласной)."));
    return null;
  }

  const wrap = h("div", { class: "app-task app-stress" });
  if (task.prompt) wrap.appendChild(h("p", {}, task.prompt));

  const main = h("div", { class: "stress-main" });
  wrap.appendChild(main);

  // Скрытая live-region для скринридеров: «верно/неверно» между словами.
  const live = h("div", { class: "stress-live", "aria-live": "polite", style: { position: "absolute", left: "-9999px", height: "1px", overflow: "hidden" } });
  wrap.appendChild(live);

  container.appendChild(wrap);

  // ─── стейт ─────────────────────────────────────────────────────────────
  let phase = "setup";          // "setup" | "running" | "feedback" | "done"
  let count = clampInt(task.defaultCount, 1, cleanWords.length, cleanWords.length);
  let order = [];               // [{word, stress}] в случайном/исходном порядке
  let cursor = 0;               // индекс текущего слова в order
  let correctCount = 0;
  let perWord = [];             // [{word, chosen, isCorrect}]
  let resultReported = false;
  let advanceTimer = null;

  // ─── рендеры ───────────────────────────────────────────────────────────
  function renderSetup() {
    clearTimer();
    phase = "setup";
    cursor = 0;
    correctCount = 0;
    perWord = [];
    order = [];
    resultReported = false;
    count = clampInt(task.defaultCount, 1, cleanWords.length, count || cleanWords.length);

    main.innerHTML = "";
    const box = h("div", { class: "stress-setup" });

    box.appendChild(h("p", { style: { margin: "0 0 0.5rem" } },
      `Доступно слов: ${cleanWords.length}. Выберите, сколько разобрать:`));

    const ctrl = h("div", { class: "stress-counter" });
    const range = h("input", {
      type: "range",
      min: "1",
      max: String(cleanWords.length),
      value: String(count),
      "aria-label": "Количество слов",
      oninput: (e) => {
        count = Number(e.target.value);
        label.textContent = String(count);
      },
    });
    const label = h("strong", { class: "stress-counter-label" }, String(count));
    const total = h("span", { class: "stress-counter-total", style: { color: "var(--pico-muted-color)" } },
      `/ ${cleanWords.length}`);
    ctrl.append(range, total, label);
    box.appendChild(ctrl);

    box.appendChild(h("button", { type: "button", onclick: () => start() }, "Начать"));
    main.appendChild(box);
  }

  function start() {
    const pool = cleanWords.slice();
    if (task.shuffle !== false) shuffleInPlace(pool);
    order = pool.slice(0, count);
    phase = "running";
    cursor = 0;
    correctCount = 0;
    perWord = [];
    renderWord();
  }

  function renderWord() {
    clearTimer();
    if (cursor >= order.length) { finish(); return; }
    const w = order[cursor];

    main.innerHTML = "";
    main.appendChild(h("div", { class: "stress-head" },
      h("span", { style: { color: "var(--pico-muted-color)" } },
        `Слово ${cursor + 1} из ${order.length}`)
    ));

    const wordBox = h("div", {
      class: "stress-word",
      role: "group",
      "aria-label": `Слово ${w.word}`,
    });
    // Сообщаем CSS длину слова — по ней через container queries вычисляется
    // размер каждой клетки: длинные слова ужимаются, короткие — нет.
    wordBox.style.setProperty("--n", String(w.word.length));

    for (let i = 0; i < w.word.length; i++) {
      const ch = w.word[i];
      const col = h("div", { class: "stress-cell" });

      if (isVowel(ch)) {
        const btn = h("button", {
          type: "button",
          class: "stress-btn",
          "aria-label": `Поставить ударение на «${ch.toUpperCase()}»`,
          onclick: () => chooseStress(i, w),
        }, h("span", { class: "stress-btn-glyph", "aria-hidden": "true" }, "·"));
        col.appendChild(btn);
      } else {
        col.appendChild(h("div", { class: "stress-empty", "aria-hidden": "true" }));
      }

      col.appendChild(h("div", { class: "stress-tile", "aria-hidden": "true" }, ch.toUpperCase()));
      wordBox.appendChild(col);
    }
    main.appendChild(wordBox);

    main.appendChild(h("p", { class: "stress-hint" },
      "Наведите курсор на квадратик над гласной — внутри появится знак «·». Нажмите, чтобы выбрать."));
  }

  function chooseStress(vowelPos, w) {
    if (phase !== "running") return;
    phase = "feedback";

    const isCorrect = vowelPos === w.stress;
    if (isCorrect) correctCount++;
    perWord.push({ word: w.word, chosen: vowelPos, expected: w.stress, isCorrect });

    // Заблокированный рендер: выбранная ячейка подсвечена, остальные неактивны.
    main.innerHTML = "";
    const wordBox = h("div", {
      class: "stress-word stress-locked",
      role: "group",
      "aria-label": `Результат: ${w.word}`,
    });
    // Та же CSS-переменная, что и в обычном рендере — иначе в заблокированном
    // состоянии клетки «вернулись» бы к дефолту и смотрелись бы иначе.
    wordBox.style.setProperty("--n", String(w.word.length));

    // Состояние ячейки по её индексу: что показать — выбранный (верно/неверно),
    // раскрытый правильный при ошибке, либо нейтральный «неактив».
    //   null   → согласная, рисуем пустой плейсхолдер и обычную плитку.
    //   "inactive" → гласная, в которую не попали (серая).
    //   "chosen-correct" / "chosen-wrong" → то, во что кликнул пользователь.
    //   "revealed-correct" → при ошибке подсвечиваем «настоящее» ударение.
    const cellState = (i) => {
      if (i === vowelPos) return isCorrect ? "chosen-correct" : "chosen-wrong";
      if (!isCorrect && i === w.stress) return "revealed-correct";
      return "inactive";
    };

    for (let i = 0; i < w.word.length; i++) {
      const ch = w.word[i];
      const col = h("div", { class: "stress-cell" });
      const state = isVowel(ch) ? cellState(i) : null;

      if (state) {
        col.appendChild(h("div", { class: `stress-btn ${state}`, "aria-hidden": "true" },
          h("span", { class: "stress-btn-glyph" }, "·")));
      } else {
        col.appendChild(h("div", { class: "stress-empty", "aria-hidden": "true" }));
      }

      // У плитки состояние проявляется только если это не просто «нейтральный»
      // режим: иначе остаётся дефолтный .stress-tile без подкрашивания.
      const tileClass = (state && state !== "inactive")
        ? `stress-tile ${state}`
        : "stress-tile";
      col.appendChild(h("div", { class: tileClass, "aria-hidden": "true" }, ch.toUpperCase()));
      wordBox.appendChild(col);
    }
    main.appendChild(wordBox);

    main.appendChild(h("p", {
      class: isCorrect ? "stress-fb correct" : "stress-fb wrong",
    }, isCorrect
      ? "✓ Верно"
      : `✗ Правильно: ${markStress(w.word, w.stress)}`));

    if (isCorrect) {
      live.textContent = "Верно";
    } else {
      live.textContent = `Неверно. Ударение: ${markStress(w.word, w.stress)}`;
    }

    advanceTimer = setTimeout(() => {
      cursor++;
      phase = "running";
      renderWord();
    }, ADVANCE_MS);
  }

  function finish() {
    clearTimer();
    phase = "done";

    const total = order.length;
    const pct = total > 0 ? correctCount / total : 0;

    main.innerHTML = "";
    main.appendChild(h("h3", { style: { marginTop: 0 } }, "Готово!"));
    main.appendChild(h("p", { class: "stress-big" },
      `${correctCount} / ${total} (${Math.round(pct * 100)}%)`));

    if (task.explanation) {
      main.appendChild(h("p", { class: "stress-explanation" }, task.explanation));
    }

    const review = h("ul", { class: "stress-review" });
    for (const r of perWord) {
      review.appendChild(h("li", {
        class: r.isCorrect ? "review-ok" : "review-no",
      }, `${markStress(r.word, r.expected)} ${r.isCorrect ? "✓" : "✗"}`));
    }
    main.appendChild(h("details", { open: "" },
      h("summary", {}, "Разбор слов"),
      review));

    const actions = h("div", { class: "stress-actions" });
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
      const result = { score: pct, isCorrect, raw: { correctCount, total, perWord } };
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
    return { phase, correctCount, total: order.length, perWord };
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