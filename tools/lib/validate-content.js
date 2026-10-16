import { assembleContent } from "../../engine/content.js";
import { computeHistoryMatch } from "../../engine/purity.js";
import { validateAgainstSchema } from "./json-schema.js";

const RESERVED_FLAGS = ["deviated", "outlived", "extraYears"];
const LIFE_FLAG_PREFIX = "life_";
const MAX_JUDGEMENT_NODES = 13;
const WEIGHT_TOLERANCE = 1e-9;
const PURITY_RUNS = 1000;

function schemaErrors(label, value, schemaName, schemas) {
  return validateAgainstSchema(schemaName, value, schemas).map((message) => `${label} ${message}`);
}

function repeatedIds(items) {
  const seen = new Set();
  return items.map((item) => item.id).filter((id) => {
    const repeated = seen.has(id);
    seen.add(id);
    return repeated;
  });
}

function outcomesOf(nodes) {
  return nodes.flatMap((node) => node.choices.flatMap((choice) => [
    { node, choice, result: "success", outcome: choice.success },
    { node, choice, result: "failure", outcome: choice.failure },
  ]));
}

function eventChoices(bundle) {
  return bundle.events.flatMap((event) => event.choices);
}

function allEffects(bundle) {
  const outcomes = outcomesOf(bundle.nodes).map(({ outcome }) => outcome);
  const growthChoices = bundle.growth.flatMap((event) => event.choices);
  return [...outcomes, ...growthChoices, ...eventChoices(bundle)];
}

function allChecks(nodes) {
  return nodes.flatMap((node) => node.choices.map((choice) => ({ node, choice, check: choice.check })));
}

function schemaProblems(bundle, schemas) {
  const { folder, figure } = bundle;
  const collections = [
    ["growth.json", bundle.growth, "growth.schema.json"],
    ["nodes.json", bundle.nodes, "node.schema.json"],
    ["fragments.json", bundle.fragments, "fragment.schema.json"],
    ["endings.json", bundle.endings, "ending.schema.json"],
    ["events.json", bundle.events, "common-event.schema.json"],
  ];
  return [
    ...schemaErrors(`[${folder}/figure.json]`, figure, "figure.schema.json", schemas),
    ...collections.flatMap(([file, items, schemaName]) =>
      items.flatMap((item) => schemaErrors(`[${folder}/${file} ${item.id}]`, item, schemaName, schemas))),
  ];
}

function ownershipProblems(bundle) {
  const folderProblem = bundle.figure.id === bundle.folder ? [] : [`[${bundle.folder}] figure.id(${bundle.figure.id})가 폴더 이름과 다르다`];
  const entities = [...bundle.growth, ...bundle.nodes, ...bundle.endings, ...bundle.events];
  return [
    ...folderProblem,
    ...entities.filter((item) => item.figure !== bundle.figure.id).map((item) => `[${item.id}] figure 값이 ${bundle.figure.id}가 아니다`),
  ];
}

function duplicateProblems(bundle) {
  const collections = {
    "growth.json": bundle.growth,
    "nodes.json": bundle.nodes,
    "fragments.json": bundle.fragments,
    "endings.json": bundle.endings,
    "events.json": bundle.events,
  };
  const collectionProblems = Object.entries(collections).flatMap(([file, items]) => repeatedIds(items).map((id) => `[${file}] id ${id}가 중복된다`));
  const traitProblems = repeatedIds([...bundle.commonTraits, ...bundle.figure.traits]).map((id) => `[traits] 특성 id ${id}가 공통 특성과 인물 특성에서 중복된다`);
  return [...collectionProblems, ...traitProblems];
}

function traitReferences(bundle) {
  const checks = allChecks(bundle.nodes).map(({ check }) => check);
  return [
    ...bundle.figure.initialTraits.map((trait) => trait.id),
    ...allEffects(bundle).flatMap((effect) => [...(effect.addTraits ?? []), ...(effect.removeTraits ?? [])]),
    ...checks.flatMap((check) => Object.keys(check.traitBonus ?? {})),
  ];
}

