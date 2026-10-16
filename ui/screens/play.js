import { evaluateCheck } from "../../engine/judgment.js";
import { effectiveStat } from "../../engine/stats.js";
import { describeChanges } from "../changes.js";
import { choiceButton, disputedMarker, paragraph, portraitFrame } from "../components.js";
import { renderDevPanel } from "../dev-panel.js";
import { el } from "../dom.js";
import { formatPercent, formatYear, traitName } from "../format.js";
import { beginLife, choose, continueAfterResult, finishLife, setSpeed, switchFocus, togglePlay } from "../game.js";
import { currentYearEntries, renderLifeLog, yearSummary } from "../life-log.js";
import { render } from "../render.js";
import { store } from "../store.js";

const TAGS = { focus: "초점", growth: "성장", node: "갈림길", commonEvent: "일상" };
const DEATH_SENTENCES = {
  node: "갈림길의 결과로 당신은 이해에 세상을 떠난다.",
  survival: "세월이 흐른다. 당신은 이해에 세상을 떠난다.",
  naturalDeath: "세월이 흐른다. 당신은 이해에 세상을 떠난다.",
  maxAgeDeath: "백 살에 이른 해, 당신은 세상을 떠난다.",
};

let view = null;

function sourceOf(pending) {
  const { content } = store;
  if (pending.kind === "growth") return content.growthIndex[pending.id];
  if (pending.kind === "node") return content.nodeIndex[pending.id];
  return content.eventIndex[pending.id];
}

function findChoice(source, choiceId) {
  return source.choices.find((choice) => choice.id === choiceId);
}

function eventCard(tag, ...children) {
  return el("article", { class: "event-card" }, el("span", { class: "card-tag" }, tag), ...children);
}

function actionRow(label, onclick) {
  return el("div", { class: "card-actions" }, el("button", { type: "button", class: "btn primary", onclick }, label));
}

function prologueCard() {
  const { figure } = store.content;
  return eventCard("출생",
    el("h3", {}, `${formatYear(figure.born)}, 당신이 태어난다`),
    paragraph(figure.prologue.text),
    disputedMarker(figure.disputed),
    actionRow("생애를 시작한다", beginLife));
}

function focusCard() {
  const { content } = store;
  const { focus } = content.rules;
  return eventCard(TAGS.focus,
    el("h3", {}, "무엇에 힘을 쏟을까"),
    paragraph(`${focus.ageMin}세부터 ${focus.ageMax}세까지 고른 능력치가 해마다 ${focus.perYear}씩 오른다. 진행 중에도 왼쪽에서 언제든 바꿀 수 있다.`),
    el("div", { class: "choices focus-choices" }, content.stats.map((stat) =>
      el("button", { type: "button", class: "choice", onclick: () => choose({ stat: stat.id }) },
        el("span", { class: "choice-label" }, stat.name),
        el("span", { class: "choice-note" }, stat.description)))));
}

function probabilityOf(pending, choice) {
  if (pending.kind !== "node") return undefined;
  return evaluateCheck(store.session.state, store.content, choice.check).probability;
}

function decisionCard(pending) {
  if (pending.kind === "focus") return focusCard();
  const source = sourceOf(pending);
  return eventCard(TAGS[pending.kind],
    pending.kind === "node" && source.foreshadow ? el("p", { class: "foreshadow" }, source.foreshadow) : null,
    el("h3", {}, source.title),
    paragraph(source.situation),
    disputedMarker(source.disputed),
    el("div", { class: "choices" }, source.choices.map((choice) =>
      choiceButton(choice, (picked) => choose({ choice: picked.id }), probabilityOf(pending, choice)))));
}

function nodeVerdict(entry) {
  return el("p", { class: `verdict ${entry.result}` }, entry.result === "success" ? "성공" : "실패",
    store.settings.devMode ? el("span", { class: "prob num" }, ` 확률 ${formatPercent(entry.probability)}`) : null);
}

function resultCard(card) {
  const source = sourceOf(card.pending);
  const choiceEntry = card.entries.find((entry) => entry.kind === card.pending.kind);
  const choice = findChoice(source, choiceEntry.choice);
  const fragment = card.pending.kind === "node" ? store.content.fragmentIndex[choice[choiceEntry.result].fragment] : null;
  return eventCard(TAGS[card.pending.kind],
    el("h3", {}, source.title),
    el("p", { class: "picked" }, choice.label),
    fragment ? nodeVerdict(choiceEntry) : null,
    paragraph(fragment ? fragment.text : choice.text),
    disputedMarker(fragment?.disputed),
    describeChanges(card.before, card.after),
    actionRow("계속", continueAfterResult));
}

function deathCard() {
  const { state } = store.session;
  return eventCard("생애의 끝",
    el("h3", {}, `${formatYear(state.year)}, ${state.age}세`),
    paragraph(DEATH_SENTENCES[state.deathCause]),
    actionRow("생애를 마친다", finishLife));
}

function yearNote() {
  const summary = yearSummary(currentYearEntries(store.trace));
  return el("p", { class: "year-note" }, summary || "조용히 한 해가 지나간다");
}

function cardFor(card) {
  switch (card?.type) {
    case "prologue": return prologueCard();
    case "decision": return decisionCard(card.pending);
    case "result": return resultCard(card);
    case "death": return deathCard();
    default: return yearNote();
  }
}

