// Реестр рендереров по task.type.
// Если тип неизвестен — engine.runTask отрисует fallback-сообщение.

import * as multipleChoice from "./multiple-choice.js";
import * as freeText from "./free-text.js";
import * as matching from "./matching.js";

export const RENDERERS = {
  "multiple-choice": multipleChoice,
  "free-text": freeText,
  "matching": matching,
};

export function supportedTypes() {
  return Object.keys(RENDERERS);
}