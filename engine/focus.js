import { applyStatChanges } from "./stats.js";
import { addYears } from "./years.js";

function isFocusAge(state, rules) {
  return state.age >= rules.focus.ageMin && state.age <= rules.focus.ageMax;
}

function assertStat(content, stat) {
  if (!content.stats.some((item) => item.id === stat)) throw new Error(`없는 능력치: ${stat}`);
}

export function needsFocusChoice(state, rules) {
  return state.focus === null && isFocusAge(state, rules);
}

export function applyFocusGrowth(state, content) {
  if (state.focus === null || !isFocusAge(state, content.rules)) return 0;
  const before = state.stats[state.focus];
  applyStatChanges(state, content, { [state.focus]: content.rules.focus.perYear });
  return state.stats[state.focus] - before;
}

export function chooseFocus(state, content, stat) {
  assertStat(content, stat);
  state.focus = stat;
  state.focusHistory.push({ fromYear: state.year, stat });
}

export function changeFocus(session, content, stat) {
  const { state } = session;
  assertStat(content, stat);
  if (!state.alive || state.focus === null || state.focus === stat) return false;
  state.focus = stat;
  state.focusHistory.push({ fromYear: addYears(state.year, 1), stat });
  return true;
}
