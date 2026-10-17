import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, loadContent } from "./lib/load-content.js";
import { pipelinePath, readArgs, writeJson } from "./lib/pipeline-files.js";
import {
  alternateChoiceKeys,
  choiceKey,
  endingProblems,
  historicalChoiceKeys,
  historyMatchAverage,
  LEANING_HISTORICAL_CHANCE,
  measureEndings,
  measureHistoryMatch,
  measureLeaningEndings,
  readDifficulties,
  withDifficulties,
} from "./lib/tuning.js";

const BOUND = 20;
const HISTORICAL_STEP = 2;
const ALTERNATE_STEP = 3;
const SEARCH_RUNS = 300;
const CHECK_RUNS = 1000;
const ENDING_RUNS = 3000;
const MAX_HISTORICAL_ITERATIONS = 40;
const MAX_ALTERNATE_STEPS = 80;
const MIN_SAMPLES = 5;
const ZERO_ENDING_PENALTY = 0.05;

function clampDifficulty(original, value) {
  return Math.max(0, Math.min(100, Math.max(original - BOUND, Math.min(original + BOUND, value))));
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function applyHistorical(original, keys, bumps, offset) {
  const next = new Map(original);
  for (const { key } of keys) next.set(key, clampDifficulty(original.get(key), original.get(key) + (bumps.get(key) ?? 0) + offset));
  return next;
}

function averageWith(content, difficulties) {
  return historyMatchAverage(withDifficulties(content, difficulties), SEARCH_RUNS);
}

function centerOffset(content, original, keys, bumps, target) {
  let low = -BOUND;
  let high = BOUND;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (averageWith(content, applyHistorical(original, keys, bumps, middle)) > target) low = middle + 1;
    else high = middle;
  }
  const at = (offset) => Math.abs(averageWith(content, applyHistorical(original, keys, bumps, offset)) - target);
  return low > -BOUND && at(low - 1) < at(low) ? low - 1 : low;
}

function isHistoryMatchOk(match, rules) {
  const { targetMin, targetMax, focusMax } = rules.historyMatch;
  return match.average >= targetMin && match.average <= targetMax && match.bestValue <= focusMax;
}

function violation(match, rules) {
  const { targetMin, targetMax, focusMax } = rules.historyMatch;
  return Math.max(0, match.bestValue - focusMax) + Math.max(0, targetMin - match.average) + Math.max(0, match.average - targetMax);
}

function tuneHistorical(content, original, log) {
  const keys = historicalChoiceKeys(content);
  const { targetMin, targetMax, focusMax } = content.rules.historyMatch;
  const target = (targetMin + targetMax) / 2;
  const bumps = new Map();
  let best = { difficulties: original, violation: Infinity };
  const fail = (iterations, reason) => ({ difficulties: best.difficulties, ok: false, iterations, reason: `${reason}. 목표에 가장 가까웠던 값을 남긴다` });
  if (!keys.length) return { difficulties: original, ok: true, iterations: 0, reason: "역사대로 선택지가 없다" };
  for (let iteration = 1; iteration <= MAX_HISTORICAL_ITERATIONS; iteration++) {
    const offset = centerOffset(content, original, keys, bumps, target);
    const difficulties = applyHistorical(original, keys, bumps, offset);
    const match = measureHistoryMatch(withDifficulties(content, difficulties), SEARCH_RUNS);
    log.push(`A${iteration}: 공통 이동 ${offset >= 0 ? "+" : ""}${offset}, 평균 ${percent(match.average)}, 초점 최고 ${match.bestStat} ${percent(match.bestValue)}`);
    if (isHistoryMatchOk(match, content.rules)) return { difficulties, ok: true, iterations: iteration };
    if (violation(match, content.rules) < best.violation) best = { difficulties, violation: violation(match, content.rules) };
    if (match.bestValue <= focusMax) return fail(iteration, `difficulty를 ±${BOUND} 안에서 움직여도 평균을 ${percent(targetMin)}~${percent(targetMax)}에 맞출 수 없다`);
    const candidates = keys
      .filter(({ key, choice }) => (choice.check.stats[match.bestStat] ?? 0) > 0 && (bumps.get(key) ?? 0) + HISTORICAL_STEP <= BOUND)
      .sort((a, b) => b.choice.check.stats[match.bestStat] - a.choice.check.stats[match.bestStat]);
    if (!candidates.length) return fail(iteration, `역사대로 선택지가 모두 ${match.bestStat}에 크게 기대고 있어 ±${BOUND} 안의 difficulty 조정으로는 초점 고정 최고값을 낮출 수 없다`);
    const [pick] = candidates;
    bumps.set(pick.key, (bumps.get(pick.key) ?? 0) + HISTORICAL_STEP);
  }
  return fail(MAX_HISTORICAL_ITERATIONS, "반복 상한에 닿았다");
}

