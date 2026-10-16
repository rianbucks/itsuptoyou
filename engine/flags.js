export const RESERVED_FLAG_DEFAULTS = Object.freeze({ deviated: false, outlived: false, extraYears: 0 });

function defaultFlagValue(expected) {
  if (typeof expected === "boolean") return false;
  if (typeof expected === "number") return 0;
  return "";
}

export function readFlag(flags, key, expected) {
  return key in flags ? flags[key] : defaultFlagValue(expected);
}

export function flagsMatchAll(required, flags) {
  return Object.entries(required ?? {}).every(([key, value]) => readFlag(flags, key, value) === value);
}

export function flagsMatchAny(candidates, flags) {
  return Object.entries(candidates).some(([key, value]) => readFlag(flags, key, value) === value);
}

export function isRequirementMet(requires, alive, flags) {
  if (!requires) return true;
  if (requires.alive !== undefined && requires.alive !== alive) return false;
  return flagsMatchAll(requires.flags, flags);
}
