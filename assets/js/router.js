// Hash-роутер. Никакой зависимости от текущего пути на сервере —
// любой #/ маршрут работает и с /index.html, и с /subdir/index.html.

let rootEl = null;
let routes = [];
let currentCleanup = null;
let started = false;

export function initRouter(el, routeList) {
  rootEl = el;
  routes = routeList;
  window.addEventListener("hashchange", () => handle(location.hash));
  started = true;
}

export function navigate(hash) {
  const target = hash || "#/";
  if (!started) {
    // bootstrap ещё не отработал — отложим.
    queueMicrotask(() => navigate(target));
    return;
  }
  if (location.hash === target) {
    handle(target); // форс-перерисовка
  } else {
    location.hash = target;
    // hashchange сам вызовет handle, но если он не сработает (same-hash goto) — fallback выше.
  }
}

async function handle(hash) {
  const h = (hash || "#/").replace(/^#/, "");
  for (const r of routes) {
    const m = r.pattern.exec(h);
    if (!m) continue;

    if (typeof currentCleanup === "function") {
      try { currentCleanup(); } catch (e) { console.warn("[router] cleanup threw:", e); }
    }
    currentCleanup = null;
    rootEl.innerHTML = "";
    rootEl.removeAttribute("aria-busy");

    const mount = (payload) => {
      rootEl.innerHTML = "";
      if (payload == null) return;
      if (payload instanceof Node) rootEl.appendChild(payload);
      else rootEl.innerHTML = String(payload);
    };

    const params = m.slice(1);
    const query = parseQuery(h);
    try {
      const result = await r.handler(params, query, mount);
      if (typeof result === "function") currentCleanup = result;
    } catch (e) {
      console.error("[router] handler threw:", e);
      rootEl.innerHTML = "";
      rootEl.appendChild(buildErrorNode(e));
    }
    return;
  }

  // Не нашли ни одного маршрута — финальный 404 уже обработан бы выше,
  // но на всякий случай:
  rootEl.innerHTML = "";
  rootEl.appendChild(buildNotFoundNode());
}

function parseQuery(h) {
  const i = h.indexOf("?");
  if (i < 0) return {};
  const out = {};
  try {
    new URLSearchParams(h.slice(i + 1)).forEach((v, k) => { out[k] = v; });
  } catch {}
  return out;
}

function buildErrorNode(e) {
  const div = document.createElement("div");
  div.innerHTML = `<p style="color: var(--app-wrong)">Ошибка рендера: ${escapeHtml(String(e.message || e))}</p>`;
  return div;
}

function buildNotFoundNode() {
  const div = document.createElement("div");
  div.innerHTML = `<article><h2>404 — страница не найдена</h2><p><a href="#/">← на главную</a></p></article>`;
  return div;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}