import { isRequirementMet } from "./flags.js";
import { projectFlagsAtYear } from "./state.js";

export function isNodeProcessed(state, nodeId) {
  return state.history.some((entry) => entry.node === nodeId);
}

export function isGrowthProcessed(state, eventId) {
  return state.growthHistory.some((entry) => entry.event === eventId);
}

export function isNodeAvailableAt(node, session, content) {
  const flags = projectFlagsAtYear(session.state, content.figure, node.year);
  return isRequirementMet(node.requires, session.state.alive, flags);
}

export function isNodeSuperseded(node, session, content) {
  return content.nodes
    .filter((candidate) => candidate.replaces === node.id)
    .some((replacement) => isNodeProcessed(session.state, replacement.id) || isNodeAvailableAt(replacement, session, content));
}

function isGrowthDue(event, state, content) {
  return event.year === state.year
    && event.year <= content.figure.died
    && !isGrowthProcessed(state, event.id)
    && isRequirementMet(event.requires, state.alive, state.flags);
}

function isNodeDue(node, session, content) {
  return node.year === session.state.year
    && !isNodeProcessed(session.state, node.id)
    && isNodeAvailableAt(node, session, content)
    && !isNodeSuperseded(node, session, content);
}

export function nextFixedEvent(session, content) {
  const growth = content.growth.find((event) => isGrowthDue(event, session.state, content));
  if (growth) return { kind: "growth", id: growth.id };
  const node = content.nodes.find((candidate) => isNodeDue(candidate, session, content));
  return node ? { kind: "node", id: node.id } : null;
}

export function fixedEventProcessedInYear(state) {
  return state.growthHistory.some((entry) => entry.year === state.year)
    || state.history.some((entry) => entry.year === state.year);
}
