import { el } from "../dom.js";
import { disputedMarker, harmNote, paragraph, sourcesList } from "../components.js";
import { formatYear } from "../format.js";

function comparisonRow(title, realCell, runCell) {
  return el("div", { class: "compare-row" },
    el("p", { class: "compare-title" }, title),
    el("div", { class: "pair" },
      el("div", { class: "pair-cell" }, el("p", { class: "pair-label" }, "실제 역사"), realCell),
      el("div", { class: "pair-cell" }, el("p", { class: "pair-label" }, "이번 판"), runCell)));
}

function growthRow({ event, realChoice, runChoice }) {
  const realCell = el("div", {}, el("p", { class: "picked" }, realChoice.label), paragraph(realChoice.text), sourcesList(realChoice.sources));
  const runCell = runChoice
    ? el("div", {}, el("p", { class: "picked" }, runChoice.label), paragraph(runChoice.text), harmNote(runChoice.harm))
    : el("p", { class: "muted" }, "이 시기에 이르지 못한다");
  return comparisonRow(`${formatYear(event.year)} · ${event.title}`, realCell, runCell);
}

function nodeRow({ node, realChoice, realFragment, run }) {
  const realCell = el("div", {}, el("p", { class: "picked" }, realChoice.label), paragraph(realFragment.text), sourcesList(realFragment.sources), disputedMarker(realFragment.disputed));
  const runCell = run
    ? el("div", {},
        el("p", { class: "picked" }, run.node.id === node.id ? "" : `${run.node.title} — `, run.choice.label, " ", el("span", { class: `verdict-inline ${run.entry.result}` }, run.entry.result === "success" ? "성공" : "실패")),
        paragraph(run.fragment.text),
        harmNote(run.choice.harm))
    : el("p", { class: "muted" }, "이 사건은 일어나지 않는다");
  return comparisonRow(`${formatYear(node.year)} · ${node.title}`, realCell, runCell);
}

function afterRecordRow({ node, choice, entry, fragment }) {
  return el("div", { class: "compare-row" },
    el("p", { class: "compare-title" }, `${formatYear(node.year)} · ${node.title}`),
    el("p", { class: "picked" }, choice.label, " ", el("span", { class: `verdict-inline ${entry.result}` }, entry.result === "success" ? "성공" : "실패")),
    paragraph(fragment.text),
    harmNote(choice.harm));
}

export function comparisonSection(comparison) {
  return el("section", { class: "card" },
    el("h3", {}, "실제 역사와 대조"),
    comparison.growth.map(growthRow),
    comparison.nodes.map(nodeRow),
    comparison.afterRecord.length ? [el("h4", { class: "group-title" }, "기록 이후"), comparison.afterRecord.map(afterRecordRow)] : null);
}
