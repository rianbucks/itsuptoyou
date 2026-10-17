import { applyCommonEventChoice, drawCommonEvent } from "./events.js";
import { fixedEventProcessedInYear, nextFixedEvent } from "./fixed-events.js";
import { applyFocusGrowth, chooseFocus, needsFocusChoice } from "./focus.js";
import { applyGrowthChoice } from "./growth.js";
import { narrateAfter, narrateLife, narrateUnanchored, narrateYearStart } from "./narration.js";
import { resolveNodeChoice } from "./nodes.js";
import { advanceToYear, killFigure } from "./state.js";
import { resolveSurvivalCheck } from "./survival.js";
import { addYears } from "./years.js";

function findChoice(choices, choiceId) {
  const choice = choices.find((item) => item.id === choiceId);
  if (!choice) throw new Error(`없는 선택지: ${choiceId}`);
  return choice;
}

function pause(state, decision, entries) {
  state.pending = { ...decision, year: state.year };
  return { type: "decision", pending: state.pending, entries };
}

function finishYear(state, entries) {
  return { type: state.alive ? "yearEnd" : "ended", entries };
}

function isRecordedNaturalDeath(state, figure) {
  return figure.deathType === "natural" && !state.flags.deviated && state.year === figure.died;
}

function die(state, cause, entries) {
  killFigure(state, cause);
  entries.push({ kind: "death", cause });
}

function resolveLifeEnd(session, content, entries) {
  const { state } = session;
  const { figure, rules } = content;
  if (isRecordedNaturalDeath(state, figure)) {
    die(state, "naturalDeath", entries);
  } else if (state.age >= rules.survival.maxAge) {
    die(state, "maxAgeDeath", entries);
  } else if (state.year >= figure.died) {
    const { survived, probability } = resolveSurvivalCheck(session, content);
    entries.push({ kind: "survival", probability, survived });
    if (!survived) entries.push({ kind: "death", cause: "survival" });
  }
  return finishYear(state, entries);
}

function finishOrdinaryYear(session, content, entries) {
  entries.push(...narrateLife(session.state, content));
  return resolveLifeEnd(session, content, entries);
}

function continueWithFixedEvents(session, content, entries) {
  const { state } = session;
  const fixed = nextFixedEvent(session, content);
  if (fixed) return pause(state, fixed, entries);
  entries.push(...narrateUnanchored(state, content));
  if (fixedEventProcessedInYear(state)) return finishOrdinaryYear(session, content, entries);
  const event = drawCommonEvent(session, content);
  if (event) return pause(state, { kind: "commonEvent", id: event.id }, entries);
  return finishOrdinaryYear(session, content, entries);
}

function growWithFocus(state, content, entries) {
  const amount = applyFocusGrowth(state, content);
  if (amount) entries.push({ kind: "focusGrowth", stat: state.focus, amount });
}

function runYearBody(session, content, entries) {
  growWithFocus(session.state, content, entries);
  entries.push(...narrateYearStart(session.state, content));
  return continueWithFixedEvents(session, content, entries);
}

export function advanceYear(session, content) {
  const { state } = session;
  if (!state.alive) return { type: "ended", entries: [] };
  if (state.pending) return { type: "decision", pending: state.pending, entries: [] };
  advanceToYear(state, content.figure, addYears(state.year, 1));
  const entries = [{ kind: "year", year: state.year, age: state.age }];
  if (needsFocusChoice(state, content.rules)) return pause(state, { kind: "focus" }, entries);
  return runYearBody(session, content, entries);
}

function resolveFocusDecision(session, content, input) {
  const { state } = session;
  chooseFocus(state, content, input.stat);
  state.pending = null;
  return runYearBody(session, content, [{ kind: "focusChosen", stat: input.stat }]);
}

function resolveGrowthDecision(session, content, input) {
  const event = content.growthIndex[session.state.pending.id];
  const choice = findChoice(event.choices, input.choice);
  session.state.pending = null;
  applyGrowthChoice(session, content, event, choice);
  const entries = [{ kind: "growth", event: event.id, choice: choice.id }, ...narrateAfter(session.state, content, event.id)];
  return continueWithFixedEvents(session, content, entries);
}

function resolveNodeDecision(session, content, input) {
  const node = content.nodeIndex[session.state.pending.id];
  const choice = findChoice(node.choices, input.choice);
  session.state.pending = null;
  const resolution = resolveNodeChoice(session, content, node, choice, input.forcedResult);
  const entries = [{
    kind: "node",
    node: node.id,
    choice: choice.id,
    result: resolution.result,
    probability: resolution.probability,
    score: resolution.score,
    difficulty: choice.check.difficulty,
  }];
  if (!session.state.alive) {
    entries.push({ kind: "death", cause: "node" });
    return finishYear(session.state, entries);
  }
  entries.push(...narrateAfter(session.state, content, node.id));
  return continueWithFixedEvents(session, content, entries);
}

function resolveCommonEventDecision(session, content, input) {
  const event = content.eventIndex[session.state.pending.id];
  const choice = findChoice(event.choices, input.choice);
  session.state.pending = null;
  applyCommonEventChoice(session, content, event, choice);
  return finishOrdinaryYear(session, content, [{ kind: "commonEvent", event: event.id, choice: choice.id }]);
}

const DECISION_HANDLERS = {
  focus: resolveFocusDecision,
  growth: resolveGrowthDecision,
  node: resolveNodeDecision,
  commonEvent: resolveCommonEventDecision,
};

export function resolveDecision(session, content, input) {
  const { pending } = session.state;
  if (!pending) throw new Error("기다리는 결정이 없다");
  return DECISION_HANDLERS[pending.kind](session, content, input);
}
