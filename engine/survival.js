import { evaluateCheck } from "./judgment.js";
import { nextRandom } from "./random.js";
import { killFigure } from "./state.js";

export function survivalCheckFor(state, content) {
  return { stats: { [content.rules.survival.stat]: 1 }, difficulty: state.age };
}

export function annualSurvivalProbability(state, content) {
  const { probability } = evaluateCheck(state, content, survivalCheckFor(state, content));
  return probability ** (1 / content.rules.survival.referenceYears);
}

export function resolveSurvivalCheck(session, content) {
  const { state } = session;
  const probability = annualSurvivalProbability(state, content);
  const survived = nextRandom(state) < probability;
  state.survivalHistory.push({ year: state.year, age: state.age, probability, survived });
  if (!survived) killFigure(state, "survival");
  return { survived, probability };
}
