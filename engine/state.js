import { RESERVED_FLAG_DEFAULTS } from "./flags.js";
import { createRng } from "./random.js";
import { applyStatChanges, createInitialStats } from "./stats.js";
import { computeAge, yearsBetween } from "./years.js";

export function createInitialState(content, seed) {
  const { figure } = content;
  return {
    seed,
    figure: figure.id,
    year: figure.born,
    age: 0,
    alive: true,
    stats: createInitialStats(content),
    traits: figure.initialTraits.map((trait) => trait.id),
    flags: { ...RESERVED_FLAG_DEFAULTS },
    history: [],
    growthHistory: [],
  };
}

export function createSession(content, seed) {
  return { state: createInitialState(content, seed), rng: createRng(seed), survivalLog: [], deathCause: null };
}

export function projectFlagsAtYear(state, figure, year) {
  const passedRecordedDeath = state.alive && year > figure.died;
  if (!passedRecordedDeath) return state.flags;
  return { ...state.flags, outlived: true, extraYears: yearsBetween(figure.died, year) };
}

export function advanceToYear(state, figure, year) {
  state.flags = projectFlagsAtYear(state, figure, year);
  state.year = year;
  state.age = computeAge(figure.born, year);
}

export function markDeviated(state) {
  state.flags.deviated = true;
}

export function addTraits(state, traitIds) {
  for (const traitId of traitIds ?? []) {
    if (!state.traits.includes(traitId)) state.traits.push(traitId);
  }
}

export function removeTraits(state, traitIds) {
  state.traits = state.traits.filter((traitId) => !(traitIds ?? []).includes(traitId));
}

export function setFlags(state, flags) {
  Object.assign(state.flags, flags ?? {});
}

export function applyEffects(state, content, effects) {
  applyStatChanges(state, content, effects.statChanges);
  addTraits(state, effects.addTraits);
  removeTraits(state, effects.removeTraits);
  setFlags(state, effects.setFlags);
}

export function killFigure(session, cause) {
  session.state.alive = false;
  session.deathCause = cause;
}