function traitProblems(bundle) {
  const traitIds = new Set([...bundle.commonTraits, ...bundle.figure.traits].map((trait) => trait.id));
  return traitReferences(bundle).filter((id) => !traitIds.has(id)).map((id) => `없는 특성 참조: ${id}`);
}

function replacesProblems(bundle) {
  const nodeIds = new Set(bundle.nodes.map((node) => node.id));
  return bundle.nodes
    .filter((node) => node.replaces && !nodeIds.has(node.replaces))
    .map((node) => `[${node.id}] replaces 대상 ${node.replaces}이(가) 없다`);
}

function matchesLocation(fragment, ref) {
  return fragment.node === ref.node && fragment.choice === ref.choice && fragment.result === ref.result;
}

function fragmentProblems(bundle) {
  const fragmentIndex = new Map(bundle.fragments.map((fragment) => [fragment.id, fragment]));
  const refs = outcomesOf(bundle.nodes).map(({ node, choice, result, outcome }) => ({
    id: outcome.fragment,
    node: node.id,
    choice: choice.id,
    result,
  }));
  const missing = refs.filter((ref) => !fragmentIndex.has(ref.id)).map((ref) => `없는 결과 조각 참조: ${ref.id}`);
  const misplaced = refs
    .filter((ref) => fragmentIndex.has(ref.id) && !matchesLocation(fragmentIndex.get(ref.id), ref))
    .map((ref) => `결과 조각 ${ref.id}의 위치(노드·선택지·결과)가 참조한 자리와 다르다`);
  const counts = new Map();
  for (const ref of refs) counts.set(ref.id, (counts.get(ref.id) ?? 0) + 1);
  const unused = bundle.fragments
    .filter((fragment) => counts.get(fragment.id) !== 1)
    .map((fragment) => `결과 조각 ${fragment.id}은(는) 선택지에서 한 번만 참조되어야 한다 (현재 ${counts.get(fragment.id) ?? 0}회)`);
  return [...missing, ...misplaced, ...unused];
}

function weightProblems(bundle) {
  return allChecks(bundle.nodes)
    .filter(({ check }) => Math.abs(Object.values(check.stats).reduce((sum, weight) => sum + weight, 0) - 1) > WEIGHT_TOLERANCE)
    .map(({ node, choice }) => `[${node.id}/${choice.id}] 능력치 가중치 합이 1이 아니다`);
}

function recordedFlagReaders(bundle) {
  return [
    ...bundle.nodes.map((node) => ({ where: node.id, flags: Object.keys(node.requires?.flags ?? {}) })),
    ...bundle.growth.map((event) => ({ where: event.id, flags: Object.keys(event.requires?.flags ?? {}) })),
    ...bundle.endings.map((ending) => ({ where: ending.id, flags: Object.values(ending.conditions ?? {}).flatMap((group) => Object.keys(group)) })),
  ];
}

function eventFlagReaders(bundle) {
  return bundle.events.map((event) => ({ where: event.id, flags: Object.keys(event.requires?.flags ?? {}) }));
}

function readFlags(bundle) {
  return new Set([...recordedFlagReaders(bundle), ...eventFlagReaders(bundle)].flatMap((reader) => reader.flags));
}

function producedFlags(bundle) {
  return new Set(allEffects(bundle).flatMap((effect) => Object.keys(effect.setFlags ?? {})));
}

function unsetFlagErrors(bundle) {
  const produced = producedFlags(bundle);
  return [...readFlags(bundle)]
    .filter((flag) => !RESERVED_FLAGS.includes(flag) && !produced.has(flag))
    .map((flag) => `플래그 ${flag}을(를) 읽지만 설정하는 setFlags가 없다`);
}

function unreadFlagWarnings(bundle) {
  const read = readFlags(bundle);
  return [...producedFlags(bundle)]
    .filter((flag) => !RESERVED_FLAGS.includes(flag) && !read.has(flag))
    .map((flag) => `플래그 ${flag}을(를) 설정하지만 조건·requires 어디에서도 읽지 않는다`);
}

