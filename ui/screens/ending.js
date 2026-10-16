import { buildComparison, listRunFragments } from "../../engine/compare.js";
import { computeAge } from "../../engine/years.js";
import { el } from "../dom.js";
import { disputedMarker, paragraph, sourcesList } from "../components.js";
import { endingCard } from "../card/ending-card.js";
import { startRun } from "../flow.js";
import { formatPercent, formatYear } from "../format.js";
import { render } from "../render.js";
import { randomSeed } from "../seed.js";
import { store } from "../store.js";
import { comparisonSection } from "./comparison.js";
import { renderTitle } from "./title.js";

function lifeSummary() {
  const { figure } = store.content;
  const { state } = store.session;
  const recordedAge = computeAge(figure.born, figure.died);
  return el("section", { class: "card" },
    el("h3", {}, "생애"),
    el("div", { class: "pair" },
      el("div", { class: "pair-cell" }, el("p", { class: "pair-label" }, "실제 기록"), el("p", {}, `${formatYear(figure.born)} – ${formatYear(figure.died)} (${recordedAge}세)`), sourcesList(figure.sources)),
      el("div", { class: "pair-cell" }, el("p", { class: "pair-label" }, "이번 판"), el("p", {}, `${formatYear(figure.born)} – ${formatYear(state.year)} (${state.age}세)`),
        state.flags.outlived ? el("p", { class: "muted" }, `기록보다 ${state.flags.extraYears}년 더 산다`) : null)));
}

function runFragmentsSection() {
  const items = listRunFragments(store.session, store.content);
  return el("section", { class: "card" },
    el("h3", {}, "이번 판의 결과 조각"),
    el("ol", { class: "fragments" }, items.map(({ entry, node, choice, fragment }) =>
      el("li", {},
        el("p", { class: "fragment-head" }, `${formatYear(node.year)} · ${node.title} — ${choice.label} `, el("span", { class: `verdict-inline ${entry.result}` }, entry.result === "success" ? "성공" : "실패"),
          store.settings.devMode ? el("span", { class: "prob" }, ` ${formatPercent(entry.probability)}`) : null),
        paragraph(fragment.text),
        disputedMarker(fragment.disputed)))));
}

function endingSection(comparison) {
  const isReal = comparison.runEnding.kind === "historical";
  return el("section", { class: "card" },
    el("h3", {}, "2026년"),
    isReal
      ? endingCard(comparison.runEnding)
      : el("div", { class: "pair" },
          el("div", { class: "pair-cell" }, el("p", { class: "pair-label" }, "실제 역사"), endingCard(comparison.realEnding)),
          el("div", { class: "pair-cell" }, el("p", { class: "pair-label" }, "이번 판"), endingCard(comparison.runEnding))));
}

function copyStateButton() {
  if (!store.settings.devMode) return null;
  return el("button", { type: "button", class: "ghost", onclick: async (event) => {
    const { state, survivalLog, deathCause } = store.session;
    await navigator.clipboard.writeText(JSON.stringify({ state, survivalLog, deathCause }, null, 2));
    event.target.textContent = "복사됨";
  } }, "상태 JSON 복사");
}

export function renderEnding() {
  const comparison = buildComparison(store.session, store.content);
  const seed = store.session.state.seed;
  render(
    lifeSummary(),
    runFragmentsSection(),
    endingSection(comparison),
    comparisonSection(comparison),
    el("section", { class: "card actions" },
      el("p", { class: "muted" }, `시드 ${seed} — 같은 시드에서 같은 선택을 하면 같은 결과가 나온다.`),
      el("button", { type: "button", class: "primary", onclick: () => startRun(seed) }, "같은 시드로 다시"),
      el("button", { type: "button", class: "ghost", onclick: () => startRun(randomSeed()) }, "새 시드로 시작"),
      el("button", { type: "button", class: "ghost", onclick: () => renderTitle() }, "처음으로"),
      copyStateButton()));
}
