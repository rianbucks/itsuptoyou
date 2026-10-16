import { el } from "../dom.js";
import { disputedMarker, paragraph, sourcesList } from "../components.js";
import { mapChips } from "../map/legend.js";
import { store } from "../store.js";

export function endingCard(ending) {
  const isReal = ending.kind === "historical";
  return el("div", { class: `world-card ${isReal ? "real" : "alt"}` },
    el("p", { class: "badge" }, isReal ? "실제 역사" : "대체역사"),
    el("p", { class: "card-kicker" }, "내가 만든 2026년"),
    el("h4", {}, ending.cardTitle),
    el("p", { class: "muted" }, `플레이한 인물: ${store.content.figure.name}`),
    mapChips(ending.map),
    paragraph(ending.text),
    ending.costs ? el("p", { class: "costs" }, "비용: ", ending.costs) : null,
    isReal ? sourcesList(ending.sources) : null,
    disputedMarker(ending.disputed));
}
