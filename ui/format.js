import { store } from "./store.js";

export function formatYear(year) {
  return year < 0 ? `기원전 ${-year}년` : `${year}년`;
}

export function formatPercent(probability) {
  return `${Math.round(probability * 100)}%`;
}

export function traitName(traitId) {
  return store.content.traitIndex[traitId]?.name ?? traitId;
}
