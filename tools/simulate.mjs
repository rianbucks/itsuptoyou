import { selectEnding } from "../engine/ending.js";
import { computeAge } from "../engine/years.js";
import { loadContent, readFigureIds } from "./lib/load-content.js";
import { playLeaningHistorical, playRandomly } from "./lib/play.js";
import { LEANING_HISTORICAL_CHANCE } from "./lib/tuning.js";
import { formatStoryLog } from "./lib/story-text.js";
import { formatTrace } from "./lib/trace.js";

const DEFAULT_RUNS = 20000;

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv.slice(index + 1);
}

function percent(count, total) {
  return `${((count / total) * 100).toFixed(1)}%`;
}

function countBy(items, keyOf) {
  const counts = new Map();
  for (const item of items) counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1);
  return counts;
}

function summarize(figureId, runs) {
  const content = loadContent(figureId);
  const states = Array.from({ length: runs }, (_, seed) => playRandomly(content, seed).session.state);
  const endings = countBy(states, (state) => selectEnding(content.endings, state.flags).id);
  const leaning = countBy(Array.from({ length: runs }, (_, seed) => playLeaningHistorical(content, seed, LEANING_HISTORICAL_CHANCE).session.state), (state) => selectEnding(content.endings, state.flags).id);
  const causes = countBy(states, (state) => state.deathCause);
  const average = (valueOf) => (states.reduce((sum, state) => sum + valueOf(state), 0) / runs).toFixed(1);
  console.log(`\n${figureId} (무작위 선택 ${runs}판)`);
  console.log(`결말 | 비율 | 참고: 역사대로 ${percent(LEANING_HISTORICAL_CHANCE, 1)} 선택 플레이어`);
  for (const ending of content.endings) {
    const count = endings.get(ending.id) ?? 0;
    console.log(`${ending.id} (${ending.cardTitle}) | ${percent(count, runs)}${count === 0 && ending.kind !== "historical" && !ending.isDefault ? "  ← 도달 0" : ""}${count / runs >= content.rules.endingShare.max ? `  ← ${percent(content.rules.endingShare.max, 1)} 이상` : ""} | ${percent(leaning.get(ending.id) ?? 0, runs)}`);
  }
  console.log(`실제 역사 결말 | ${percent(endings.get(content.endings.find((ending) => ending.kind === "historical").id) ?? 0, runs)}`);
  console.log(`기록보다 오래 산 판 | ${percent(states.filter((state) => state.flags.outlived).length, runs)}`);
  console.log(`사망 원인 | ${[...causes].map(([cause, count]) => `${cause} ${percent(count, runs)}`).join(", ")}`);
  console.log(`평균 사망 나이 ${average((state) => state.age)}세 (기록 ${computeAge(content.figure.born, content.figure.died)}세), 평균 공통 이벤트 ${average((state) => state.eventHistory.length)}개`);
}

function printTrace(figureId, seed) {
  const content = loadContent(figureId);
  const { session, trace } = playRandomly(content, seed);
  console.log(`${figureId} seed ${seed}`);
  for (const line of formatTrace(trace, content)) console.log(line);
  console.log(`결말: ${selectEnding(content.endings, session.state.flags).cardTitle}`);
}

function printStory(figureId, seed) {
  const content = loadContent(figureId);
  const { state } = playRandomly(content, seed).session;
  console.log(`${figureId} seed ${seed}`);
  for (const line of formatStoryLog(state, content)) console.log(line);
  console.log(`결말: ${selectEnding(content.endings, state.flags).cardTitle}`);
}

const traceArgs = readOption("--trace");
const storyArgs = readOption("--story");
if (traceArgs) {
  printTrace(traceArgs[0], Number(traceArgs[1] ?? 0));
} else if (storyArgs) {
  printStory(storyArgs[0], Number(storyArgs[1] ?? 0));
} else {
  const runs = Number(readOption("--runs")?.[0] ?? DEFAULT_RUNS);
  for (const figureId of readFigureIds()) summarize(figureId, runs);
}
