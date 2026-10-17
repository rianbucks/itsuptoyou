import { playHistoricalPath } from "../engine/purity.js";
import { loadContent } from "./lib/load-content.js";
import { playRandomly } from "./lib/play.js";
import { pipelinePath, readArgs, readJsonIfExists, writeJson, writeText } from "./lib/pipeline-files.js";

const RESERVED_FLAGS = ["deviated", "outlived", "extraYears"];
const DEFAULT_RUNS = 2000;
const HISTORICAL_RUNS = 50;
const WILDCARD = "*";
const DESIGN = "design";
const VARIABILITY_RANK = { no: 0, design: 1, yes: 2 };

function growthOutcomes(content) {
  return content.growth.flatMap((event) => event.choices.map((choice) => ({
    key: `growth:${event.id}/${choice.id}`,
    event: event.id,
    year: event.year,
    label: `${event.title} — ${choice.label}`,
    deviates: !choice.historical,
    setFlags: choice.setFlags ?? {},
  })));
}

function nodeOutcomes(content) {
  return content.nodes.flatMap((node) => node.choices.flatMap((choice) => ["success", "failure"].map((result) => ({
    key: `node:${node.id}/${choice.id}/${result}`,
    event: node.id,
    year: node.year,
    label: `${node.title} — ${choice.label} (${result === "success" ? "성공" : "실패"})`,
    deviates: !(choice.historical && result === "success"),
    setFlags: choice[result].setFlags ?? {},
  }))));
}

function fixedEventRanks(content) {
  const ranks = new Map();
  const perYear = new Map();
  for (const event of [...content.growth, ...content.nodes]) {
    const rank = perYear.get(event.year) ?? 0;
    ranks.set(event.id, rank);
    perYear.set(event.year, rank + 1);
  }
  return ranks;
}

function canBeSkipped(eventId, content) {
  const event = content.nodeIndex[eventId] ?? content.growthIndex[eventId];
  const hasFlagRequirement = Object.keys(event?.requires?.flags ?? {}).length > 0;
  return hasFlagRequirement || content.nodes.some((node) => node.replaces === eventId);
}

function precedes(outcome, item, ranks, anchorProcessed = true) {
  if (outcome.year < item.year) return true;
  if (outcome.year > item.year || !item.after) return false;
  if (!anchorProcessed) return true;
  return ranks.get(outcome.event) <= ranks.get(item.after);
}

function mayPrecede(outcome, item, ranks, content) {
  if (precedes(outcome, item, ranks)) return true;
  return Boolean(item.after) && outcome.year === item.year && canBeSkipped(item.after, content);
}

function anchorProcessed(state, item) {
  return state.growthHistory.some((entry) => entry.year === item.year && entry.event === item.after)
    || state.history.some((entry) => entry.year === item.year && entry.node === item.after);
}

function narrationItems(content) {
  return ["chronicle", "era"].flatMap((kind) => content[kind].map((item) => ({ ...item, kind, key: `${kind}:${item.id}` })));
}

function occurredOutcomes(state, content) {
  const growth = state.growthHistory.map((entry) => `growth:${entry.event}/${entry.choice}`);
  const nodes = state.history.map((entry) => `node:${entry.node}/${entry.choice}/${entry.result}`);
  return new Set([...growth, ...nodes]);
}

function wasShown(state, item) {
  return state.narrationHistory.some((entry) => entry.kind === item.kind && entry.id === item.id);
}

function simulatePairs(content, items, outcomes, runs, ranks) {
  const stats = new Map();
  for (let seed = 0; seed < runs; seed++) {
    const { state } = playRandomly(content, seed).session;
    const occurred = occurredOutcomes(state, content);
    for (const item of items) {
      if (state.year < item.year) continue;
      const shown = wasShown(state, item);
      const processed = !item.after || anchorProcessed(state, item);
      for (const outcome of outcomes) {
        if (!occurred.has(outcome.key) || !precedes(outcome, item, ranks, processed)) continue;
        const key = `${item.key}|${outcome.key}`;
        const entry = stats.get(key) ?? { occurred: 0, shown: 0 };
        entry.occurred += 1;
        if (shown) entry.shown += 1;
        stats.set(key, entry);
      }
    }
  }
  return stats;
}

function hiddenOnHistoricalPath(content, items) {
  const shownSomewhere = new Set();
  for (let seed = 0; seed < HISTORICAL_RUNS; seed++) {
    const { state } = playHistoricalPath(content, seed).session;
    for (const item of items) if (wasShown(state, item)) shownSomewhere.add(item.key);
  }
  return items.filter((item) => item.year <= content.figure.died && !shownSomewhere.has(item.key));
}

