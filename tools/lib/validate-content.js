import { assembleContent } from "../../engine/content.js";
import { computePureHistoryPath } from "../../engine/purity.js";
import { validateAgainstSchema } from "./json-schema.js";

const RESERVED_FLAGS = ["deviated", "outlived", "extraYears"];
const PURITY_RANGE = { min: 0.45, max: 0.55 };
const MAX_JUDGEMENT_NODES = 13;
const WEIGHT_TOLERANCE = 1e-9;

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

function allEffects(bundle) {
  const outcomes = outcomesOf(bundle.nodes).map(({ outcome }) => outcome);
  const growthChoices = bundle.growth.flatMap((event) => event.choices);
  return [...outcomes, ...growthChoices];
}

function allChecks(nodes) {
  return nodes.flatMap((node) => node.choices.map((choice) => ({ node, choice, check: choice.check })));
}

function schemaProblems(bundle, schemas) {
  const { folder, figure } = bundle;
  return [
    ...schemaErrors(`[${folder}/figure.json]`, figure, "figure.schema.json", schemas),
    ...bundle.growth.flatMap((event) => schemaErrors(`[${folder}/growth.json ${event.id}]`, event, "growth.schema.json", schemas)),
    ...bundle.nodes.flatMap((node) => schemaErrors(`[${folder}/nodes.json ${node.id}]`, node, "node.schema.json", schemas)),
    ...bundle.fragments.flatMap((fragment) => schemaErrors(`[${folder}/fragments.json ${fragment.id}]`, fragment, "fragment.schema.json", schemas)),
    ...bundle.endings.flatMap((ending) => schemaErrors(`[${folder}/endings.json ${ending.id}]`, ending, "ending.schema.json", schemas)),
  ];
}

function ownershipProblems(bundle) {
  const folderProblem = bundle.figure.id === bundle.folder ? [] : [`[${bundle.folder}] figure.id(${bundle.figure.id})가 폴더 이름과 다르다`];
  const entities = [...bundle.growth, ...bundle.nodes, ...bundle.endings];
  return [
    ...folderProblem,
    ...entities.filter((item) => item.figure !== bundle.figure.id).map((item) => `[${item.id}] figure 값이 ${bundle.figure.id}가 아니다`),
  ];
}

function duplicateProblems(bundle) {
  const collections = { "growth.json": bundle.growth, "nodes.json": bundle.nodes, "fragments.json": bundle.fragments, "endings.json": bundle.endings };
  const collectionProblems = Object.entries(collections).flatMap(([file, items]) => repeatedIds(items).map((id) => `[${file}] id ${id}가 중복된다`));
  const traitProblems = repeatedIds([...bundle.commonTraits, ...bundle.figure.traits]).map((id) => `[traits] 특성 id ${id}가 공통 특성과 인물 특성에서 중복된다`);
  return [...collectionProblems, ...traitProblems];
}

