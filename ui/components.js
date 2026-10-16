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
    store.settings.devMode && probability !== undefined ? el("span", { class: "prob num" }, formatPercent(probability)) : null);
}

function portraitUrl(figure) {
  return new URL(`../data/figures/${figure.id}/${figure.portrait.file}`, import.meta.url).href;
}

export function portraitFrame(figure) {
  const frame = el("div", { class: "portrait", role: "img", "aria-label": `${figure.name}의 초상 자리, 48×48 도트` });
  if (figure.portrait?.file) frame.append(el("img", { src: portraitUrl(figure), alt: "" }));
  return frame;
}
