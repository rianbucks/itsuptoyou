import { computePureHistoryPath } from "../engine/purity.js";
import { effectiveStat } from "../engine/stats.js";
import { el } from "./dom.js";
import { formatPercent, traitName } from "./format.js";
import { store } from "./store.js";

function statTable(state) {
  return el("table", { class: "dev-table" },
    store.content.stats.map((stat) => {
      const base = state.stats[stat.id];
      const effective = effectiveStat(state, store.content, stat.id);
      return el("tr", {}, el("th", {}, stat.name), el("td", {}, base === effective ? base : `${base} → ${effective}`));
    }));
}

function flagList(flags) {
  return el("ul", { class: "dev-flags" }, Object.entries(flags).map(([key, value]) => el("li", {}, el("code", {}, key), ` = ${JSON.stringify(value)}`)));
}

function survivalSummary(survivalLog) {
  if (!survivalLog.length) return null;
  const parts = survivalLog.map((log) => `${log.year} ${formatPercent(log.probability)} ${log.survived ? "생존" : "사망"}`);
  return el("p", {}, "생존 판정: ", parts.join(", "));
}

function pureHistorySummary() {
  const pure = computePureHistoryPath(store.content);
  return el("div", {},
    el("p", {}, `순수 역사 경로 일치 확률: ${(pure.product * 100).toFixed(1)}%`),
    el("ul", { class: "dev-flags" }, pure.rows.map((row) => el("li", {}, `${row.title}: 점수 ${row.score.toFixed(1)} / 난이도 ${row.difficulty} → ${formatPercent(row.probability)}`))));
}

function sessionSummary(session) {
  return [
    el("p", {}, `시드 ${session.state.seed} · 난수 상태 ${session.rng.state}`),
    statTable(session.state),
    el("p", {}, "특성: ", session.state.traits.map(traitName).join(", ") || "없음"),
    flagList(session.state.flags),
    survivalSummary(session.survivalLog),
  ];
}

export function renderDevPanel() {
  const panel = document.getElementById("dev");
  panel.hidden = !store.settings.devMode;
  if (!store.settings.devMode || !store.content) {
    panel.replaceChildren();
    return;
  }
  const body = store.session ? sessionSummary(store.session) : [];
  panel.replaceChildren(el("details", { open: true }, el("summary", {}, "개발자 패널"), ...body, pureHistorySummary()));
}
