import { loadContent, loadSchemas, readFigureIds } from "./lib/load-content.js";
import { validateAgainstSchema } from "./lib/json-schema.js";
import { playRandomly, recordFrom, replay } from "./lib/play.js";
import { buildStoryLog } from "../ui/story-log.js";

const SEEDS = 300;

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

const schemas = loadSchemas();
let failures = 0;

for (const figureId of readFigureIds()) {
  const content = loadContent(figureId);
  const silent = withoutNarration(content);
  const counts = { runs: 0, mismatches: 0, logMismatches: 0, narrationLeaks: 0, schemaErrors: 0, focusChanges: 0, commonEvents: 0, survivalChecks: 0, logEntries: 0, narrations: 0 };
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
    counts.narrations += first.narrationHistory.length;
    if (judgementRecord(first) !== judgementRecord(playRandomly(silent, seed).session.state)) {
      counts.narrationLeaks++;
      if (firstProblems.length < 3) firstProblems.push(`seed ${seed}: 서술 파일을 비우면 판정 기록이 달라진다`);
    }
    const log = JSON.stringify(buildStoryLog(first, content));
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
  failures += counts.mismatches + counts.logMismatches + counts.narrationLeaks + counts.schemaErrors;
  console.log(`\n${figureId}: ${counts.runs}판`);
  console.log(`  재현 불일치 ${counts.mismatches}판, 스토리 로그 불일치 ${counts.logMismatches}판, state.schema 위반 ${counts.schemaErrors}판`);
  console.log(`  서술을 비운 판과 판정 기록이 다른 판 ${counts.narrationLeaks}판 (서술 평균 ${(counts.narrations / counts.runs).toFixed(1)}개)`);
  console.log(`  스토리 로그 평균 ${(counts.logEntries / counts.runs).toFixed(1)}항목`);
  console.log(`  입력 다양성: 초점 변경 ${counts.focusChanges}회, 공통 이벤트 ${counts.commonEvents}회, 생존 판정 ${counts.survivalChecks}회`);
  for (const problem of firstProblems) console.log(`  ${problem}`);
}

console.log(failures ? `\n실패 ${failures}건` : "\n모두 통과");
process.exitCode = failures ? 1 : 0;
