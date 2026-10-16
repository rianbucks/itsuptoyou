import { addYears } from "../engine/years.js";
import { el } from "./dom.js";
import { formatPercent, formatYear, formatYearRange, statName } from "./format.js";
import { groupByYear } from "./story-log.js";
import { store } from "./store.js";

export const DEATH_SENTENCES = {
  node: "갈림길의 결과로 당신은 이 해에 세상을 떠난다.",
  survival: "세월이 흐른다. 당신은 이 해에 세상을 떠난다.",
  naturalDeath: "세월이 흐른다. 당신은 이 해에 세상을 떠난다.",
  maxAgeDeath: "백 살에 이른 해, 당신은 세상을 떠난다.",
};

function findChoice(source, choiceId) {
  return source.choices.find((choice) => choice.id === choiceId);
}

function devProbability(probability) {
  return store.settings.devMode ? el("span", { class: "prob num" }, ` ${formatPercent(probability)}`) : null;
}

function verdict(result) {
  return el("span", { class: `verdict-inline ${result}` }, result === "success" ? "성공" : "실패");
}

function text(value) {
  return value ? el("p", { class: "log-text" }, value) : null;
}

function picked(label, ...extra) {
  return el("p", { class: "log-choice" }, `› ${label} `, ...extra);
}

function entryBlock(kind, tag, title, ...body) {
  return el("div", { class: `log-entry kind-${kind}` },
    el("p", { class: "log-head" }, el("span", { class: "log-tag" }, tag), title ? el("strong", { class: "log-title" }, title) : null),
    ...body);
}

function chosenEvent(kind, tag, source, entry) {
  const choice = findChoice(source, entry.choice);
  return entryBlock(kind, tag, source.title, text(source.situation), picked(choice.label), text(choice.text));
}

export function narrationBlock(kind, id, content) {
  const item = content.narrationIndex[kind][id];
  if (kind === "era") return el("div", { class: "log-entry kind-era" }, el("span", { class: "log-tag" }, "시대"), text(item.text));
  return el("div", { class: "log-entry kind-you" }, text(item.text));
}

const RENDERERS = {
  era: (entry, content) => narrationBlock("era", entry.id, content),
  chronicle: (entry, content) => narrationBlock("chronicle", entry.id, content),
  life: (entry, content) => narrationBlock("life", entry.id, content),
  birth: (entry, content) => entryBlock("birth", "출생", "당신이 태어난다", text(content.figure.prologue.text)),
  focusChosen: (entry) => entryBlock("focus", "초점", `${statName(entry.stat)}에 힘을 쏟기 시작한다`),
  focusChanged: (entry) => entryBlock("focus", "초점", `이제 ${statName(entry.stat)}에 힘을 쏟는다`),
  growth: (entry, content) => chosenEvent("growth", "성장", content.growthIndex[entry.event], entry),
  commonEvent: (entry, content) => chosenEvent("common", "일상", content.eventIndex[entry.event], entry),
  node: (entry, content) => {
    const node = content.nodeIndex[entry.node];
    const choice = findChoice(node, entry.choice);
    const fragment = content.fragmentIndex[choice[entry.result].fragment];
    return entryBlock("node", "갈림길", node.title,
      text(node.situation),
      picked(choice.label, verdict(entry.result), devProbability(entry.probability)),
      text(fragment.text));
  },
  survival: (entry) => entryBlock("survival", "생존", null,
    el("p", { class: "log-choice" }, entry.survived ? "이 해를 넘긴다 " : "이 해를 넘기지 못한다 ", devProbability(entry.probability))),
  death: (entry) => entryBlock("death", "생애의 끝", null, text(DEATH_SENTENCES[entry.cause])),
};

function renderEntry(entry, content) {
  return RENDERERS[entry.kind]?.(entry, content) ?? null;
}

function yearRow(group, content) {
  const died = group.entries.some((entry) => entry.kind === "death");
  return el("li", { class: `log-year${died ? " died" : ""}` },
    el("span", { class: "log-when num" }, `${formatYear(group.year)} · ${group.age}세`),
    group.entries.map((entry) => renderEntry(entry, content)));
}

function quietRow(fromAge, toAge, born) {
  const ages = fromAge === toAge ? `${fromAge}세` : `${fromAge}~${toAge}세`;
  const years = formatYearRange(addYears(born, fromAge), addYears(born, toAge));
  return el("li", { class: "log-year quiet" },
    el("span", { class: "log-when num" }, `${years} · ${ages}`),
    el("p", { class: "log-quiet" }, "조용히 지나간다"));
}

function lastSettledAge(state) {
  if (!state.alive) return null;
  return state.pending ? state.age - 1 : state.age;
}

export function renderStoryLog(entries, state, content) {
  const groups = groupByYear(entries);
  const settledAge = lastSettledAge(state);
  const rows = groups.flatMap((group, index) => {
    const quietUntil = groups[index + 1] ? groups[index + 1].age - 1 : settledAge;
    const hasQuiet = quietUntil !== null && quietUntil > group.age;
    return [yearRow(group, content), hasQuiet ? quietRow(group.age + 1, quietUntil, content.figure.born) : null];
  });
  return el("ol", { class: "story-log" }, rows);
}
