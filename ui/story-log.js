import { computeAge } from "../engine/years.js";

const PHASES = {
  birth: 0,
  focusChanged: 10,
  focusChosen: 20,
  yearStart: 25,
  fixedEvents: 30,
  unanchored: 45,
  commonEvent: 50,
  life: 55,
  survival: 60,
  death: 70,
};

function birthEntries(state, content) {
  return [{ kind: "birth", year: content.figure.born }];
}

function effectiveFocusChanges(focusHistory) {
  const lastByYear = new Map();
  for (const entry of focusHistory) lastByYear.set(entry.fromYear, entry.stat);
  const changes = [];
  let current = null;
  for (const [fromYear, stat] of lastByYear) {
    if (stat !== current) changes.push({ fromYear, stat, first: current === null });
    current = stat;
  }
  return changes;
}

function focusEntries(state) {
  return effectiveFocusChanges(state.focusHistory)
    .filter((change) => change.fromYear <= state.year)
    .map((change) => ({ kind: change.first ? "focusChosen" : "focusChanged", year: change.fromYear, stat: change.stat }));
}

function fixedEventKey(year, eventId) {
  return `${year}|${eventId}`;
}

function fixedEventPositions(state) {
  const positions = new Map();
  const count = new Map();
  const add = (year, eventId) => {
    const position = count.get(year) ?? 0;
    positions.set(fixedEventKey(year, eventId), position);
    count.set(year, position + 1);
  };
  for (const entry of state.growthHistory) add(entry.year, entry.event);
  for (const entry of state.history) add(entry.year, entry.node);
  return positions;
}

function growthEntries(state, content, positions) {
  return state.growthHistory.map((entry) => ({
    kind: "growth",
    year: entry.year,
    event: entry.event,
    choice: entry.choice,
    phase: PHASES.fixedEvents,
    slot: positions.get(fixedEventKey(entry.year, entry.event)) * 2,
  }));
}

function nodeEntries(state, content, positions) {
  return state.history.map((entry) => ({
    kind: "node",
    year: entry.year,
    node: entry.node,
    choice: entry.choice,
    result: entry.result,
    probability: entry.probability,
    phase: PHASES.fixedEvents,
    slot: positions.get(fixedEventKey(entry.year, entry.node)) * 2,
  }));
}

function commonEventEntries(state) {
  return state.eventHistory.map((entry) => ({ kind: "commonEvent", year: entry.year, event: entry.event, choice: entry.choice }));
}

function narrationPlace(entry, positions) {
  if (entry.kind === "life") return { phase: PHASES.life, slot: 0 };
  if (!entry.after) return { phase: PHASES.yearStart, slot: 0 };
  const position = positions.get(fixedEventKey(entry.year, entry.after));
  if (position === undefined) return { phase: PHASES.unanchored, slot: 0 };
  return { phase: PHASES.fixedEvents, slot: position * 2 + 1 };
}

function narrationEntries(state, content, positions) {
  return state.narrationHistory.map((entry) => ({ kind: entry.kind, year: entry.year, id: entry.id, after: entry.after ?? null, ...narrationPlace(entry, positions) }));
}

function survivalEntries(state) {
  return state.survivalHistory.map((entry) => ({ kind: "survival", year: entry.year, probability: entry.probability, survived: entry.survived }));
}

function deathEntries(state) {
  return state.alive ? [] : [{ kind: "death", year: state.year, cause: state.deathCause }];
}

const SOURCES = [birthEntries, focusEntries, narrationEntries, growthEntries, nodeEntries, commonEventEntries, survivalEntries, deathEntries];

function placeOf(entry) {
  return { phase: entry.phase ?? PHASES[entry.kind], slot: entry.slot ?? 0 };
}

function byTime(a, b) {
  const placeA = placeOf(a);
  const placeB = placeOf(b);
  return a.year - b.year || placeA.phase - placeB.phase || placeA.slot - placeB.slot;
}

function withoutPlace({ phase, slot, ...entry }) {
  return entry;
}

export function buildStoryLog(state, content) {
  const positions = fixedEventPositions(state);
  return SOURCES
    .flatMap((source) => source(state, content, positions))
    .sort(byTime)
    .map((entry) => ({ ...withoutPlace(entry), age: computeAge(content.figure.born, entry.year) }));
}

export function groupByYear(entries) {
  const groups = [];
  for (const entry of entries) {
    const last = groups.at(-1);
    if (last?.year === entry.year) last.entries.push(entry);
    else groups.push({ year: entry.year, age: entry.age, entries: [entry] });
  }
  return groups;
}
