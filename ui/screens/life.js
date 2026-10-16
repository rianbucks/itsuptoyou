import { resolveScheduledDeath, resolveSurvivalCheck } from "../../engine/survival.js";
import { el } from "../dom.js";
import { disputedMarker, eventHeader, paragraph } from "../components.js";
import { proceed } from "../flow.js";
import { formatYear } from "../format.js";
import { render } from "../render.js";
import { store } from "../store.js";

export function renderPrologue() {
  const { figure } = store.content;
  render(
    el("section", { class: "card" },
      el("p", { class: "eyebrow" }, `${formatYear(figure.born)} · 출생`),
      el("h2", {}, figure.name),
      paragraph(figure.prologue.text),
      disputedMarker(figure.disputed),
      el("button", { type: "button", class: "primary", onclick: proceed }, "생애를 시작한다")));
}

export function renderSurvival(year) {
  const { survived, age } = resolveSurvivalCheck(store.session, store.content, year);
  render(
    el("section", { class: "card" },
      eventHeader(formatYear(year), `${age}세`),
      paragraph(survived ? "세월이 흐른다. 당신은 이 시기를 무사히 넘긴다." : "세월이 흐른다. 당신은 이해에 세상을 떠난다."),
      el("button", { type: "button", class: "primary", onclick: proceed }, survived ? "계속" : "생애를 마친다")));
}

export function renderScheduledDeath(step) {
  resolveScheduledDeath(store.session, store.content, step.year, step.type);
  render(
    el("section", { class: "card" },
      eventHeader(formatYear(step.year), `${store.session.state.age}세`),
      paragraph("당신은 이해에 세상을 떠난다."),
      el("button", { type: "button", class: "primary", onclick: proceed }, "생애를 마친다")));
}