function formatYear(year) {
  return year < 0 ? `기원전 ${-year}년` : `${year}년`;
}

function placeName(item) {
  return item.after ? `${formatYear(item.year)} ${item.after} 뒤` : `${formatYear(item.year)} 첫머리`;
}

function flagOrderProblems(content, items, outcomes, ranks) {
  return items.flatMap((item) => Object.keys(item.requires?.flags ?? {})
    .filter((flag) => !RESERVED_FLAGS.includes(flag))
    .filter((flag) => !outcomes.some((setter) => precedes(setter, item, ranks) && flag in setter.setFlags))
    .map((flag) => `[${item.key}] requires의 플래그 ${flag}를 ${placeName(item)}보다 앞서 설정하는 결과가 없다`));
}

function judgmentFor(judgments, item, outcome) {
  return judgments.find((entry) => entry.item === item.key && entry.outcome === outcome.key)
    ?? judgments.find((entry) => entry.item === item.key && entry.outcome === WILDCARD)
    ?? null;
}

function eraRowsFor(item, timeline, trace) {
  const rowIds = trace[item.key] ?? [];
  return (timeline?.eraRows ?? []).filter((row) => rowIds.includes(row.id) || (row.ref && rowIds.includes(row.ref)));
}

function strongestVariability(rows) {
  return rows.reduce((best, row) => (VARIABILITY_RANK[row.variability] > (VARIABILITY_RANK[best?.variability] ?? -1) ? row : best), null);
}

function hasRequires(item) {
  return Object.keys(item.requires?.flags ?? {}).length > 0;
}

function sectionProblems(item, rows, died) {
  const problems = [];
  if (rows.some((row) => row.section === "after") && item.year <= died) problems.push(`[${item.key}] 기록 이후 시대 배경 후보(③)는 원래 사망 연도(${died}) 뒤의 era에만 쓴다`);
  if (item.kind === "era" && item.year > died && rows.length && !rows.some((row) => row.section === "after")) problems.push(`[${item.key}] 원래 사망 연도 뒤의 era는 기록 이후 시대 배경 후보(③)에서 가져와야 한다`);
  return problems;
}

function extensionProblems(item, row, died) {
  if (item.kind !== "era" || item.year <= died || !row || row.variability === "no") return [];
  return [`[${item.key}] 연장 구간 era는 '달라질 수 있는지: 아니오' 사건만 쓴다 (GDD §4.6). ${row.id}는 '${row.variabilityText}'`];
}

function variabilityProblems(item, row, judgments) {
  if (!row || row.variability === "no") return { errors: [], pending: [] };
  const label = `${row.id} '달라질 수 있는지: ${row.variabilityText}'`;
  if (row.variability === "yes") {
    return { errors: hasRequires(item) ? [] : [`[${item.key}] ${label}인데 requires가 없다`], pending: [] };
  }
  const judgment = judgments.find((entry) => entry.item === item.key && entry.outcome === DESIGN);
  if (!judgment) return { errors: [], pending: [`${item.key} × 설계 판단(${row.id})`] };
  if (judgment.conflict && !hasRequires(item)) return { errors: [`[${item.key}] ${label}이고 해당 주제의 노드·플래그가 있다고 판단했는데 requires가 없다 (${judgment.reason})`], pending: [] };
  return { errors: [], pending: [] };
}

function timelineRules(content, items, judgments, timeline, trace) {
  const result = { errors: [], warnings: [], pending: [], checked: { yes: 0, design: 0 } };
  if (!timeline?.eraRows?.length) return result;
  for (const item of items.filter((candidate) => candidate.kind === "era")) {
    const rows = eraRowsFor(item, timeline, trace);
    if (!(trace[item.key] ?? []).length) result.warnings.push(`[${item.key}] trace.json에 근거 행이 없어 '달라질 수 있는지'를 점검하지 못했다`);
    result.errors.push(...sectionProblems(item, rows, content.figure.died));
    const row = strongestVariability(rows);
    result.errors.push(...extensionProblems(item, row, content.figure.died));
    if (row && row.variability !== "no") result.checked[row.variability] += 1;
    const { errors, pending } = variabilityProblems(item, row, judgments);
    result.errors.push(...errors);
    result.pending.push(...pending);
  }
  return result;
}

