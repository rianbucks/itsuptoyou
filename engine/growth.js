import { applyEffects, markDeviated } from "./state.js";

export function applyGrowthChoice(session, content, event, choice) {
  const { state } = session;
  applyEffects(state, content, choice);
  if (!choice.historical) markDeviated(state);
  state.growthHistory.push({ event: event.id, choice: choice.id, year: state.year });
}
