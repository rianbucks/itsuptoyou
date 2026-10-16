import { clamp } from "./math.js";
import { computeScore } from "./stats.js";

export function successProbability(score, difficulty, judgement) {
  const logistic = 1 / (1 + Math.exp(-(score - difficulty) / judgement.k));
  return clamp(logistic, judgement.minProbability, judgement.maxProbability);
}

export function evaluateCheck(state, content, check) {
  const score = computeScore(state, content, check);
  return { score, probability: successProbability(score, check.difficulty, content.rules.judgement) };
}