function endingScore(content, shares) {
  const { max } = content.rules.endingShare;
  return endingProblems(content, shares).reduce((sum, problem) => sum + (problem.kind === "high" ? problem.share - max : ZERO_ENDING_PENALTY), 0);
}

function outcomeCounts(samples, key, endingId) {
  const counts = { success: 0, failure: 0, successEnding: 0, failureEnding: 0 };
  for (const sample of samples) {
    const outcome = sample.outcomes.find((entry) => entry.key === key);
    if (!outcome) continue;
    counts[outcome.result] += 1;
    if (sample.ending === endingId) counts[`${outcome.result}Ending`] += 1;
  }
  return counts;
}

function canMove(original, difficulties, key, direction) {
  const current = difficulties.get(key);
  return clampDifficulty(original.get(key), current + direction * ALTERNATE_STEP) !== current;
}

function moveForHighEnding(problem, measurement, alternates, original, difficulties, tabu) {
  return alternates
    .map(({ key }) => {
      const counts = outcomeCounts(measurement.samples, key, problem.ending.id);
      if (counts.success < MIN_SAMPLES || counts.failure < MIN_SAMPLES) return null;
      const delta = counts.successEnding / counts.success - counts.failureEnding / counts.failure;
      return { key, direction: delta > 0 ? 1 : -1, weight: Math.abs(delta) * (counts.success + counts.failure) };
    })
    .filter((move) => move && move.weight > 0 && !tabu.has(`${move.key}:${move.direction}`) && canMove(original, difficulties, move.key, move.direction))
    .sort((a, b) => b.weight - a.weight)[0] ?? null;
}

function requiredFlags(ending) {
  const { all = {}, any = {} } = ending.conditions;
  return Object.entries({ ...all, ...any }).filter(([flag]) => flag !== "deviated");
}

function moveForZeroEnding(problem, alternates, original, difficulties, tabu) {
  const required = requiredFlags(problem.ending);
  return alternates
    .flatMap(({ key, choice }) => ["success", "failure"].map((result) => {
      const setFlags = choice[result].setFlags ?? {};
      const weight = required.filter(([flag, value]) => setFlags[flag] === value).length;
      return { key, direction: result === "success" ? -1 : 1, weight };
    }))
    .filter((move) => move.weight > 0 && !tabu.has(`${move.key}:${move.direction}`) && canMove(original, difficulties, move.key, move.direction))
    .sort((a, b) => b.weight - a.weight)[0] ?? null;
}

function tuneAlternates(content, original, startDifficulties, log) {
  const alternates = alternateChoiceKeys(content);
  let difficulties = startDifficulties;
  let measurement = measureEndings(withDifficulties(content, difficulties), ENDING_RUNS);
  let score = endingScore(content, measurement.shares);
  const tabu = new Set();
  const stuck = new Map();
  for (let step = 1; step <= MAX_ALTERNATE_STEPS; step++) {
    const problems = endingProblems(content, measurement.shares).filter((problem) => !stuck.has(problem.ending.id));
    if (!problems.length) break;
    const problem = problems.sort((a, b) => b.share - a.share)[0];
    const move = problem.kind === "high"
      ? moveForHighEnding(problem, measurement, alternates, original, difficulties, tabu)
      : moveForZeroEnding(problem, alternates, original, difficulties, tabu);
    if (!move) {
      stuck.set(problem.ending.id, problem.kind === "high"
        ? "difficulty로 줄일 수 있는 대안 선택지가 없다 (결말 조건이 넓거나 다른 결말이 부족한 구조 문제)"
        : "이 결말의 조건 플래그를 남기는 대안 선택지가 없거나 더 움직일 수 없다 (구조 문제)");
      continue;
    }
    const candidate = new Map(difficulties);
    candidate.set(move.key, clampDifficulty(original.get(move.key), difficulties.get(move.key) + move.direction * ALTERNATE_STEP));
    const candidateMeasurement = measureEndings(withDifficulties(content, candidate), ENDING_RUNS);
    const candidateScore = endingScore(content, candidateMeasurement.shares);
    const accepted = candidateScore < score;
    log.push(`B${step}: ${problem.ending.id} ${percent(problem.share)} → ${move.key} ${move.direction > 0 ? "+" : "-"}${ALTERNATE_STEP} ${accepted ? "채택" : "되돌림"} (점수 ${score.toFixed(3)} → ${candidateScore.toFixed(3)})`);
    if (accepted) {
      difficulties = candidate;
      measurement = candidateMeasurement;
      score = candidateScore;
    } else {
      tabu.add(`${move.key}:${move.direction}`);
    }
  }
  const remaining = endingProblems(content, measurement.shares).map((problem) => ({
    ending: problem.ending.id,
    kind: problem.kind,
    share: problem.share,
    reason: stuck.get(problem.ending.id) ?? "반복 상한에 닿았다",
  }));
  return { difficulties, shares: measurement.shares, remaining };
}

