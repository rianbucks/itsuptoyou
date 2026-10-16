import { el } from "../dom.js";

export function mapChips(map) {
  return el("div", { class: "chips" }, map.regions.map((region) =>
    el("span", { class: "chip" }, el("span", { class: "swatch", style: `background:${region.color}` }), region.label)));
}
