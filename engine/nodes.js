import { evaluateCheck } from "./judgment.js";
import { nextRandom } from "./random.js";
import { applyEffects, killFigure, markDeviated } from "./state.js";

export function isRecordedOutcome(choice, result) {
  return choice.historical && result === "success";
}

export function applyNodeResult(session, content, node, choice, result, probability) {
  const { state } = session;
  const outcome = choice[result];
  applyEffects(state, content, outcome);
  if (!isRecordedOutcome(choice, result)) markDeviated(state);
  state.history.push({ node: node.id, choice: choice.id, result, probability, year: state.year });
  if (outcome.death) killFigure(state, "node");
  return { result, probability, outcome, fragment: content.fragmentIndex[outcome.fragment] };
}

function rollResult(state, probability) {
  return nextRandom(state) < probability ? "success" : "failure";
}

export function resolveNodeChoice(session, content, node, choice, forcedResult) {
  const { score, probability } = evaluateCheck(session.state, content, choice.check);
  const result = forcedResult ?? rollResult(session.state, probability);
  return { ...applyNodeResult(session, content, node, choice, result, probability), score };
}