function describeChoice(content, key) {
  const [nodeId, choiceId] = key.split("/");
  const node = content.nodeIndex[nodeId];
  const choice = node.choices.find((item) => item.id === choiceId);
  const year = node.year < 0 ? `기원전 ${-node.year}년` : `${node.year}년`;
  return `${year} ${node.title} — ${choice.label}${choice.historical ? " (역사대로)" : ""}`;
}

function writeNodes(figureId, difficulties) {
  const path = join(REPO_ROOT, "data", "figures", figureId, "nodes.json");
  const nodes = JSON.parse(readFileSync(path, "utf8"));
  for (const node of nodes) for (const choice of node.choices) choice.check.difficulty = difficulties.get(choiceKey(node, choice));
  writeFileSync(path, `${JSON.stringify(nodes, null, 2)}\n`);
}

const { positional, options } = readArgs(process.argv.slice(2));
const [figureId] = positional;
if (!figureId) {
  console.log("사용법: node tools/tune-difficulty.mjs <인물 id> [--write]");
  process.exit(1);
}

const content = loadContent(figureId);
const original = readDifficulties(content);
const log = [];
const before = {
  match: measureHistoryMatch(content, CHECK_RUNS),
  shares: measureEndings(content, ENDING_RUNS).shares,
  leaning: measureLeaningEndings(content, ENDING_RUNS).shares,
};
const historical = tuneHistorical(content, original, log);
const alternates = tuneAlternates(content, original, historical.difficulties, log);
const tuned = withDifficulties(content, alternates.difficulties);
const after = { match: measureHistoryMatch(tuned, CHECK_RUNS), shares: alternates.shares, leaning: measureLeaningEndings(tuned, ENDING_RUNS).shares };
const changes = [...original].filter(([key, value]) => alternates.difficulties.get(key) !== value)
  .map(([key, value]) => ({ key, label: describeChoice(content, key), before: value, after: alternates.difficulties.get(key) }));
const historyOk = isHistoryMatchOk(after.match, content.rules);
const ok = historyOk && !alternates.remaining.length;

console.log(`${figureId} 난이도 조정 (${options.write ? "기록" : "미리보기"})`);
console.log(`  역사 일치 확률 평균 ${percent(before.match.average)} → ${percent(after.match.average)}, 초점 고정 최고 ${before.match.bestStat} ${percent(before.match.bestValue)} → ${after.match.bestStat} ${percent(after.match.bestValue)}`);
console.log(`  결말 비율: 무작위 선택(판정 기준) | 참고: 역사대로 ${percent(LEANING_HISTORICAL_CHANCE)} 선택 플레이어`);
for (const ending of content.endings) console.log(`    ${ending.id.padEnd(28)} ${percent(before.shares[ending.id]).padStart(6)} → ${percent(after.shares[ending.id]).padStart(6)}  | ${percent(before.leaning[ending.id]).padStart(6)} → ${percent(after.leaning[ending.id]).padStart(6)}`);
console.log(`  바뀐 difficulty ${changes.length}개`);
for (const change of changes) console.log(`    ${change.label}: ${change.before} → ${change.after}`);
if (!historical.ok) console.log(`  미해결  역사 일치 확률: ${historical.reason}`);
for (const problem of alternates.remaining) console.log(`  미해결  ${problem.ending} ${percent(problem.share)} (${problem.kind === "high" ? "상한 이상" : "도달 0"}): ${problem.reason}`);
console.log(ok ? "  목표 달성" : "  목표 미달: 사람이 결말 조건이나 노드 구조를 확인해야 한다");

writeJson(pipelinePath(figureId, "tune.json"), { ok, before, after, changes, historical: { ok: historical.ok, iterations: historical.iterations, reason: historical.reason ?? null }, remaining: alternates.remaining, log });
if (options.write && changes.length) writeNodes(figureId, alternates.difficulties);
process.exitCode = ok ? 0 : 1;
