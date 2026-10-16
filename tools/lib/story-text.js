import { buildStoryLog, groupByYear } from "../../ui/story-log.js";

const NARRATION_TAGS = { era: "시대", chronicle: "기록", life: "생활" };
const DEATH_LINES = {
  node: "갈림길의 결과로 당신은 이 해에 세상을 떠난다.",
  survival: "세월이 흐른다. 당신은 이 해에 세상을 떠난다.",
  naturalDeath: "세월이 흐른다. 당신은 이 해에 세상을 떠난다.",
  maxAgeDeath: "백 살에 이른 해, 당신은 세상을 떠난다.",
};

function formatYear(year) {
  return year < 0 ? `기원전 ${-year}년` : `${year}년`;
}

function percent(probability) {
  return `${(probability * 100).toFixed(1)}%`;
}

function findChoice(source, choiceId) {
  return source.choices.find((choice) => choice.id === choiceId);
}

function chosenLines(tag, source, entry) {
  const choice = findChoice(source, entry.choice);
  return [`[${tag}] ${source.title}`, source.situation, `› ${choice.label}`, choice.text];
}

function narrationLines(entry, content) {
  return [`[${NARRATION_TAGS[entry.kind]}] ${content.narrationIndex[entry.kind][entry.id].text}`];
}

function nodeLines(entry, content) {
  const node = content.nodeIndex[entry.node];
  const choice = findChoice(node, entry.choice);
  const fragment = content.fragmentIndex[choice[entry.result].fragment];
  const verdict = entry.result === "success" ? "성공" : "실패";
  return [`[갈림길] ${node.title}`, node.situation, `› ${choice.label} — ${verdict} (${percent(entry.probability)})`, fragment.text];
}

const LINE_BUILDERS = {
  birth: (entry, content) => [`[출생] ${content.figure.prologue.text}`],
  focusChosen: (entry, content, statNames) => [`[초점] ${statNames[entry.stat]}에 힘을 쏟기 시작한다`],
  focusChanged: (entry, content, statNames) => [`[초점] 이제 ${statNames[entry.stat]}에 힘을 쏟는다`],
  era: narrationLines,
  chronicle: narrationLines,
  life: narrationLines,
  growth: (entry, content) => chosenLines("성장", content.growthIndex[entry.event], entry),
  commonEvent: (entry, content) => chosenLines("일상", content.eventIndex[entry.event], entry),
  node: nodeLines,
  survival: (entry) => [`[생존 판정] ${percent(entry.probability)} → ${entry.survived ? "이 해를 넘긴다" : "이 해를 넘기지 못한다"}`],
  death: (entry) => [`[생애의 끝] ${DEATH_LINES[entry.cause]}`],
};

export function formatStoryLog(state, content) {
  const statNames = Object.fromEntries(content.stats.map((stat) => [stat.id, stat.name]));
  return groupByYear(buildStoryLog(state, content)).flatMap((group) => [
    `${formatYear(group.year)} · ${group.age}세`,
    ...group.entries.flatMap((entry) => (LINE_BUILDERS[entry.kind]?.(entry, content, statNames) ?? []).filter(Boolean).map((line) => `    ${line}`)),
  ]);
}
