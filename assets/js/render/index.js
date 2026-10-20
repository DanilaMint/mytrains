// Реестр рендереров по task.type.
// Если тип неизвестен — engine.runTask отрисует fallback-сообщение.

import * as multipleChoice from "./multiple-choice.js";
import * as freeText from "./free-text.js";
import * as matching from "./matching.js";
import * as stress from "./stress.js";
import * as endings from "./endings.js";

export const RENDERERS = {
  "multiple-choice": multipleChoice,
  "free-text": freeText,
  "matching": matching,
  "stress": stress,
  "endings": endings,
};

export function supportedTypes() {
  return Object.keys(RENDERERS);
}