import { evaluateCheck } from "../../engine/judgment.js";
import { resolveNodeChoice } from "../../engine/nodes.js";
import { advanceToYear } from "../../engine/state.js";
import { el } from "../dom.js";
import { choiceButton, disputedMarker, eventHeader, paragraph } from "../components.js";
import { describeChanges, snapshotForDiff } from "../changes.js";
import { proceed } from "../flow.js";
import { formatPercent, formatYear } from "../format.js";
import { render } from "../render.js";
import { store } from "../store.js";

function previewProbability(choice) {
  return evaluateCheck(store.session.state, store.content, choice.check).probability;
}

function verdictLine(resolution) {
  return el("p", { class: `verdict ${resolution.result}` }, resolution.result === "success" ? "성공" : "실패",
    store.settings.devMode ? el("span", { class: "prob" }, ` 확률 ${formatPercent(resolution.probability)} · 굴림 ${resolution.roll.toFixed(3)}`) : null);
}

function pickNode(node, choice) {
  const before = snapshotForDiff(store.session.state);
  const resolution = resolveNodeChoice(store.session, store.content, node, choice);
  render(
    el("section", { class: "card node-card" },
      eventHeader(`${formatYear(node.year)} · 분기점`, node.title),
      el("p", { class: "picked" }, choice.label),
      verdictLine(resolution),
      paragraph(resolution.fragment.text),
      disputedMarker(resolution.fragment.disputed),
      describeChanges(before, snapshotForDiff(store.session.state)),
      el("button", { type: "button", class: "primary", onclick: proceed }, store.session.state.alive ? "계속" : "생애를 마친다")));
}

export function renderNode(node) {
  advanceToYear(store.session.state, store.content.figure, node.year);
  render(
    el("section", { class: "card node-card" },
      eventHeader(`${formatYear(node.year)} · 분기점`, node.title),
      node.foreshadow ? el("p", { class: "foreshadow" }, node.foreshadow) : null,
      paragraph(node.situation),
      disputedMarker(node.disputed),
      el("div", { class: "choices" }, node.choices.map((choice) => choiceButton(choice, (picked) => pickNode(node, picked), previewProbability(choice))))));
}
