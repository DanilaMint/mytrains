// JSON-загрузчик с in-memory кешем и cache: 'no-cache' (чтобы после git push
// пользователь увидел свежие данные без hard-reload).

const cache = new Map();

export async function getJSON(url) {
  if (cache.has(url)) return cache.get(url);
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`Fetch ${url}: ${r.status}`);
  const j = await r.json();
  cache.set(url, j);
  return j;
}

export function clearCache() {
  cache.clear();
}