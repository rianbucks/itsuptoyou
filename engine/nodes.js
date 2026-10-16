import { evaluateCheck } from "./judgment.js";
import { nextRandom } from "./random.js";
import { advanceToYear, applyEffects, killFigure, markDeviated } from "./state.js";

export function isRecordedOutcome(choice, result) {
  return choice.historical && result === "success";
}

export function applyNodeResult(session, content, node, choice, result, probability) {
  const { state } = session;
  const outcome = choice[result];
  applyEffects(state, content, outcome);
  if (!isRecordedOutcome(choice, result)) markDeviated(state);
  state.history.push({ node: node.id, choice: choice.id, result, probability });
  if (outcome.death) killFigure(session, "node");
  return { result, probability, outcome, fragment: content.fragmentIndex[outcome.fragment] };
}

export function resolveNodeChoice(session, content, node, choice) {
  advanceToYear(session.state, content.figure, node.year);
  const { score, probability } = evaluateCheck(session.state, content, choice.check);
  const roll = nextRandom(session.rng);
  const result = roll < probability ? "success" : "failure";
  return { ...applyNodeResult(session, content, node, choice, result, probability), score, roll };
}
