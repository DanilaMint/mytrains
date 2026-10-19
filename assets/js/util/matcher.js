// Matcher для free-text задач.
// НИКАКИХ new RegExp(userInput) — только нормализация строк и includes/равенство.

export function normalize(s, opts = {}) {
  let out = String(s ?? "");
  if (opts.trim !== false) out = out.trim();
  if (opts.collapseWhitespace) out = out.replace(/\s+/g, " ");
  if (opts.caseSensitive !== true) out = out.toLowerCase();
  return out;
}

export function evaluate(rawInput, taskDef) {
  const opts = taskDef.match || {};
  const norm = normalize(rawInput, opts);

  let best = 0;
  const expected = taskDef.expectedAnswers || [];
  for (const e of expected) {
    const target = normalize(e.text, opts);
    const w = e.weight ?? 1;
    if (target === norm) {
      best = Math.max(best, w);
    } else if (target.includes(norm) && norm.length > 0) {
      best = Math.max(best, w * 0.7);
    } else if (norm.includes(target) && target.length > 0) {
      best = Math.max(best, w * 0.7);
    }
  }

  const keywords = taskDef.keywords || [];
  const kwHits = keywords.filter((k) => norm.includes(normalize(k, opts))).length;

  const minMatch = taskDef.minMatch ?? 0.8;
  const minKw = taskDef.minKeywordHits ?? 0;
  const isCorrect = best >= minMatch && kwHits >= minKw;

  return { score: best, keywordHits: kwHits, isCorrect, normalized: norm };
}