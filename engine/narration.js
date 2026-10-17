import { isRequirementMet } from "./flags.js";
import { pickWeighted } from "./math.js";
import { nextRandom } from "./random.js";

const RECORD_KINDS = ["era", "chronicle"];

function recordNarration(state, kind, id, after) {
  state.narrationHistory.push({ year: state.year, kind, id, after: after ?? null });
  return { kind: "narration", narration: kind, id, after: after ?? null };
}

function recordsOfYear(state, content) {
  return RECORD_KINDS
    .flatMap((kind, kindRank) => content[kind].map((item, index) => ({ kind, item, kindRank, index })))
    .filter(({ item }) => item.year === state.year)
    .sort((a, b) => (a.item.order ?? 0) - (b.item.order ?? 0) || a.kindRank - b.kindRank || a.index - b.index);
}

function narrateWhere(state, content, belongs) {
  if (!state.alive) return [];
  return recordsOfYear(state, content)
    .filter(({ item }) => belongs(item) && isRequirementMet(item.requires, state.alive, state.flags))
    .map(({ kind, item }) => recordNarration(state, kind, item.id, item.after));
}

function isProcessedThisYear(state, eventId) {
  return state.growthHistory.some((entry) => entry.year === state.year && entry.event === eventId)
    || state.history.some((entry) => entry.year === state.year && entry.node === eventId);
}

export function narrateYearStart(state, content) {
  return narrateWhere(state, content, (item) => !item.after);
}

export function narrateAfter(state, content, eventId) {
  return narrateWhere(state, content, (item) => item.after === eventId);
}

export function narrateUnanchored(state, content) {
  return narrateWhere(state, content, (item) => Boolean(item.after) && !isProcessedThisYear(state, item.after));
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
