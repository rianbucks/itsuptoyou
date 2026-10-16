import { advanceToYear } from "../../engine/state.js";
import { applyGrowthChoice } from "../../engine/growth.js";
import { el } from "../dom.js";
import { choiceButton, disputedMarker, eventHeader, paragraph } from "../components.js";
import { describeChanges, snapshotForDiff } from "../changes.js";
import { proceed } from "../flow.js";
import { formatYear } from "../format.js";
import { render } from "../render.js";
import { store } from "../store.js";

function pickGrowth(event, choice) {
  const before = snapshotForDiff(store.session.state);
  applyGrowthChoice(store.session, store.content, event, choice);
  render(
    el("section", { class: "card" },
      eventHeader(`${formatYear(event.year)} · 성장`, event.title),
      el("p", { class: "picked" }, choice.label),
      paragraph(choice.text),
      describeChanges(before, snapshotForDiff(store.session.state)),
      el("button", { type: "button", class: "primary", onclick: proceed }, "계속")));
}

export function renderGrowth(event) {
  advanceToYear(store.session.state, store.content.figure, event.year);
  render(
    el("section", { class: "card" },
      eventHeader(`${formatYear(event.year)} · 성장`, event.title),
      paragraph(event.situation),
      disputedMarker(event.disputed),
      el("div", { class: "choices" }, event.choices.map((choice) => choiceButton(choice, (picked) => pickGrowth(event, picked))))));
}
