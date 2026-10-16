import { loadFigureContent } from "../engine/figure-loader.js";
import { changeFocus } from "../engine/focus.js";
import { computeHistoryMatch } from "../engine/purity.js";
import { createSession } from "../engine/state.js";
import { advanceYear, resolveDecision } from "../engine/timeline.js";
import { addYears } from "../engine/years.js";
import { snapshotForDiff } from "./changes.js";
import { freezeYearTick, refreshPlay, renderPlay, restartYearTick } from "./screens/play.js";
import { renderEnding } from "./screens/ending.js";
import { writeSeedToUrl } from "./seed.js";
import { store } from "./store.js";

const DEV_MATCH_RUNS = 200;

export function stopTimer() {
  clearTimeout(store.playback.timer);
  store.playback.timer = null;
}

function yearDelay() {
  const { secondsPerYear } = store.content.rules.timeline;
  return (secondsPerYear * 1000) / store.playback.speed;
}

function canRun() {
  const state = store.session?.state;
  return store.screen === "play"
    && store.playback.started
    && store.playback.playing
    && !document.hidden
    && state?.alive
    && !state.pending
    && !store.card?.awaitsContinue;
}

function schedule() {
  stopTimer();
  if (!canRun()) {
    freezeYearTick();
    return;
  }
  const delay = yearDelay();
  store.playback.timer = setTimeout(tickYear, delay);
  restartYearTick(delay);
}

function cardForOutcome(outcome) {
  if (outcome.type === "decision") return { type: "decision", pending: outcome.pending };
  if (outcome.type === "ended") return { type: "death", awaitsContinue: true };
  return { type: "year" };
}

export function tickYear() {
  store.playback.timer = null;
  if (!canRun()) return;
  const outcome = advanceYear(store.session, store.content);
  store.trace.push(...outcome.entries);
  store.card = cardForOutcome(outcome);
  refreshPlay();
  schedule();
}

export async function startFigure(figureId, seed) {
  store.content = await loadFigureContent(figureId);
  store.historyMatch = null;
  startRun(seed);
}

export function startRun(seed) {
  stopTimer();
  writeSeedToUrl(seed);
  store.session = createSession(store.content, seed);
  store.trace = [];
  store.screen = "play";
  store.playback.started = false;
  store.card = { type: "prologue" };
  renderPlay();
}

export function beginLife() {
  store.playback.started = true;
  store.card = { type: "year" };
  tickYear();
}

function resultCard(pending, outcome, before) {
  if (pending.kind === "focus") return cardForOutcome(outcome);
  return {
    type: "result",
    pending,
    entries: outcome.entries,
    before,
    after: snapshotForDiff(store.session.state),
    next: outcome,
    awaitsContinue: true,
  };
}

export function choose(input) {
  const pending = store.session.state.pending;
  const before = snapshotForDiff(store.session.state);
  const outcome = resolveDecision(store.session, store.content, input);
  store.trace.push(...outcome.entries);
  store.card = resultCard(pending, outcome, before);
  refreshPlay();
  schedule();
}

export function continueAfterResult() {
  store.card = cardForOutcome(store.card.next);
  refreshPlay();
  schedule();
}

export function togglePlay() {
  store.playback.playing = !store.playback.playing;
  refreshPlay();
  schedule();
}

export function setSpeed(speed) {
  store.playback.speed = speed;
  refreshPlay();
  schedule();
}

export function switchFocus(stat) {
  if (changeFocus(store.session, store.content, stat)) {
    store.trace.push({ kind: "focusChanged", stat, fromYear: addYears(store.session.state.year, 1) });
  }
  refreshPlay();
}

export function finishLife() {
  stopTimer();
  store.screen = "ending";
  renderEnding();
}

export function leaveRun() {
  stopTimer();
  store.screen = "title";
}

export function historyMatch() {
  store.historyMatch ??= computeHistoryMatch(store.content, { runs: DEV_MATCH_RUNS });
  return store.historyMatch;
}

export function watchVisibility() {
  document.addEventListener("visibilitychange", schedule);
}
