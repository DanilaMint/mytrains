// DOM-хелперы: h(tag, props, ...children) и escapeHtml.
// Минимальный аналог hyperscript, чтобы не тянуть фреймворк.

const SVG_TAGS = new Set(["svg", "path", "circle", "g", "rect", "line", "polyline", "polygon", "text", "defs", "use"]);

export function h(tag, props = {}, ...children) {
  const el = SVG_TAGS.has(tag) ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);

  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class" || k === "className") {
      el.setAttribute("class", String(v));
    } else if (k === "style" && typeof v === "object") {
      Object.assign(el.style, v);
    } else if (k === "html") {
      el.innerHTML = String(v);
    } else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "dataset" && typeof v === "object") {
      for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = String(dv);
    } else if (k in el && k !== "list" && typeof el[k] !== "object") {
      try { el[k] = v; } catch { el.setAttribute(k, String(v)); }
    } else {
      el.setAttribute(k, String(v));
    }
  }

  appendChildren(el, children);
  return el;
}

function appendChildren(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export function clear(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
}