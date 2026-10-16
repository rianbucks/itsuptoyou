import { advanceToYear, applyEffects, markDeviated } from "./state.js";

export function applyGrowthChoice(session, content, event, choice) {
  const { state } = session;
  advanceToYear(state, content.figure, event.year);
  applyEffects(state, content, choice);
  if (!choice.historical) markDeviated(state);
  state.growthHistory.push({ event: event.id, choice: choice.id });
}