function lifeFlagProblems(bundle) {
  return recordedFlagReaders(bundle).flatMap(({ where, flags }) => flags
    .filter((flag) => flag.startsWith(LIFE_FLAG_PREFIX))
    .map((flag) => `[${where}] ${LIFE_FLAG_PREFIX} 플래그 ${flag}는 공통 이벤트 requires에서만 읽을 수 있다`));
}

function eventAgeProblems(bundle) {
  const limit = bundle.rules.survival.maxAge;
  return bundle.events.flatMap((event) => [
    ...(event.ageMin <= event.ageMax ? [] : [`[${event.id}] ageMin(${event.ageMin})이 ageMax(${event.ageMax})보다 크다`]),
    ...(event.ageMax <= limit ? [] : [`[${event.id}] ageMax(${event.ageMax})가 최대 나이(${limit}세)를 넘는다`]),
  ]);
}

function eventAgeWarnings(bundle) {
  return bundle.events
    .filter((event) => event.ageMin < 1)
    .map((event) => `[${event.id}] 0세(출생 연도)에는 공통 이벤트를 추첨하지 않는다`);
}

function fixedEventYearProblems(bundle) {
  const { born } = bundle.figure;
  return [...bundle.growth, ...bundle.nodes]
    .filter((item) => item.year <= born)
    .map((item) => `[${item.id}] 고정 사건은 출생 연도(${born}년) 다음 해부터 처리된다`);
}

function endingProblems(bundle) {
  const historical = bundle.endings.filter((ending) => ending.kind === "historical").length;
  const defaults = bundle.endings.filter((ending) => ending.isDefault).length;
  return [
    ...(historical === 1 ? [] : [`실제 역사 결말은 1개여야 한다 (현재 ${historical}개)`]),
    ...(defaults === 1 ? [] : [`기본 결말은 1개여야 한다 (현재 ${defaults}개)`]),
  ];
}

function historicalNodeYearProblems(bundle) {
  return bundle.nodes
    .filter((node) => node.kind === "historical" && node.year > bundle.figure.died)
    .map((node) => `[${node.id}] 역사 분기점이 사망 연도(${bundle.figure.died}년) 이후다`);
}

function growthYearWarnings(bundle) {
  return bundle.growth
    .filter((event) => event.year > bundle.figure.died)
    .map((event) => `[${event.id}] 사망 연도 이후의 성장 사건이라 도달하지 못한다`);
}

function formatPercent(probability) {
  return `${(probability * 100).toFixed(1)}%`;
}

function purityCheck(bundle) {
  const content = assembleContent(bundle);
  const match = computeHistoryMatch(content, { runs: PURITY_RUNS });
  const statNames = Object.fromEntries(bundle.stats.map((stat) => [stat.id, stat.name]));
  const { targetMin, targetMax, focusMax } = bundle.rules.historyMatch;
  const [bestStat, bestValue] = Object.entries(match.byFocus).reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  const warnings = [];
  if (match.average < targetMin || match.average > targetMax) warnings.push(`역사 일치 확률 평균 ${formatPercent(match.average)}가 ${formatPercent(targetMin)}~${formatPercent(targetMax)} 범위를 벗어난다`);
  if (bestValue > focusMax) warnings.push(`초점을 ${statNames[bestStat]}에 고정하면 역사 일치 확률이 ${formatPercent(bestValue)}로 상한 ${formatPercent(focusMax)}를 넘는다`);
  if (match.judgementNodes > MAX_JUDGEMENT_NODES) warnings.push(`순수 역사 경로의 판정 노드가 ${match.judgementNodes}개다 (13개 이하여야 한다)`);
  const byFocus = Object.entries(match.byFocus).map(([stat, value]) => `${statNames[stat]} ${formatPercent(value)}`).join(", ");
  const details = [
    `초점 고정: ${byFocus}`,
    ...match.nodes.map((row) => `${row.title}: 평균 점수 ${row.score.toFixed(1)} / 난이도 ${row.difficulty} → 평균 ${formatPercent(row.probability)}`),
  ];
  return { warnings, summary: `역사 일치 확률 평균 ${formatPercent(match.average)} (초점·공통 이벤트 무작위 ${match.runs}판, 판정 노드 ${match.judgementNodes}개)`, details };
}

