// Движок задач: манифест, загрузка одной задачи, запуск рендерера.

import { RENDERERS } from "./render/index.js";
import { getJSON } from "./util/fetch.js";

const MANIFEST_URL = "content/tasks/manifest.json";

let manifestCache = null;

export async function loadManifest() {
  if (manifestCache) return manifestCache;
  manifestCache = await getJSON(MANIFEST_URL);
  return manifestCache;
}

export async function loadTask(area, id) {
  const url = `content/tasks/${area}/${id}.json`;
  const task = await getJSON(url);
  if (task.area !== area) {
    console.warn(`[engine] task ${id} declares area=${task.area}, expected ${area}`);
  }
  return task;
}

export function getArea(areaKey) {
  if (!manifestCache) return null;
  return manifestCache.areas && manifestCache.areas[areaKey] || null;
}

export async function runTask(task, container, hooks = {}) {
  const renderer = RENDERERS[task.type];
  if (!renderer) {
    container.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = `Тип задачи "${task.type}" не поддерживается в этой сборке.`;
    container.appendChild(p);
    return null;
  }
  return renderer.mount(task, container, hooks);
}