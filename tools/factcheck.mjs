import { readFileSync } from "node:fs";
import { loadContent } from "./lib/load-content.js";
import { collectFactItems, factcheckStatus, reviewStatus } from "./lib/fact-items.js";
import { pipelinePath, readArgs, readJsonIfExists, reviewPath, writeJson } from "./lib/pipeline-files.js";
import { allTimelineRows } from "./lib/timeline.js";

const VERDICTS = { match: "일치", mismatch: "불일치", unverifiable: "확인 불가" };
const STATUS_NAMES = { ...VERDICTS, unchecked: "대조 안 함", stale: "내용 바뀜", pending: "미결", approved: "승인", rejected: "반려" };

function loadReview(figureId) {
  return readJsonIfExists(reviewPath(figureId), { figure: figureId, items: {} });
}

function refreshSnapshots(review, items) {
  for (const factItem of items) {
    const entry = review.items[factItem.id] ?? {};
    review.items[factItem.id] = { ...entry, label: factItem.label, kind: factItem.kind, text: factItem.text, sources: factItem.sources, hash: factItem.hash };
  }
  return review;
}

function timelineContext(figureId) {
  const timeline = readJsonIfExists(pipelinePath(figureId, "timeline.json"), null);
  const trace = readJsonIfExists(pipelinePath(figureId, "trace.json"), {});
  return { timeline, trace };
}

function rowsFor(context, itemId) {
  const rowIds = context.trace[itemId] ?? [];
  return allTimelineRows(context.timeline).filter((row) => rowIds.includes(row.id))
    .map(({ id, yearText, event, sourceText, links, marks }) => ({ id, yearText, event, sourceText, links, marks }));
}

function list(figureId, options) {
  const items = collectFactItems(loadContent(figureId));
  const review = refreshSnapshots(loadReview(figureId), items);
  writeJson(reviewPath(figureId), review);
  const context = timelineContext(figureId);
  const todo = items
    .filter((factItem) => options.all || ["unchecked", "stale"].includes(factcheckStatus(factItem, review)))
    .map((factItem) => ({ ...factItem, timelineRows: rowsFor(context, factItem.id) }));
  writeJson(pipelinePath(figureId, "factcheck-todo.json"), { references: context.timeline?.references ?? [], items: todo });
  const missingTrace = items.filter((factItem) => !context.trace[factItem.id]).map((factItem) => factItem.id);
  console.log(`${figureId}: 사실 항목 ${items.length}개, 대조할 항목 ${todo.length}개 → ${pipelinePath(figureId, "factcheck-todo.json")}`);
  if (missingTrace.length) console.log(`  경고  trace.json에 근거 행이 없는 항목 ${missingTrace.length}개: ${missingTrace.slice(0, 5).join(", ")}`);
}

function record(figureId, options) {
  const results = JSON.parse(readFileSync(options.file, "utf8"));
  const items = new Map(collectFactItems(loadContent(figureId)).map((factItem) => [factItem.id, factItem]));
  const review = refreshSnapshots(loadReview(figureId), [...items.values()]);
  const problems = [];
  for (const result of results) {
    const factItem = items.get(result.item);
    if (!factItem) {
      problems.push(`없는 항목: ${result.item}`);
      continue;
    }
    if (!VERDICTS[result.verdict]) {
      problems.push(`[${result.item}] verdict는 ${Object.keys(VERDICTS).join("·")} 중 하나여야 한다`);
      continue;
    }
    review.items[result.item].factcheck = {
      verdict: result.verdict,
      source: result.source ?? null,
      url: result.url ?? null,
      excerpt: result.excerpt ?? null,
      translation: result.translation ?? null,
      note: result.note ?? "",
      checkedAt: new Date().toISOString(),
      hash: factItem.hash,
    };
  }
  writeJson(reviewPath(figureId), review);
  console.log(`${figureId}: 대조 결과 ${results.length - problems.length}개 기록`);
  for (const problem of problems) console.log(`  오류  ${problem}`);
  process.exitCode = problems.length ? 1 : 0;
}

function status(figureId) {
  const items = collectFactItems(loadContent(figureId));
  const review = loadReview(figureId);
  const tally = (statusOf) => items.reduce((counts, factItem) => {
    const key = statusOf(factItem, review);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const format = (counts) => Object.entries(counts).map(([key, count]) => `${STATUS_NAMES[key] ?? key} ${count}`).join(", ");
  console.log(`${figureId}: 사실 항목 ${items.length}개`);
  console.log(`  자동 대조: ${format(tally(factcheckStatus))}`);
  console.log(`  검수: ${format(tally(reviewStatus))}`);
}

const COMMANDS = { list, record, status };
const { positional, options } = readArgs(process.argv.slice(2));
const [command, figureId] = positional;
if (!COMMANDS[command] || !figureId || (command === "record" && !options.file)) {
  console.log("사용법: node tools/factcheck.mjs list <id> [--all] | record <id> --file 결과.json | status <id>");
  process.exitCode = 1;
} else {
  COMMANDS[command](figureId, options);
}
