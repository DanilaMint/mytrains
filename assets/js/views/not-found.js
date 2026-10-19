// Catch-all 404 view.

import { h } from "../util/dom.js";

export function notFoundView(_params, _query, mount) {
  mount(h("article", {},
    h("h2", {}, "404 — страница не найдена"),
    h("p", {}, h("a", { href: "#/" }, "← на главную")),
  ));
}