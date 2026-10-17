import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./lib/load-content.js";
import { pipelinePath, readArgs, readJsonIfExists, writeJson } from "./lib/pipeline-files.js";

const STAGES = ["parse", "propose", "generate", "validate", "conflicts", "tune", "factcheck", "review", "finish"];
const STAGE_NAMES = {
  parse: "0 연표 파싱",
  propose: "1 노드·성장 사건 제안",
  generate: "2 JSON 생성",
  validate: "3 검증 루프",
  conflicts: "4 충돌 플래그 점검",
  tune: "5 난이도 조정",
  factcheck: "6 사실 대조",
  review: "7 검수",
  finish: "8 마무리",
};
const DEFAULT_FIGURE_COUNT = 100;

function loadState(figureId) {
  return readJsonIfExists(pipelinePath(figureId, "state.json"), {
    id: figureId,
    stages: Object.fromEntries(STAGES.map((stage) => [stage, "pending"])),
    approvals: {},
    waiting: null,
  });
}

function loadMetrics(figureId) {
  return readJsonIfExists(pipelinePath(figureId, "metrics.json"), { events: [] });
}

function save(figureId, state, metrics) {
  writeJson(pipelinePath(figureId, "state.json"), state);
  writeJson(pipelinePath(figureId, "metrics.json"), metrics);
}

function assertStage(stage) {
  if (!STAGES.includes(stage)) throw new Error(`없는 단계: ${stage} (가능: ${STAGES.join(", ")})`);
}

function parseCounts(text) {
  if (!text || text === true) return {};
  return Object.fromEntries(String(text).split(",").map((pair) => {
    const [key, value] = pair.split("=");
    const number = Number(value);
    return [key.trim(), Number.isNaN(number) ? value : number];
  }));
}

function record(figureId, mutate) {
  const state = loadState(figureId);
  const metrics = loadMetrics(figureId);
  const event = mutate(state, new Date().toISOString());
  if (event) metrics.events.push(event);
  save(figureId, state, metrics);
  return state;
}

function pairIntervals(events, openType, closeType, keyOf) {
  const open = new Map();
  const intervals = [];
  for (const event of events) {
    const key = keyOf(event);
    if (event.type === openType) open.set(key, event);
    if (event.type === closeType && open.has(key)) {
      const start = open.get(key);
      intervals.push({ key, start: start.at, end: event.at, ms: Date.parse(event.at) - Date.parse(start.at), counts: event.counts ?? {} });
      open.delete(key);
    }
  }
  return intervals;
}

function mergeCounts(target, counts) {
  for (const [key, value] of Object.entries(counts)) {
    target[key] = typeof value === "number" ? (target[key] ?? 0) + value : value;
  }
}

function summarize(figureId) {
  const { events } = loadMetrics(figureId);
  const stageRuns = pairIntervals(events, "start", "end", (event) => event.stage);
  const waits = pairIntervals(events, "wait", "resume", () => "wait");
  const byStage = Object.fromEntries(STAGES.map((stage) => [stage, { ms: 0, runs: 0, counts: {} }]));
  for (const run of stageRuns) {
    byStage[run.key].ms += run.ms;
    byStage[run.key].runs += 1;
    mergeCounts(byStage[run.key].counts, run.counts);
  }
  const waitMs = waits.reduce((sum, wait) => sum + wait.ms, 0);
  const activeMs = Object.values(byStage).reduce((sum, stage) => sum + stage.ms, 0);
  const reviewMs = byStage.review.ms;
  return { figureId, byStage, waitMs, activeMs, reviewMs, waitReasons: events.filter((event) => event.type === "wait").map((event) => event.reason) };
}

function minutes(ms) {
  return `${(ms / 60000).toFixed(1)}분`;
}

