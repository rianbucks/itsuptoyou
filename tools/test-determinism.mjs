import { loadContent, loadSchemas, readFigureIds } from "./lib/load-content.js";
import { validateAgainstSchema } from "./lib/json-schema.js";
import { playRandomly, recordFrom, replay } from "./lib/play.js";
import { buildStoryLog } from "../ui/story-log.js";

const SEEDS = 300;
const ORDER_KINDS = new Set(["growth", "node", "commonEvent", "survival", "death", "narration", "era", "chronicle", "life"]);
const SKIP_TEST_FIGURE = "dev_layout";
const SKIP_TEST_NODE = "dl_node_5";
const SKIP_TEST_FLAG = "dl_route_a";
const SKIP_TEST_PROBE = "test_after_skip";

function serialize(state) {
  return JSON.stringify(state);
}

function judgementRecord(state) {
  const { history, growthHistory, eventHistory, survivalHistory, focusHistory, stats, traits, flags, rngState, deathCause, year } = state;
  return JSON.stringify({ history, growthHistory, eventHistory, survivalHistory, focusHistory, stats, traits, flags, rngState, deathCause, year });
}

function withoutNarration(content) {
  return { ...content, chronicle: [], era: [], life: [] };
}

function signatureOf(kind, id, year) {
  return `${year}|${kind}:${id ?? ""}`;
}

function traceOrder(trace) {
  let year = null;
  const order = [];
  for (const entry of trace) {
    if (entry.kind === "year") year = entry.year;
    else if (entry.kind === "narration") order.push(signatureOf(entry.narration, entry.id, year));
    else if (ORDER_KINDS.has(entry.kind)) order.push(signatureOf(entry.kind, entry.event ?? entry.node, year));
  }
  return order.join(",");
}

function logOrder(log) {
  return log.filter((entry) => ORDER_KINDS.has(entry.kind))
    .map((entry) => signatureOf(entry.kind, entry.id ?? entry.event ?? entry.node, entry.year))
    .join(",");
}

function withSkippableAnchor(content) {
  const anchor = content.nodeIndex[SKIP_TEST_NODE];
  const nodes = content.nodes.map((node) => (node.id === SKIP_TEST_NODE ? { ...node, requires: { ...node.requires, flags: { [SKIP_TEST_FLAG]: true } } } : node));
  const probe = { id: SKIP_TEST_PROBE, figure: content.figure.id, year: anchor.year, after: SKIP_TEST_NODE, text: "기준 사건 건너뜀 시험", sources: ["시험"] };
  const era = [...content.era, probe];
  return {
    ...content,
    nodes,
    nodeIndex: Object.fromEntries(nodes.map((node) => [node.id, node])),
    era,
    narrationIndex: { ...content.narrationIndex, era: Object.fromEntries(era.map((item) => [item.id, item])) },
  };
}

function checkSkippedAnchor() {
  const content = withSkippableAnchor(loadContent(SKIP_TEST_FIGURE));
  const year = content.nodeIndex[SKIP_TEST_NODE].year;
  const counts = { processed: 0, skipped: 0, missing: 0, orderMismatches: 0 };
  for (let seed = 0; seed < SEEDS; seed++) {
    const { session, trace } = playRandomly(content, seed);
    const { state } = session;
    if (state.year <= year) continue;
    const processed = state.history.some((entry) => entry.node === SKIP_TEST_NODE);
    counts[processed ? "processed" : "skipped"]++;
    if (!state.narrationHistory.some((entry) => entry.id === SKIP_TEST_PROBE)) counts.missing++;
    if (traceOrder(trace) !== logOrder(buildStoryLog(state, content))) counts.orderMismatches++;
  }
  const ok = counts.processed > 0 && counts.skipped > 0 && counts.missing === 0 && counts.orderMismatches === 0;
  console.log(`\nafter 기준 사건 건너뜀 시험 (${SKIP_TEST_FIGURE} ${SKIP_TEST_NODE}에 requires 추가): 처리 ${counts.processed}판, 건너뜀 ${counts.skipped}판, 서술 누락 ${counts.missing}판, 순서 불일치 ${counts.orderMismatches}판`);
  return ok ? 0 : 1;
}

