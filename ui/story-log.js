import { computeAge } from "../engine/years.js";

const PHASES = {
  birth: 0,
  focusChanged: 10,
  focusChosen: 20,
  era: 22,
  chronicle: 24,
  growth: 30,
  node: 40,
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

function growthEntries(state) {
  return state.growthHistory.map((entry) => ({ kind: "growth", year: entry.year, event: entry.event, choice: entry.choice }));
}

function nodeEntries(state) {
  return state.history.map((entry) => ({
    kind: "node",
    year: entry.year,
    node: entry.node,
    choice: entry.choice,
    result: entry.result,
    probability: entry.probability,
  }));
}

function commonEventEntries(state) {
  return state.eventHistory.map((entry) => ({ kind: "commonEvent", year: entry.year, event: entry.event, choice: entry.choice }));
}

function narrationEntries(state) {
  return state.narrationHistory.map((entry) => ({ kind: entry.kind, year: entry.year, id: entry.id }));
}

function survivalEntries(state) {
  return state.survivalHistory.map((entry) => ({ kind: "survival", year: entry.year, probability: entry.probability, survived: entry.survived }));
}

function deathEntries(state) {
  return state.alive ? [] : [{ kind: "death", year: state.year, cause: state.deathCause }];
}

const SOURCES = [birthEntries, focusEntries, narrationEntries, growthEntries, nodeEntries, commonEventEntries, survivalEntries, deathEntries];

function byTime(a, b) {
  return a.year - b.year || PHASES[a.kind] - PHASES[b.kind];
}

export function buildStoryLog(state, content) {
  return SOURCES
    .flatMap((source) => source(state, content))
    .sort(byTime)
    .map((entry) => ({ ...entry, age: computeAge(content.figure.born, entry.year) }));
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
