import { changeFocus } from "../../engine/focus.js";
import { createPolicyRandom, pickIndex } from "../../engine/policy.js";
import { createSession } from "../../engine/state.js";
import { advanceYear, resolveDecision } from "../../engine/timeline.js";
import { addYears } from "../../engine/years.js";

const MAX_YEARS = 200;
const FOCUS_CHANGE_CHANCE = 0.1;

function choicesFor(pending, content) {
  if (pending.kind === "growth") return content.growthIndex[pending.id].choices;
  if (pending.kind === "node") return content.nodeIndex[pending.id].choices;
  return content.eventIndex[pending.id].choices;
}

function randomStat(content, random) {
  return content.stats[pickIndex(random, content.stats.length)].id;
}

function randomInput(pending, content, random) {
  if (pending.kind === "focus") return { stat: randomStat(content, random) };
  const choices = choicesFor(pending, content);
  return { choice: choices[pickIndex(random, choices.length)].id };
}

function leaningInput(pending, content, random, historicalChance) {
  if (pending.kind === "focus") return { stat: randomStat(content, random) };
  const choices = choicesFor(pending, content);
  const historical = choices.find((choice) => choice.historical);
  if (!historical) return { choice: choices[pickIndex(random, choices.length)].id };
  if (random() < historicalChance) return { choice: historical.id };
  const others = choices.filter((choice) => !choice.historical);
  return { choice: others[pickIndex(random, others.length)].id };
}

function runToEnd(session, content, chooseInput, beforeYear) {
  const trace = [];
  for (let year = 0; year < MAX_YEARS && session.state.alive; year++) {
    trace.push(...beforeYear(session));
    let outcome = advanceYear(session, content);
    trace.push(...outcome.entries);
    while (outcome.type === "decision") {
      outcome = resolveDecision(session, content, chooseInput(outcome.pending));
      trace.push(...outcome.entries);
    }
  }
  return trace;
}

function playWithPolicy(content, seed, chooseWith) {
  const session = createSession(content, seed);
  const random = createPolicyRandom(seed);
  const maybeChangeFocus = (current) => {
    if (current.state.focus === null || random() >= FOCUS_CHANGE_CHANCE) return [];
    const stat = randomStat(content, random);
    if (!changeFocus(current, content, stat)) return [];
    return [{ kind: "focusChanged", stat, fromYear: addYears(current.state.year, 1) }];
  };
  const trace = runToEnd(session, content, (pending) => chooseWith(pending, random), maybeChangeFocus);
  return { session, trace };
}

export function playRandomly(content, seed) {
  return playWithPolicy(content, seed, (pending, random) => randomInput(pending, content, random));
}

export function playLeaningHistorical(content, seed, historicalChance) {
  return playWithPolicy(content, seed, (pending, random) => leaningInput(pending, content, random, historicalChance));
}

export function recordFrom(state) {
  return {
    initialFocus: state.focusHistory[0]?.stat,
    focusChanges: state.focusHistory.slice(1),
    growth: state.growthHistory.map((entry) => entry.choice),
    node: state.history.map((entry) => entry.choice),
    commonEvent: state.eventHistory.map((entry) => entry.choice),
  };
}

export function replay(content, seed, record) {
  const session = createSession(content, seed);
  const queues = { growth: [...record.growth], node: [...record.node], commonEvent: [...record.commonEvent] };
  const focusChanges = [...record.focusChanges];
  const chooseInput = (pending) => (pending.kind === "focus" ? { stat: record.initialFocus } : { choice: queues[pending.kind].shift() });
  const applyFocusChanges = (current) => {
    const nextYear = addYears(current.state.year, 1);
    while (focusChanges.length && focusChanges[0].fromYear === nextYear) changeFocus(current, content, focusChanges.shift().stat);
    return [];
  };
  runToEnd(session, content, chooseInput, applyFocusChanges);
  return session;
}
