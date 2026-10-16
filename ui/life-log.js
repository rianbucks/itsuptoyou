import { el } from "./dom.js";
import { formatYear, formatYearRange, statName } from "./format.js";
import { store } from "./store.js";

const NOTABLE = new Set(["focusChosen", "focusChanged", "growth", "node", "commonEvent", "death"]);
const EVENTFUL = new Set(["growth", "node", "commonEvent", "death"]);
const DEATH_LINES = {
  node: "갈림길의 끝에서 세상을 떠난다",
  survival: "세상을 떠난다",
  naturalDeath: "세상을 떠난다",
  maxAgeDeath: "백 살에 이르러 세상을 떠난다",
};

function groupByYear(trace) {
  const years = [];
  for (const entry of trace) {
    if (entry.kind === "year") years.push({ year: entry.year, age: entry.age, entries: [] });
    else years.at(-1)?.entries.push(entry);
  }
  return years;
}

function isQuiet(group) {
  return !group.entries.some((entry) => NOTABLE.has(entry.kind));
}

function mergeQuietYears(groups) {
  const merged = [];
  for (const group of groups) {
    const last = merged.at(-1);
    if (last?.quiet && isQuiet(group)) {
      last.to = group;
      last.entries.push(...group.entries);
    } else {
      merged.push({ from: group, to: group, quiet: isQuiet(group), entries: [...group.entries] });
    }
  }
  return merged;
}

function labelOf(choices, choiceId) {
  return choices.find((choice) => choice.id === choiceId)?.label ?? choiceId;
}

function describe(entry) {
  const { content } = store;
  switch (entry.kind) {
    case "focusChosen": return `${statName(entry.stat)}에 힘을 쏟기 시작한다`;
    case "focusChanged": return `다음 해부터 ${statName(entry.stat)}에 힘을 쏟는다`;
    case "growth": {
      const event = content.growthIndex[entry.event];
      return `${event.title} — ${labelOf(event.choices, entry.choice)}`;
    }
    case "node": {
      const node = content.nodeIndex[entry.node];
      return `${node.title} — ${labelOf(node.choices, entry.choice)} · ${entry.result === "success" ? "성공" : "실패"}`;
    }
    case "commonEvent": {
      const event = content.eventIndex[entry.event];
      return `${event.title} — ${labelOf(event.choices, entry.choice)}`;
    }
    case "death": return DEATH_LINES[entry.cause];
    default: return null;
  }
}

function growthSummary(entries) {
  const totals = new Map();
  for (const entry of entries) {
    if (entry.kind === "focusGrowth") totals.set(entry.stat, (totals.get(entry.stat) ?? 0) + entry.amount);
  }
  const survivedYears = entries.filter((entry) => entry.kind === "survival" && entry.survived).length;
  const parts = [...totals].map(([stat, amount]) => `${statName(stat)} +${amount}`);
  if (survivedYears) parts.push(survivedYears === 1 ? "한 해를 무사히 넘긴다" : `${survivedYears}해를 무사히 넘긴다`);
  return parts.join(" · ");
}

function periodLabel({ from, to }) {
  if (from === to) return `${formatYear(from.year)} · ${from.age}세`;
  return `${formatYearRange(from.year, to.year)} · ${from.age}~${to.age}세`;
}

function logRow(item) {
  const lines = item.entries.map(describe).filter(Boolean);
  const summary = growthSummary(item.entries);
  const eventful = item.entries.some((entry) => EVENTFUL.has(entry.kind));
  const died = item.entries.some((entry) => entry.kind === "death");
  return el("li", { class: `log-row${eventful ? " eventful" : ""}${died ? " died" : ""}` },
    el("span", { class: "log-when num" }, periodLabel(item)),
    lines.map((line) => el("span", { class: "log-line" }, line)),
    summary ? el("span", { class: "log-growth" }, summary) : null,
    !lines.length && !summary ? el("span", { class: "log-growth" }, "조용히 지나간다") : null);
}

export function renderLifeLog(trace, { newestFirst }) {
  const items = mergeQuietYears(groupByYear(trace));
  if (!items.length) return el("p", { class: "log-empty" }, "아직 지나간 해가 없다.");
  return el("ol", { class: "life-log" }, (newestFirst ? items.reverse() : items).map(logRow));
}

export function currentYearEntries(trace) {
  return groupByYear(trace).at(-1)?.entries ?? [];
}

export function yearSummary(entries) {
  return growthSummary(entries);
}
