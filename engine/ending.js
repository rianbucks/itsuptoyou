import { flagsMatchAll, flagsMatchAny, readFlag } from "./flags.js";

export function matchesConditions(conditions, flags) {
  const { all, any, none, gte, lt } = conditions;
  if (all && !flagsMatchAll(all, flags)) return false;
  if (any && !flagsMatchAny(any, flags)) return false;
  if (none && flagsMatchAny(none, flags)) return false;
  if (gte && !Object.entries(gte).every(([key, value]) => readFlag(flags, key, value) >= value)) return false;
  if (lt && !Object.entries(lt).every(([key, value]) => readFlag(flags, key, value) < value)) return false;
  return true;
}

export function selectEnding(endings, flags) {
  const ordered = [...endings].sort((a, b) => a.priority - b.priority);
  return ordered.find((ending) => matchesConditions(ending.conditions, flags)) ?? endings.find((ending) => ending.isDefault);
}
