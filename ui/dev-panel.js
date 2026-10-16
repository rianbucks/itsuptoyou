import { effectiveStat } from "../engine/stats.js";
import { el } from "./dom.js";
import { formatPercent, statName, traitName } from "./format.js";
import { historyMatch } from "./game.js";
import { store } from "./store.js";

function statTable(state) {
  return el("table", { class: "dev-table" },
    store.content.stats.map((stat) => {
      const base = state.stats[stat.id];
      const effective = effectiveStat(state, store.content, stat.id);
      return el("tr", {}, el("th", {}, stat.name), el("td", { class: "num" }, base === effective ? base : `${base} → ${effective}`));
    }));
}

function flagList(flags) {
  return el("ul", { class: "dev-flags" }, Object.entries(flags).map(([key, value]) => el("li", {}, el("code", {}, key), ` = ${JSON.stringify(value)}`)));
}

function survivalLine(state) {
  const last = state.survivalHistory.at(-1);
  if (!last) return null;
  return el("p", {}, `생존 판정 ${state.survivalHistory.length}회 · 마지막 1년 확률 ${formatPercent(last.probability)}`);
}

function matchSummary() {
  const match = historyMatch();
  const byFocus = Object.entries(match.byFocus).map(([stat, value]) => `${statName(stat)} ${formatPercent(value)}`).join(", ");
  return el("div", {},
    el("p", {}, `역사 일치 확률 평균 ${(match.average * 100).toFixed(1)}% (초점·일상 무작위 ${match.runs}판)`),
    el("p", { class: "muted" }, `초점 고정: ${byFocus}`));
}

function sessionSummary(state) {
  return [
    el("p", { class: "num" }, `시드 ${state.seed} · 난수 상태 ${state.rngState}`),
    statTable(state),
    el("p", {}, `초점: ${state.focus ? statName(state.focus) : "없음"} · 특성: ${state.traits.map(traitName).join(", ") || "없음"}`),
    el("p", {}, `대기 중인 결정: ${state.pending ? `${state.pending.kind}${state.pending.id ? ` (${state.pending.id})` : ""}` : "없음"}`),
    flagList(state.flags),
    survivalLine(state),
  ];
}

export function renderDevPanel() {
  const panel = document.getElementById("dev");
  const visible = Boolean(store.settings.devMode && store.content && store.session);
  panel.hidden = !visible;
  if (!visible) {
    panel.replaceChildren();
    return;
  }
  const details = el("details", { open: store.devPanelOpen || null, ontoggle: (event) => { store.devPanelOpen = event.target.open; } },
    el("summary", {}, "개발자 패널"),
    ...sessionSummary(store.session.state),
    matchSummary());
  panel.replaceChildren(details);
}