const schemas = loadSchemas();
let failures = 0;

for (const figureId of readFigureIds()) {
  const content = loadContent(figureId);
  const silent = withoutNarration(content);
  const counts = { runs: 0, mismatches: 0, logMismatches: 0, orderMismatches: 0, narrationLeaks: 0, schemaErrors: 0, focusChanges: 0, commonEvents: 0, survivalChecks: 0, logEntries: 0, narrations: 0 };
  const firstProblems = [];
  for (let seed = 0; seed < SEEDS; seed++) {
    const played = playRandomly(content, seed);
    const first = played.session.state;
    const again = playRandomly(content, seed).session.state;
    const replayed = replay(content, seed, recordFrom(first)).state;
    counts.runs++;
    counts.focusChanges += Math.max(0, first.focusHistory.length - 1);
    counts.commonEvents += first.eventHistory.length;
    counts.survivalChecks += first.survivalHistory.length;
    if (serialize(first) !== serialize(again) || serialize(first) !== serialize(replayed)) {
      counts.mismatches++;
      if (firstProblems.length < 3) firstProblems.push(`seed ${seed}: 같은 시드·같은 입력인데 상태가 다르다`);
    }
    counts.narrations += first.narrationHistory.length;
    if (judgementRecord(first) !== judgementRecord(playRandomly(silent, seed).session.state)) {
      counts.narrationLeaks++;
      if (firstProblems.length < 3) firstProblems.push(`seed ${seed}: 서술 파일을 비우면 판정 기록이 달라진다`);
    }
    const log = JSON.stringify(buildStoryLog(first, content));
    if (traceOrder(played.trace) !== logOrder(JSON.parse(log))) {
      counts.orderMismatches++;
      if (firstProblems.length < 3) firstProblems.push(`seed ${seed}: 스토리 로그 순서가 엔진 처리 순서와 다르다`);
    }
    counts.logEntries += JSON.parse(log).length;
    if (log !== JSON.stringify(buildStoryLog(replayed, content))) {
      counts.logMismatches++;
      if (firstProblems.length < 3) firstProblems.push(`seed ${seed}: 같은 시드·같은 입력인데 스토리 로그가 다르다`);
    }
    const schemaErrors = validateAgainstSchema("state.schema.json", first, schemas);
    if (schemaErrors.length) {
      counts.schemaErrors++;
      if (firstProblems.length < 3) firstProblems.push(`seed ${seed}: ${schemaErrors[0]}`);
    }
  }
  failures += counts.mismatches + counts.logMismatches + counts.orderMismatches + counts.narrationLeaks + counts.schemaErrors;
  console.log(`\n${figureId}: ${counts.runs}판`);
  console.log(`  재현 불일치 ${counts.mismatches}판, 스토리 로그 불일치 ${counts.logMismatches}판, 로그 순서 불일치 ${counts.orderMismatches}판, state.schema 위반 ${counts.schemaErrors}판`);
  console.log(`  서술을 비운 판과 판정 기록이 다른 판 ${counts.narrationLeaks}판 (서술 평균 ${(counts.narrations / counts.runs).toFixed(1)}개)`);
  console.log(`  스토리 로그 평균 ${(counts.logEntries / counts.runs).toFixed(1)}항목`);
  console.log(`  입력 다양성: 초점 변경 ${counts.focusChanges}회, 공통 이벤트 ${counts.commonEvents}회, 생존 판정 ${counts.survivalChecks}회`);
  for (const problem of firstProblems) console.log(`  ${problem}`);
}

failures += checkSkippedAnchor();
console.log(failures ? `\n실패 ${failures}건` : "\n모두 통과");
process.exitCode = failures ? 1 : 0;
