import { loadFigureContent } from "../engine/figure-loader.js";
import { createSession } from "../engine/state.js";
import { findNextStep } from "../engine/steps.js";
import { writeSeedToUrl } from "./seed.js";
import { store } from "./store.js";
import { renderEnding } from "./screens/ending.js";
import { renderGrowth } from "./screens/growth.js";
import { renderNode } from "./screens/node.js";
import { renderPrologue, renderScheduledDeath, renderSurvival } from "./screens/life.js";

export async function startFigure(figureId, seed) {
  store.content = await loadFigureContent(figureId);
  startRun(seed);
}

export function startRun(seed) {
  writeSeedToUrl(seed);
  store.session = createSession(store.content, seed);
  renderPrologue();
}

export function proceed() {
  const step = findNextStep(store.session, store.content);
  if (step.type === "growth") return renderGrowth(step.event);
  if (step.type === "node") return renderNode(step.node);
  if (step.type === "survival") return renderSurvival(step.year);
  if (step.type === "naturalDeath" || step.type === "maxAgeDeath") return renderScheduledDeath(step);
  return renderEnding();
}