function validateRules(rules) {
  const problems = [];
  if (!(rules.judgement.k > 0)) problems.push("judgement.k는 0보다 커야 한다");
  if (rules.judgement.minProbability >= rules.judgement.maxProbability) problems.push("판정 상하한이 뒤집혀 있다");
  if (!(rules.survival.referenceYears > 0)) problems.push("survival.referenceYears는 0보다 커야 한다");
  if (rules.focus.ageMin > rules.focus.ageMax) problems.push("focus.ageMin이 focus.ageMax보다 크다");
  if (!(rules.commonEvents.chance >= 0 && rules.commonEvents.chance <= 1)) problems.push("commonEvents.chance는 0~1이어야 한다");
  if (!(rules.timeline.secondsPerYear > 0)) problems.push("timeline.secondsPerYear는 0보다 커야 한다");
  if (!rules.timeline.speeds.length || rules.timeline.speeds.some((speed) => !(speed > 0))) problems.push("timeline.speeds는 0보다 큰 값의 목록이어야 한다");
  const { targetMin, targetMax, focusMax } = rules.historyMatch ?? {};
  if (!(targetMin >= 0 && targetMin < targetMax && targetMax <= focusMax && focusMax <= 1)) problems.push("historyMatch는 0 ≤ targetMin < targetMax ≤ focusMax ≤ 1이어야 한다");
  return problems.map((problem) => `[common/rules.json] ${problem}`);
}

export function validateCommon({ stats, commonTraits, rules }, schemas) {
  const errors = [
    ...commonTraits.flatMap((trait) => schemaErrors(`[common/traits.json ${trait.id}]`, trait, "trait.schema.json", schemas)),
    ...stats.flatMap((stat) => schemaErrors(`[common/stats.json ${stat.id}]`, stat.id, "stat-id.schema.json", schemas)),
    ...schemaErrors("[common/rules.json survival.stat]", rules.survival.stat, "stat-id.schema.json", schemas),
    ...repeatedIds(commonTraits).map((id) => `[common/traits.json] 특성 id ${id}가 중복된다`),
    ...validateRules(rules),
  ];
  return { errors, warnings: [], summary: "공통 데이터 (common/)" };
}

export function validateFigure(bundle, schemas) {
  const schemaFailures = schemaProblems(bundle, schemas);
  if (schemaFailures.length) {
    return { errors: schemaFailures, warnings: [], summary: `${bundle.folder}: 스키마 오류가 있어 나머지 검사를 건너뛴다`, details: [] };
  }
  const errors = [
    ...ownershipProblems(bundle),
    ...duplicateProblems(bundle),
    ...traitProblems(bundle),
    ...replacesProblems(bundle),
    ...fragmentProblems(bundle),
    ...weightProblems(bundle),
    ...unsetFlagErrors(bundle),
    ...lifeFlagProblems(bundle),
    ...eventAgeProblems(bundle),
    ...fixedEventYearProblems(bundle),
    ...endingProblems(bundle),
    ...historicalNodeYearProblems(bundle),
  ];
  if (errors.length) {
    return { errors, warnings: [], summary: `${bundle.folder}: 오류가 있어 역사 일치 확률 계산을 건너뛴다`, details: [] };
  }
  const purity = purityCheck(bundle);
  return {
    errors,
    warnings: [...growthYearWarnings(bundle), ...eventAgeWarnings(bundle), ...unreadFlagWarnings(bundle), ...purity.warnings],
    summary: `${bundle.folder}: ${purity.summary}`,
    details: purity.details,
  };
}
