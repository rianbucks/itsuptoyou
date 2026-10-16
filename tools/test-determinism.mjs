import { loadContent, loadSchemas, readFigureIds } from "./lib/load-content.js";
import { validateAgainstSchema } from "./lib/json-schema.js";
import { playRandomly, recordFrom, replay } from "./lib/play.js";

const SEEDS = 300;

function serialize(state) {
  return JSON.stringify(state);
}

const schemas = loadSchemas();
let failures = 0;

for (const figureId of readFigureIds()) {
  const content = loadContent(figureId);
  const counts = { runs: 0, mismatches: 0, schemaErrors: 0, focusChanges: 0, commonEvents: 0, survivalChecks: 0 };
  const firstProblems = [];
  for (let seed = 0; seed < SEEDS; seed++) {
    const first = playRandomly(content, seed).session.state;
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
    const schemaErrors = validateAgainstSchema("state.schema.json", first, schemas);
    if (schemaErrors.length) {
      counts.schemaErrors++;
      if (firstProblems.length < 3) firstProblems.push(`seed ${seed}: ${schemaErrors[0]}`);
    }
  }
  failures += counts.mismatches + counts.schemaErrors;
  console.log(`\n${figureId}: ${counts.runs}판`);
  console.log(`  재현 불일치 ${counts.mismatches}판, state.schema 위반 ${counts.schemaErrors}판`);
  console.log(`  입력 다양성: 초점 변경 ${counts.focusChanges}회, 공통 이벤트 ${counts.commonEvents}회, 생존 판정 ${counts.survivalChecks}회`);
  for (const problem of firstProblems) console.log(`  ${problem}`);
}

console.log(failures ? `\n실패 ${failures}건` : "\n모두 통과");
process.exitCode = failures ? 1 : 0;
