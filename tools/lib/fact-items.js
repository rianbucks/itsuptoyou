import { createHash } from "node:crypto";

const FICTIONAL_PREFIXES = ["sample_", "dev_"];

export const FACT_KINDS = {
  prologue: "프롤로그",
  growthSituation: "성장 사건 상황",
  growthHistorical: "역사적 성향",
  nodeSituation: "역사 분기점 상황",
  historicalFragment: "역사대로 success 조각",
  historicalEnding: "실제 역사 결말",
  harm: "역사대로 선택지의 악영향",
  chronicle: "기록 서술",
  era: "시대 배경",
};

function formatYear(year) {
  return year < 0 ? `기원전 ${-year}년` : `${year}년`;
}

export function hashFact(text, sources) {
  return createHash("sha1").update(JSON.stringify({ text, sources })).digest("hex").slice(0, 16);
}

function item(kind, ref, label, text, sources, disputed) {
  return { id: `${kind}:${ref}`, kind, kindName: FACT_KINDS[kind], label, text, sources: sources ?? [], disputed: disputed ?? [], hash: hashFact(text, sources ?? []) };
}

function growthItems(growth) {
  return growth.flatMap((event) => {
    const historical = event.choices.find((choice) => choice.historical);
    return [
      item("growthSituation", event.id, `${formatYear(event.year)} ${event.title}`, event.situation, event.sources, event.disputed),
      item("growthHistorical", `${event.id}/${historical.id}`, `${formatYear(event.year)} ${event.title} — ${historical.label}`, historical.text, historical.sources),
      ...(historical.harm ? [item("harm", `${event.id}/${historical.id}`, `${formatYear(event.year)} ${event.title} — ${historical.label}`, historical.harm.text, historical.harm.sources, historical.harm.disputed)] : []),
    ];
  });
}

function nodeItems(nodes, fragmentIndex) {
  return nodes.filter((node) => node.kind === "historical").flatMap((node) => {
    const historical = node.choices.find((choice) => choice.historical);
    const fragment = fragmentIndex.get(historical.success.fragment);
    return [
      item("nodeSituation", node.id, `${formatYear(node.year)} ${node.title}`, node.situation, node.sources, node.disputed),
      ...(fragment ? [item("historicalFragment", fragment.id, `${formatYear(node.year)} ${node.title} — ${historical.label} (성공)`, fragment.text, fragment.sources, fragment.disputed)] : []),
      ...(historical.harm ? [item("harm", `${node.id}/${historical.id}`, `${formatYear(node.year)} ${node.title} — ${historical.label}`, historical.harm.text, historical.harm.sources, historical.harm.disputed)] : []),
    ];
  });
}

export function collectFactItems(bundle) {
  const fragmentIndex = new Map(bundle.fragments.map((fragment) => [fragment.id, fragment]));
  const historicalEnding = bundle.endings.find((ending) => ending.kind === "historical");
  return [
    item("prologue", bundle.figure.id, `${formatYear(bundle.figure.born)} 출생`, bundle.figure.prologue.text, bundle.figure.prologue.sources, bundle.figure.disputed),
    ...growthItems(bundle.growth),
    ...nodeItems(bundle.nodes, fragmentIndex),
    ...(historicalEnding ? [item("historicalEnding", historicalEnding.id, `2026년 — ${historicalEnding.cardTitle}`, historicalEnding.text, historicalEnding.sources, historicalEnding.disputed)] : []),
    ...bundle.chronicle.map((entry) => item("chronicle", entry.id, `${formatYear(entry.year)} 기록 서술`, entry.text, entry.sources, entry.disputed)),
    ...bundle.era.map((entry) => item("era", entry.id, `${formatYear(entry.year)} 시대 배경`, entry.text, entry.sources, entry.disputed)),
  ];
}

export function isFictionalFigure(figureId) {
  return FICTIONAL_PREFIXES.some((prefix) => figureId.startsWith(prefix));
}

export function reviewStatus(factItem, review) {
  const entry = review?.items?.[factItem.id];
  const decision = entry?.decision;
  if (!decision) return "pending";
  if (decision.hash !== factItem.hash) return "stale";
  return decision.status;
}

export function factcheckStatus(factItem, review) {
  const factcheck = review?.items?.[factItem.id]?.factcheck;
  if (!factcheck) return "unchecked";
  if (factcheck.hash !== factItem.hash) return "stale";
  return factcheck.verdict;
}