function printSummary(summary) {
  console.log(`${summary.figureId} 단계별 시간`);
  for (const stage of STAGES) {
    const row = summary.byStage[stage];
    if (!row.runs) continue;
    const counts = Object.entries(row.counts).map(([key, value]) => `${key}=${value}`).join(", ");
    console.log(`  ${STAGE_NAMES[stage].padEnd(14)} ${minutes(row.ms).padStart(8)}  ${row.runs}회${counts ? `  (${counts})` : ""}`);
  }
  console.log(`  작업 시간 합계 ${minutes(summary.activeMs)} (그중 사람 검수 ${minutes(summary.reviewMs)}), 승인 대기 ${minutes(summary.waitMs)}`);
}

function finishedFigures() {
  const root = join(REPO_ROOT, "tools", "pipeline");
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((id) => loadState(id).stages.finish === "done");
}

function printEstimate(figureCount) {
  const summaries = finishedFigures().map(summarize);
  if (!summaries.length) {
    console.log("마무리 단계까지 끝난 인물이 없어 추정할 수 없다");
    return;
  }
  const average = (pick) => summaries.reduce((sum, summary) => sum + pick(summary), 0) / summaries.length;
  const machine = average((summary) => summary.activeMs - summary.reviewMs);
  const review = average((summary) => summary.reviewMs);
  const wait = average((summary) => summary.waitMs);
  console.log(`완료 인물 ${summaries.length}명 평균 기준, 인물 ${figureCount}명 추정`);
  console.log(`  Claude·스크립트 작업 ${minutes(machine)} × ${figureCount} = ${(machine * figureCount / 3600000).toFixed(1)}시간`);
  console.log(`  사람 검수 ${minutes(review)} × ${figureCount} = ${(review * figureCount / 3600000).toFixed(1)}시간`);
  console.log(`  승인 대기(참고) ${minutes(wait)} × ${figureCount} = ${(wait * figureCount / 3600000).toFixed(1)}시간`);
}

function printStatus(figureId) {
  const state = loadState(figureId);
  for (const stage of STAGES) console.log(`  ${STAGE_NAMES[stage].padEnd(14)} ${state.stages[stage]}`);
  for (const [gate, approval] of Object.entries(state.approvals)) console.log(`  승인 ${gate}: ${approval.by} (${approval.at})${approval.note ? ` — ${approval.note}` : ""}`);
  if (state.waiting) console.log(`  대기 중: ${state.waiting.reason} (${state.waiting.since})`);
}

const COMMANDS = {
  start: ([figureId, stage]) => {
    assertStage(stage);
    record(figureId, (state, at) => {
      state.stages[stage] = "running";
      return { type: "start", stage, at };
    });
  },
  end: ([figureId, stage], options) => {
    assertStage(stage);
    record(figureId, (state, at) => {
      state.stages[stage] = options.status ?? "done";
      return { type: "end", stage, at, counts: parseCounts(options.counts) };
    });
  },
  wait: ([figureId, ...reason]) => {
    record(figureId, (state, at) => {
      state.waiting = { reason: reason.join(" "), since: at };
      return { type: "wait", at, reason: reason.join(" ") };
    });
  },
  resume: ([figureId]) => {
    record(figureId, (state, at) => {
      state.waiting = null;
      return { type: "resume", at };
    });
  },
  approve: ([figureId, gate], options) => {
    record(figureId, (state, at) => {
      state.approvals[gate] = { by: options.by ?? "사용자", at, note: options.note ?? "" };
      return { type: "approve", gate, at };
    });
  },
  status: ([figureId]) => printStatus(figureId),
  summary: ([figureId]) => printSummary(summarize(figureId)),
  estimate: (positional, options) => printEstimate(Number(options.figures ?? DEFAULT_FIGURE_COUNT)),
};

const { positional, options } = readArgs(process.argv.slice(2));
const [command, ...rest] = positional;
if (!COMMANDS[command]) {
  console.log(`사용법: node tools/stage.mjs <${Object.keys(COMMANDS).join("|")}> <인물 id> ...`);
  process.exitCode = 1;
} else {
  COMMANDS[command](rest, options);
}
