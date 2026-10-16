import { store } from "./store.js";

export function formatYear(year) {
  return year < 0 ? `기원전 ${-year}년` : `${year}년`;
}

export function formatYearRange(from, to) {
  if (from === to) return formatYear(from);
  if (from < 0 && to < 0) return `기원전 ${-from}~${-to}년`;
  if (from > 0) return `${from}~${to}년`;
  return `${formatYear(from)}~${formatYear(to)}`;
}

export function formatPercent(probability) {
  return `${Math.round(probability * 100)}%`;
}

export function traitName(traitId) {
  return store.content.traitIndex[traitId]?.name ?? traitId;
}

export function statName(statId) {
  return store.content.stats.find((stat) => stat.id === statId)?.name ?? statId;
}
