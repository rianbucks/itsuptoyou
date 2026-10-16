import { evaluateCheck } from "./judgment.js";
import { nextRandom } from "./random.js";
import { advanceToYear, killFigure } from "./state.js";

export function survivalCheckFor(state, content) {
  return { stats: { [content.rules.survival.stat]: 1 }, difficulty: state.age };
}

export function resolveSurvivalCheck(session, content, year) {
  const { state } = session;
  advanceToYear(state, content.figure, year);
  const { probability } = evaluateCheck(state, content, survivalCheckFor(state, content));
  const survived = nextRandom(session.rng) < probability;
  session.survivalLog.push({ year, age: state.age, probability, survived });
  if (!survived) killFigure(session, "survival");
  return { survived, probability, age: state.age };
}

export function resolveScheduledDeath(session, content, year, cause) {
  advanceToYear(session.state, content.figure, year);
  killFigure(session, cause);
}
