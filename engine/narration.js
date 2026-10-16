import { isRequirementMet } from "./flags.js";
import { pickWeighted } from "./math.js";
import { nextRandom } from "./random.js";

const RECORD_KINDS = ["era", "chronicle"];

function recordNarration(state, kind, id) {
  state.narrationHistory.push({ year: state.year, kind, id });
  return { kind: "narration", narration: kind, id };
}

function isShownThisYear(item, state) {
  return item.year === state.year && isRequirementMet(item.requires, state.alive, state.flags);
}

export function narrateRecords(state, content) {
  return RECORD_KINDS.flatMap((kind) => content[kind]
    .filter((item) => isShownThisYear(item, state))
    .map((item) => recordNarration(state, kind, item.id)));
}

function happenedThisYear(entries, state) {
  return entries.some((entry) => entry.year === state.year);
}

export function hasSentenceAboutYou(state) {
  return happenedThisYear(state.narrationHistory.filter((entry) => entry.kind === "chronicle"), state)
    || happenedThisYear(state.growthHistory, state)
    || happenedThisYear(state.history, state)
    || happenedThisYear(state.eventHistory, state);
}

function matchesFocus(line, focus) {
  return !line.focus || line.focus.includes(focus);
}

export function isLifeLineEligible(line, state) {
  return state.age >= line.ageMin
    && state.age <= line.ageMax
    && matchesFocus(line, state.focus)
    && isRequirementMet(line.requires, state.alive, state.flags);
}

function lifeUseCounts(state) {
  const counts = new Map();
  for (const entry of state.narrationHistory) {
    if (entry.kind === "life") counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  }
  return counts;
}

function leastUsed(lines, counts) {
  const useCount = (line) => counts.get(line.id) ?? 0;
  const fewest = Math.min(...lines.map(useCount));
  return lines.filter((line) => useCount(line) === fewest);
}

export function narrateLife(state, content) {
  if (hasSentenceAboutYou(state)) return [];
  const candidates = content.life.filter((line) => isLifeLineEligible(line, state));
  if (!candidates.length) return [];
  const pool = leastUsed(candidates, lifeUseCounts(state));
  const line = pickWeighted(pool, nextRandom(state, "narrationRngState"));
  return [recordNarration(state, "life", line.id)];
}