function excerpt(text, length = 40) {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function buildReport(content, items, outcomes, stats, judgments, ranks) {
  const errors = [];
  const warnings = [];
  const unjudged = [];
  const rows = [];
  for (const item of items) {
    for (const outcome of outcomes.filter((candidate) => candidate.deviates && mayPrecede(candidate, item, ranks, content))) {
      const judgment = judgmentFor(judgments, item, outcome);
      const stat = stats.get(`${item.key}|${outcome.key}`) ?? { occurred: 0, shown: 0 };
      if (!judgment) {
        unjudged.push(`${item.key} × ${outcome.key}`);
        continue;
      }
      if (judgment.conflict && stat.shown > 0) errors.push(`[${item.key}] '${outcome.label}' 뒤에도 ${stat.shown}/${stat.occurred}판에서 보인다 (충돌로 판단됨: ${judgment.reason})`);
      if (!judgment.conflict && stat.occurred > 0 && stat.shown === 0) warnings.push(`[${item.key}] 충돌이 아니라고 판단한 '${outcome.label}' 뒤에 늘 숨겨진다`);
      if (judgment.conflict) rows.push({ item, outcome, judgment, stat });
    }
  }
  return { errors, warnings, unjudged, rows };
}

function markdown(content, items, report) {
  const lines = [
    `# ${content.figure.name} 기록 서술·시대 배경 충돌 점검`,
    "",
    "| 항목 | 자리 | 문장 | requires | 충돌하는 결과 | 이유 | 시뮬레이션(발생→보임) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const item of items) {
    const conflicts = report.rows.filter((row) => row.item.key === item.key);
    const requires = JSON.stringify(item.requires?.flags ?? {});
    if (!conflicts.length) lines.push(`| ${item.key} | ${placeName(item)} | ${excerpt(item.text)} | ${requires} | 없음 | | |`);
    for (const row of conflicts) lines.push(`| ${item.key} | ${placeName(item)} | ${excerpt(item.text)} | ${requires} | ${row.outcome.label} | ${row.judgment.reason} | ${row.stat.occurred}→${row.stat.shown} |`);
  }
  return `${lines.join("\n")}\n`;
}

const { positional, options } = readArgs(process.argv.slice(2));
const [figureId] = positional;
if (!figureId) {
  console.log("사용법: node tools/check-conflicts.mjs <인물 id> [--runs N]");
  process.exit(1);
}

const content = loadContent(figureId);
const items = narrationItems(content);
const outcomes = [...growthOutcomes(content), ...nodeOutcomes(content)];
const judgments = readJsonIfExists(pipelinePath(figureId, "conflicts.json"), { judgments: [] }).judgments;
const timeline = readJsonIfExists(pipelinePath(figureId, "timeline.json"), null);
const trace = readJsonIfExists(pipelinePath(figureId, "trace.json"), {});
const ranks = fixedEventRanks(content);
const stats = simulatePairs(content, items, outcomes, Number(options.runs ?? DEFAULT_RUNS), ranks);
const report = buildReport(content, items, outcomes, stats, judgments, ranks);
const hidden = hiddenOnHistoricalPath(content, items).map((item) => `[${item.key}] 역사대로만 진행해도 보이지 않는다 (requires 확인)`);
const orderProblems = flagOrderProblems(content, items, outcomes, ranks);
const rules = timelineRules(content, items, judgments, timeline, trace);
const errors = [...report.errors, ...hidden, ...orderProblems, ...rules.errors];
const unjudged = [...report.unjudged, ...rules.pending];

writeJson(pipelinePath(figureId, "conflict-candidates.json"), {
  items: items.map((item) => ({ key: item.key, year: item.year, after: item.after ?? null, text: item.text, requires: item.requires ?? null })),
  outcomes: outcomes.filter((outcome) => outcome.deviates).map(({ key, year, label, setFlags }) => ({ key, year, label, setFlags })),
});
writeText(pipelinePath(figureId, "conflicts.md"), markdown(content, items, report));

console.log(`${figureId}: 기록 서술·시대 배경 ${items.length}개, 일탈 결과 ${outcomes.filter((outcome) => outcome.deviates).length}개`);
console.log(`  판단이 없는 짝 ${unjudged.length}개${unjudged.length ? ` (conflicts.json에 판단을 추가한다. 예: ${unjudged.slice(0, 3).join(", ")})` : ""}`);
if (timeline?.eraRows?.length) console.log(`  연표의 '달라질 수 있는지': 예 ${rules.checked.yes}개, 설계에 따라 ${rules.checked.design}개 점검`);
for (const message of errors) console.log(`  오류  ${message}`);
for (const message of [...report.warnings, ...rules.warnings]) console.log(`  경고  ${message}`);
process.exitCode = errors.length || unjudged.length ? 1 : 0;
