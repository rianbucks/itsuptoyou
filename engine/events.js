import { isRequirementMet } from "./flags.js";
import { pickWeighted } from "./math.js";
import { nextRandom } from "./random.js";
import { applyEffects } from "./state.js";

function hasOccurred(state, eventId) {
  return state.eventHistory.some((entry) => entry.event === eventId);
}

export function isEventEligible(event, state) {
  if (state.age < event.ageMin || state.age > event.ageMax) return false;
  if (!event.repeatable && hasOccurred(state, event.id)) return false;
  return isRequirementMet(event.requires, state.alive, state.flags);
}

export function drawCommonEvent(session, content) {
  const { state } = session;
  const occurs = nextRandom(state) < content.rules.commonEvents.chance;
  if (!occurs) return null;
  const candidates = content.events.filter((event) => isEventEligible(event, state));
  if (!candidates.length) return null;
  return pickWeighted(candidates, nextRandom(state));
}

export function applyCommonEventChoice(session, content, event, choice) {
  const { state } = session;
  applyEffects(state, content, choice);
  state.eventHistory.push({ event: event.id, choice: choice.id, year: state.year, age: state.age });
}
