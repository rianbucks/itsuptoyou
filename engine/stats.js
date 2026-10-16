import { clamp } from "./math.js";

export function createInitialStats(content) {
  return Object.fromEntries(content.stats.map((stat) => [stat.id, content.rules.initialStat]));
}

export function effectiveStat(state, content, statId) {
  const modifierSum = state.traits.reduce((sum, traitId) => sum + (content.traitIndex[traitId]?.statModifiers?.[statId] ?? 0), 0);
  const { min, max } = content.rules.statRange;
  return clamp(state.stats[statId] + modifierSum, min, max);
}

export function computeScore(state, content, check) {
  const statPart = Object.entries(check.stats).reduce((sum, [statId, weight]) => sum + effectiveStat(state, content, statId) * weight, 0);
  const traitPart = Object.entries(check.traitBonus ?? {}).reduce((sum, [traitId, bonus]) => sum + (state.traits.includes(traitId) ? bonus : 0), 0);
  return statPart + traitPart;
}

export function applyStatChanges(state, content, statChanges) {
  const { min, max } = content.rules.statRange;
  for (const [statId, delta] of Object.entries(statChanges ?? {})) {
    state.stats[statId] = clamp(state.stats[statId] + delta, min, max);
  }
}
