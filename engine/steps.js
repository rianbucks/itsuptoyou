import { isRequirementMet } from "./flags.js";
import { projectFlagsAtYear } from "./state.js";
import { addYears } from "./years.js";

const STEP_ORDER = Object.freeze({ growth: 0, node: 1, naturalDeath: 2, survival: 3, maxAgeDeath: 4 });

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

export function listGrowthSteps(session, content) {
  return content.growth
    .filter((event) => event.year <= content.figure.died && !isGrowthProcessed(session.state, event.id))
    .filter((event) => isRequirementMet(event.requires, session.state.alive, projectFlagsAtYear(session.state, content.figure, event.year)))
    .map((event) => ({ type: "growth", year: event.year, event }));
}

export function listNodeSteps(session, content) {
  return content.nodes
    .filter((node) => !isNodeProcessed(session.state, node.id))
    .filter((node) => isNodeAvailableAt(node, session, content) && !isNodeSuperseded(node, session, content))
    .map((node) => ({ type: "node", year: node.year, node }));
}

export function hasNaturalDeathOnRecord(session, content) {
  return content.figure.deathType === "natural" && !session.state.flags.deviated;
}

export function firstSurvivalYear(content) {
  return content.figure.died;
}

export function maxAgeYear(content) {
  return addYears(content.figure.born, content.rules.survival.maxAge);
}

export function nextSurvivalYear(session, content) {
  const doneYears = new Set(session.survivalLog.map((entry) => entry.year));
  const lastYear = maxAgeYear(content);
  for (let year = firstSurvivalYear(content); year < lastYear; year = addYears(year, content.rules.survival.interval)) {
    if (year >= session.state.year && !doneYears.has(year)) return year;
  }
  return null;
}

export function listLifeEndSteps(session, content) {
  if (hasNaturalDeathOnRecord(session, content)) return [{ type: "naturalDeath", year: content.figure.died }];
  const survivalYear = nextSurvivalYear(session, content);
  const survivalSteps = survivalYear === null ? [] : [{ type: "survival", year: survivalYear }];
  return [...survivalSteps, { type: "maxAgeDeath", year: maxAgeYear(content) }];
}

export function compareSteps(a, b) {
  return a.year - b.year || STEP_ORDER[a.type] - STEP_ORDER[b.type];
}

export function findNextStep(session, content) {
  if (!session.state.alive) return { type: "ending" };
  const candidates = [...listGrowthSteps(session, content), ...listNodeSteps(session, content), ...listLifeEndSteps(session, content)]
    .filter((step) => step.year >= session.state.year)
    .sort(compareSteps);
  return candidates[0] ?? { type: "ending" };
}