function statusText() {
  const { state } = store.session;
  const { playback, card } = store;
  if (!playback.started) return "생애를 시작하면 해마다 저절로 넘어간다";
  if (!state.alive) return "생애가 끝났다";
  if (state.pending) return "선택을 기다리며 멈춤";
  if (card?.awaitsContinue) return "계속을 누르면 이어진다";
  return playback.playing ? `${playback.speed}×로 흐르는 중` : "멈춤";
}

function renderControls() {
  const { started, playing, speed } = store.playback;
  const disabled = !started || !store.session.state.alive || null;
  view.refs.controls.replaceChildren(
    el("button", { type: "button", class: "ctl", disabled, "aria-pressed": String(!playing), onclick: togglePlay }, playing ? "❚❚ 멈춤" : "▶ 재생"),
    el("div", { class: "speeds", role: "group", "aria-label": "배속" }, store.content.rules.timeline.speeds.map((value) =>
      el("button", { type: "button", class: `ctl num${value === speed ? " on" : ""}`, disabled, "aria-pressed": String(value === speed), onclick: () => setSpeed(value) }, `${value}×`))));
}

function statRow(stat) {
  const { state } = store.session;
  const value = effectiveStat(state, store.content, stat.id);
  const isFocus = state.focus === stat.id;
  return el("div", { class: `stat${isFocus ? " focus" : ""}` },
    el("span", { class: "stat-name", title: isFocus ? "현재 초점" : null }, stat.name),
    el("span", { class: "stat-bar" }, el("b", { style: `width:${value}%` })),
    el("span", { class: "stat-value num" }, value));
}

function renderStats() {
  const { state } = store.session;
  const select = view.refs.focusSelect;
  view.refs.stats.replaceChildren(...store.content.stats.map(statRow));
  select.disabled = state.focus === null || !state.alive;
  select.value = state.focus ?? "";
  view.refs.traits.textContent = state.traits.length ? `특성 · ${state.traits.map(traitName).join(", ")}` : "특성 없음";
}

function renderYear() {
  const { state } = store.session;
  view.refs.year.textContent = formatYear(state.year);
  view.refs.age.textContent = `${state.age}세`;
  view.refs.status.textContent = statusText();
}

function renderCard() {
  view.refs.card.replaceChildren(cardFor(store.card));
}

function renderLog() {
  view.refs.log.replaceChildren(renderLifeLog(store.trace, { newestFirst: true }));
}

function refreshPart(name, key, draw) {
  if (view.keys[name] === key) return;
  view.keys[name] = key;
  draw();
}

function focusOptions() {
  const { focus } = store.content.rules;
  return [
    el("option", { value: "", disabled: true }, `${focus.ageMin}세에 고른다`),
    ...store.content.stats.map((stat) => el("option", { value: stat.id }, stat.name)),
  ];
}

function buildView() {
  const { figure } = store.content;
  const refs = {
    controls: el("div", { class: "controls" }),
    stats: el("div", { class: "stats" }),
    focusSelect: el("select", { id: "focus-select", class: "focus-select", onchange: (event) => switchFocus(event.target.value) }, focusOptions()),
    traits: el("p", { class: "traits" }),
    year: el("span", { class: "year-big num" }),
    age: el("span", { class: "year-age num" }),
    tick: el("div", { class: "year-tick", "aria-hidden": "true" }),
    status: el("p", { class: "play-status" }),
    card: el("div", { class: "card-slot", "aria-live": "polite" }),
    log: el("div", { class: "log-slot" }),
  };
  const root = el("section", { class: "play" },
    el("header", { class: "play-bar" }, el("strong", { class: "play-name" }, figure.name), refs.controls),
    el("div", { class: "play-body" },
      el("aside", { class: "play-side", "aria-label": "인물" },
        portraitFrame(figure),
        el("div", { class: "side-block" },
          el("h2", { class: "label" }, "능력치"),
          refs.stats,
          el("label", { class: "focus-field", for: "focus-select" }, el("span", {}, "초점"), refs.focusSelect),
          refs.traits)),
      el("div", { class: "play-main" },
        el("div", { class: "year-head" }, refs.year, refs.age),
        refs.tick,
        refs.status,
        refs.card),
      el("aside", { class: "play-log", "aria-label": "생애 기록" },
        el("h2", { class: "label" }, "생애 기록"),
        refs.log)));
  return { root, refs, keys: {} };
}

export function renderPlay() {
  view = buildView();
  render(view.root);
  refreshPlay();
}

export function refreshPlay() {
  if (!view || store.screen !== "play") return;
  const { state } = store.session;
  const { playback } = store;
  refreshPart("controls", `${playback.started}|${playback.playing}|${playback.speed}|${state.alive}`, renderControls);
  refreshPart("stats", JSON.stringify([state.stats, state.traits, state.focus, state.alive]), renderStats);
  refreshPart("card", store.card, renderCard);
  refreshPart("log", store.trace.length, renderLog);
  renderYear();
  renderDevPanel();
}

export function restartYearTick(duration) {
  if (!view) return;
  view.refs.tick.replaceChildren(el("b", { class: "running", style: `animation-duration:${duration}ms` }));
}

export function freezeYearTick() {
  const bar = view?.refs.tick.firstChild;
  if (bar) bar.style.animationPlayState = "paused";
}
