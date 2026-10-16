import { el } from "./dom.js";
import { formatPercent } from "./format.js";
import { store } from "./store.js";

export function paragraph(text) {
  return el("p", { class: "narration" }, text);
}

export function sourcesList(sources) {
  if (!sources?.length) return null;
  return el("p", { class: "sources" }, "출처: ", sources.join(" · "));
}

export function disputedMarker(disputed) {
  if (!disputed?.length) return null;
  const details = el("div", { class: "disputed-body", hidden: true },
    disputed.map((item) => el("div", {}, el("p", {}, item.note), sourcesList(item.sources))));
  const toggle = el("button", { class: "disputed-tag", type: "button", onclick: () => { details.hidden = !details.hidden; } }, "이견 있음");
  return el("div", { class: "disputed" }, toggle, details);
}

export function harmNote(harm) {
  if (!harm) return null;
  return el("div", { class: "harm" }, el("p", {}, harm.text), sourcesList(harm.sources), disputedMarker(harm.disputed));
}

export function historicalTag(choice) {
  return store.settings.showHistorical && choice.historical ? el("span", { class: "tag" }, "역사대로") : null;
}

export function choiceButton(choice, onPick, probability) {
  return el("button", { type: "button", class: "choice", onclick: () => onPick(choice) },
    el("span", { class: "choice-label" }, choice.label),
    historicalTag(choice),
    store.settings.devMode && probability !== undefined ? el("span", { class: "prob" }, formatPercent(probability)) : null);
}

export function eventHeader(eyebrow, title) {
  return [el("p", { class: "eyebrow" }, eyebrow), el("h2", {}, title)];
}
