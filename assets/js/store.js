// Store — localStorage namespace "learning-hub/v1".
// Хранит прогресс по задачам, streak, настройки. Debounce 250мс на запись.
// Устойчив к недоступности localStorage (приватный режим, квота).

const KEY = "learning-hub/v1";
let data = null;
let subscribers = [];
let storageAvailable = true;
let writeTimer = null;

const defaultData = () => ({
  version: 1,
  progress: {},
  streak: { count: 0, lastDay: null },
  settings: { shuffle: true, showHints: true, lang: "ru" },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultData();
    return Object.assign(defaultData(), parsed, {
      progress: parsed.progress && typeof parsed.progress === "object" ? parsed.progress : {},
      streak: parsed.streak && typeof parsed.streak === "object" ? parsed.streak : { count: 0, lastDay: null },
      settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : defaultData().settings,
    });
  } catch (e) {
    console.warn("[store] load failed, using defaults:", e);
    return defaultData();
  }
}

function persist() {
  if (!storageAvailable) return;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("[store] persist failed:", e);
      if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
        storageAvailable = false;
      }
    }
  }, 250);
}

function notify() {
  for (const fn of subscribers.slice()) {
    try { fn(); } catch (e) { console.warn("[store] subscriber threw:", e); }
  }
}

function todayISO() {
  // YYYY-MM-DD в локальной TZ пользователя.
  try {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

function daysBetween(a, b) {
  if (!a || !b) return Infinity;
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / 86400000);
}

export function initStore() {
  try {
    const t = "__lh_probe__";
    localStorage.setItem(t, "1");
    localStorage.removeItem(t);
    data = load();
    storageAvailable = true;
    return true;
  } catch (e) {
    storageAvailable = false;
    data = defaultData();
    console.warn("[store] localStorage недоступен, прогресс не сохраняется:", e);
    return false;
  }
}

export function subscribe(fn) {
  subscribers.push(fn);
  return () => { subscribers = subscribers.filter((s) => s !== fn); };
}

export function isStorageAvailable() {
  return storageAvailable;
}

export function getProgress(taskId) {
  if (!data) data = defaultData();
  return data.progress[taskId] || null;
}

export function getAllProgress() {
  if (!data) data = defaultData();
  return { ...data.progress };
}

export function recordAttempt(taskId, { correct, score, raw }) {
  if (!data) data = defaultData();
  const prev = data.progress[taskId] || { attempts: 0, correct: 0, completed: false, lastSeen: 0, history: [] };
  const next = {
    attempts: prev.attempts + 1,
    correct: prev.correct + (correct ? 1 : 0),
    completed: prev.completed || !!correct,
    lastSeen: Date.now(),
    history: [...prev.history, { ts: Date.now(), correct: !!correct, score: score ?? (correct ? 1 : 0) }].slice(-20),
  };
  data.progress[taskId] = next;
  if (correct) bumpStreakInternal();
  persist();
  notify();
  return next;
}

function bumpStreakInternal() {
  const today = todayISO();
  const last = data.streak.lastDay;
  if (last === today) return;
  if (!last) {
    data.streak = { count: 1, lastDay: today };
    return;
  }
  const diff = daysBetween(last, today);
  if (diff === 1) {
    data.streak = { count: data.streak.count + 1, lastDay: today };
  } else if (diff > 1) {
    data.streak = { count: 1, lastDay: today };
  }
}

export function getStreak() {
  if (!data) data = defaultData();
  // Если последняя активность была позавчера или раньше — счётчик устарел,
  // не показываем его как «активный».
  const last = data.streak.lastDay;
  const today = todayISO();
  const diff = daysBetween(last, today);
  const count = diff <= 1 ? data.streak.count : 0;
  return { count, lastDay: last, today };
}

export function getSettings() {
  if (!data) data = defaultData();
  return { ...data.settings };
}

export function setSetting(key, value) {
  if (!data) data = defaultData();
  data.settings = { ...data.settings, [key]: value };
  persist();
  notify();
}

export function exportJSON() {
  if (!data) data = defaultData();
  return JSON.stringify(data, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Невалидный JSON");
  data = Object.assign(defaultData(), parsed, {
    progress: parsed.progress && typeof parsed.progress === "object" ? parsed.progress : {},
    streak: parsed.streak && typeof parsed.streak === "object" ? parsed.streak : { count: 0, lastDay: null },
    settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : defaultData().settings,
  });
  persist();
  notify();
}

export function reset() {
  data = defaultData();
  persist();
  notify();
}