function traitReferences(bundle) {
  const effects = allEffects(bundle);
  const checks = allChecks(bundle.nodes).map(({ check }) => check);
  return [
    ...bundle.figure.initialTraits.map((trait) => trait.id),
    ...effects.flatMap((effect) => [...(effect.addTraits ?? []), ...(effect.removeTraits ?? [])]),
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

function flagReferences(bundle) {
  const fromRequires = [...bundle.nodes, ...bundle.growth].flatMap((item) => Object.keys(item.requires?.flags ?? {}));
  const fromConditions = bundle.endings.flatMap((ending) => Object.values(ending.conditions ?? {}).flatMap((group) => Object.keys(group)));
  return [...fromRequires, ...fromConditions];
}

function producedFlags(bundle) {
  return new Set(allEffects(bundle).flatMap((effect) => Object.keys(effect.setFlags ?? {})));
}

function unsetFlagErrors(bundle) {
  const produced = producedFlags(bundle);
  return [...new Set(flagReferences(bundle))]
    .filter((flag) => !RESERVED_FLAGS.includes(flag) && !produced.has(flag))
    .map((flag) => `플래그 ${flag}을(를) 읽지만 설정하는 setFlags가 없다`);
}

function unreadFlagWarnings(bundle) {
  const read = new Set(flagReferences(bundle));
  return [...producedFlags(bundle)]
    .filter((flag) => !RESERVED_FLAGS.includes(flag) && !read.has(flag))
    .map((flag) => `플래그 ${flag}을(를) 설정하지만 조건·requires 어디에서도 읽지 않는다`);
}

function endingProblems(bundle) {
  const historical = bundle.endings.filter((ending) => ending.kind === "historical").length;
  const defaults = bundle.endings.filter((ending) => ending.isDefault).length;
  return [
    ...(historical === 1 ? [] : [`실제 역사 결말은 1개여야 한다 (현재 ${historical}개)`]),
    ...(defaults === 1 ? [] : [`기본 결말은 1개여야 한다 (현재 ${defaults}개)`]),
  ];
}

function yearErrors(bundle) {
  return bundle.nodes
    .filter((node) => node.kind === "historical" && node.year > bundle.figure.died)
    .map((node) => `[${node.id}] 역사 분기점이 사망 연도(${bundle.figure.died}년) 이후다`);
}

function yearWarnings(bundle) {
  return bundle.growth
    .filter((event) => event.year > bundle.figure.died)
    .map((event) => `[${event.id}] 사망 연도 이후의 성장 사건이라 도달하지 못한다`);
}

function purityCheck(bundle) {
  const content = assembleContent({
    rules: bundle.rules,
    stats: bundle.stats,
    commonTraits: bundle.commonTraits,
    figure: bundle.figure,
    growth: bundle.growth,
    nodes: bundle.nodes,
    fragments: bundle.fragments,
    endings: bundle.endings,
  });
  const pure = computePureHistoryPath(content);
  const percent = (pure.product * 100).toFixed(1);
  const warnings = [];
  if (pure.product < PURITY_RANGE.min || pure.product > PURITY_RANGE.max) warnings.push(`순수 역사 경로 일치 확률 ${percent}%가 45~55% 범위를 벗어난다`);
  if (pure.rows.length > MAX_JUDGEMENT_NODES) warnings.push(`순수 역사 경로의 판정 노드가 ${pure.rows.length}개다 (13개 이하여야 한다)`);
  const details = pure.rows.map((row) => `${row.title}: 점수 ${row.score.toFixed(1)} / 난이도 ${row.difficulty} → ${(row.probability * 100).toFixed(1)}%`);
  return { warnings, summary: `순수 역사 경로 일치 확률 ${percent}% (판정 노드 ${pure.rows.length}개)`, details };
}

export function validateCommon({ stats, commonTraits, rules }, schemas) {
  const errors = [
    ...commonTraits.flatMap((trait) => schemaErrors(`[common/traits.json ${trait.id}]`, trait, "trait.schema.json", schemas)),
    ...stats.flatMap((stat) => schemaErrors(`[common/stats.json ${stat.id}]`, stat.id, "stat-id.schema.json", schemas)),
    ...schemaErrors("[common/rules.json survival.stat]", rules.survival.stat, "stat-id.schema.json", schemas),
    ...repeatedIds(commonTraits).map((id) => `[common/traits.json] 특성 id ${id}가 중복된다`),
  ];
  if (!(rules.judgement.k > 0)) errors.push("[common/rules.json] judgement.k는 0보다 커야 한다");
  if (rules.judgement.minProbability >= rules.judgement.maxProbability) errors.push("[common/rules.json] 판정 상하한이 뒤집혀 있다");
  if (!(rules.survival.interval > 0)) errors.push("[common/rules.json] survival.interval은 0보다 커야 한다");
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
    ...endingProblems(bundle),
    ...yearErrors(bundle),
  ];
  const purity = purityCheck(bundle);
  return {
    errors,
    warnings: [...yearWarnings(bundle), ...unreadFlagWarnings(bundle), ...purity.warnings],
    summary: `${bundle.folder}: ${purity.summary}`,
    details: purity.details,
  };
}
