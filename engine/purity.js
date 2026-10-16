import { findHistoricalChoice } from "./content.js";
import { applyGrowthChoice } from "./growth.js";
import { evaluateCheck } from "./judgment.js";
import { applyNodeResult } from "./nodes.js";
import { advanceToYear, createSession } from "./state.js";
import { findNextStep } from "./steps.js";

export function computePureHistoryPath(content) {
  const session = createSession(content, 0);
  const rows = [];
  for (let step = findNextStep(session, content); step.type === "growth" || step.type === "node"; step = findNextStep(session, content)) {
    if (step.type === "growth") {
      applyGrowthChoice(session, content, step.event, findHistoricalChoice(step.event.choices));
      continue;
    }
    const choice = findHistoricalChoice(step.node.choices);
    if (!choice) break;
    advanceToYear(session.state, content.figure, step.node.year);
    const { score, probability } = evaluateCheck(session.state, content, choice.check);
    rows.push({ node: step.node.id, title: step.node.title, score, difficulty: choice.check.difficulty, probability });
    applyNodeResult(session, content, step.node, choice, "success", probability);
  }
  return { rows, product: rows.reduce((product, row) => product * row.probability, 1) };
}
