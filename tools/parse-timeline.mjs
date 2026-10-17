import { readFileSync } from "node:fs";
import { pipelinePath, readArgs, timelinePath, writeJson } from "./lib/pipeline-files.js";
import { parseTimeline } from "./lib/timeline.js";

const { positional } = readArgs(process.argv.slice(2));
const [figureId] = positional;
if (!figureId) {
  console.log("사용법: node tools/parse-timeline.mjs <인물 id>");
  process.exit(1);
}

const timeline = parseTimeline(readFileSync(timelinePath(figureId), "utf8"), figureId);
writeJson(pipelinePath(figureId, "timeline.json"), timeline);

const usable = timeline.rows.filter((row) => row.usable).length;
const disputed = timeline.rows.filter((row) => row.disputed).length;
const undated = timeline.rows.filter((row) => row.undated).length;
console.log(`${timeline.name} (${figureId}) · ${timeline.born}~${timeline.died} · ${timeline.deathType} · 역법 ${timeline.calendar}`);
console.log(`  행 ${timeline.rows.length}개: 사실로 쓸 수 있음 ${usable}, 이견 ${disputed}, 연도 없음 ${undated}`);
console.log(`  이견 ${timeline.disputes.length}건, 출처 미확인 ${timeline.unconfirmed.length}건, 출생 연도 후보 ${timeline.birthYearEvents.length}건, 참고 링크 ${timeline.references.length}개`);
const USE_NAMES = { node: "노드", growth: "성장 사건", chronicle: "기록 서술", era: "시대 배경", exclude: "제외" };
const VARIABILITY_NAMES = { yes: "예", no: "아니오", design: "설계에 따라" };
function tally(rows, keyOf) {
  const counts = new Map();
  for (const row of rows) counts.set(keyOf(row), (counts.get(keyOf(row)) ?? 0) + 1);
  return counts;
}
const classified = timeline.rows.filter((row) => row.use);
if (classified.length) {
  const uses = [...tally(classified, (row) => row.use)].map(([use, count]) => `${USE_NAMES[use]} ${count}`).join(", ");
  console.log(`  용도 열: ${uses}${classified.length < timeline.rows.length ? `, 미분류 ${timeline.rows.length - classified.length}` : ""}`);
}
for (const [section, name] of [["during", "생애 중"], ["after", "기록 이후"]]) {
  const eraRows = timeline.eraRows.filter((row) => row.section === section);
  if (!eraRows.length) continue;
  const references = eraRows.filter((row) => row.ref).length;
  const variability = [...tally(eraRows, (row) => row.variability)].map(([key, count]) => `${VARIABILITY_NAMES[key] ?? "미기재"} ${count}`).join(", ");
  console.log(`  ${name} 시대 배경 후보 ${eraRows.length}행 (생애 연표 참조 ${references}): ${variability}`);
}
const lifeEraRows = timeline.rows.filter((row) => row.use === "era");
if (lifeEraRows.length) console.log(`  생애 연표에서 용도가 시대 배경인 행 ${lifeEraRows.length}개: ${lifeEraRows.map((row) => row.id).join(", ")}`);
for (const message of timeline.errors) console.log(`  오류  ${message}`);
for (const message of timeline.warnings) console.log(`  경고  ${message}`);
console.log(`→ ${pipelinePath(figureId, "timeline.json")}`);
process.exitCode = timeline.errors.length ? 1 : 0;
