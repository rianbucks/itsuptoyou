import { effectiveStat } from "../engine/stats.js";
import { el } from "./dom.js";
import { traitName } from "./format.js";
import { store } from "./store.js";

export function snapshotForDiff(state) {
  const { content } = store;
  return {
    stats: Object.fromEntries(content.stats.map((stat) => [stat.id, effectiveStat(state, content, stat.id)])),
    traits: [...state.traits],
  };
}

export function describeChanges(before, after) {
  const statLines = store.content.stats
    .filter((stat) => after.stats[stat.id] !== before.stats[stat.id])
    .map((stat) => {
      const delta = after.stats[stat.id] - before.stats[stat.id];
      return `${stat.name} ${delta > 0 ? "+" : ""}${delta}`;
    });
  const gained = after.traits.filter((id) => !before.traits.includes(id)).map((id) => `특성 획득: ${traitName(id)}`);
  const lost = before.traits.filter((id) => !after.traits.includes(id)).map((id) => `특성 상실: ${traitName(id)}`);
  const lines = [...statLines, ...gained, ...lost];
  return lines.length ? el("ul", { class: "changes" }, lines.map((line) => el("li", {}, line))) : null;
}
