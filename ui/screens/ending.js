import { buildComparison, listRunFragments } from "../../engine/compare.js";
import { computeAge } from "../../engine/years.js";
import { endingCard } from "../card/ending-card.js";
import { disputedMarker, paragraph, portraitFrame, sourcesList } from "../components.js";
import { el } from "../dom.js";
import { formatPercent, formatYear } from "../format.js";
import { startRun } from "../game.js";
import { renderLifeLog } from "../life-log.js";
import { render } from "../render.js";
import { randomSeed } from "../seed.js";
import { store } from "../store.js";
import { comparisonSection } from "./comparison.js";
import { renderTitle } from "./title.js";

function lifeSummary() {
  const { figure } = store.content;
  const { state } = store.session;
  const recordedAge = computeAge(figure.born, figure.died);
  return el("section", { class: "card life-summary" },
    portraitFrame(figure),
    el("div", { class: "life-summary-text" },
      el("h2", {}, figure.name),
      el("div", { class: "pair" },
        el("div", { class: "pair-cell" }, el("p", { class: "pair-label" }, "실제 기록"), el("p", { class: "num" }, `${formatYear(figure.born)} – ${formatYear(figure.died)} (${recordedAge}세)`), sourcesList(figure.sources)),
        el("div", { class: "pair-cell" }, el("p", { class: "pair-label" }, "이번 판"), el("p", { class: "num" }, `${formatYear(figure.born)} – ${formatYear(state.year)} (${state.age}세)`),
          state.flags.outlived ? el("p", { class: "muted" }, `기록보다 ${state.flags.extraYears}년 더 산다`) : null))));
}

function runFragmentsSection() {
  const items = listRunFragments(store.session, store.content);
  return el("section", { class: "card" },
    el("h3", {}, "이번 판의 결과 조각"),
    items.length
      ? el("ol", { class: "fragments" }, items.map(({ entry, node, choice, fragment }) =>
        el("li", {},
          el("p", { class: "fragment-head" }, `${formatYear(node.year)} · ${node.title} — ${choice.label} `, el("span", { class: `verdict-inline ${entry.result}` }, entry.result === "success" ? "성공" : "실패"),
            store.settings.devMode ? el("span", { class: "prob num" }, ` ${formatPercent(entry.probability)}`) : null),
          paragraph(fragment.text),
          disputedMarker(fragment.disputed))))
      : el("p", { class: "muted" }, "갈림길에 이르기 전에 생애가 끝났다."));
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

function lifeRecordSection() {
  return el("section", { class: "card" },
    el("h3", {}, "생애 기록"),
    el("p", { class: "muted" }, "이번 판에서 해마다 일어난 일이다. 일상과 초점은 기록된 사건이 아니라서 위의 대조에는 넣지 않았다."),
    renderLifeLog(store.trace, { newestFirst: false }));
}

async function copyState(event) {
  const { state } = store.session;
  try {
    await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
    event.target.textContent = "복사됨";
  } catch {
    event.target.textContent = "이 화면에서는 복사할 수 없다";
  }
}

function actionsSection() {
  const seed = store.session.state.seed;
  return el("section", { class: "card actions" },
    el("p", { class: "muted" }, `시드 ${seed} — 같은 시드에서 같은 선택을 하면 같은 결과가 나온다.`),
    el("div", { class: "action-row" },
      el("button", { type: "button", class: "btn primary", onclick: () => startRun(seed) }, "같은 시드로 다시"),
      el("button", { type: "button", class: "btn ghost", onclick: () => startRun(randomSeed()) }, "새 시드로 시작"),
      el("button", { type: "button", class: "btn ghost", onclick: () => renderTitle() }, "처음으로"),
      store.settings.devMode ? el("button", { type: "button", class: "btn ghost", onclick: copyState }, "상태 JSON 복사") : null));
}

export function renderEnding() {
  const comparison = buildComparison(store.session, store.content);
  render(
    el("div", { class: "ending" },
      lifeSummary(),
      runFragmentsSection(),
      endingSection(comparison),
      comparisonSection(comparison),
      lifeRecordSection(),
      actionsSection()));
}
