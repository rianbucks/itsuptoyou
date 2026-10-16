import { findHistoricalChoice } from "./content.js";
import { createPolicyRandom, pickIndex } from "./policy.js";
import { createSession } from "./state.js";
import { advanceYear, resolveDecision } from "./timeline.js";

const MAX_YEARS = 200;

function focusInput(content, random, fixedFocus) {
  return { stat: fixedFocus ?? content.stats[pickIndex(random, content.stats.length)].id };
}

function historicalInput(pending, content, random, fixedFocus) {
  if (pending.kind === "focus") return focusInput(content, random, fixedFocus);
  if (pending.kind === "growth") return { choice: findHistoricalChoice(content.growthIndex[pending.id].choices).id };
  if (pending.kind === "node") {
    const choice = findHistoricalChoice(content.nodeIndex[pending.id].choices);
    return choice ? { choice: choice.id, forcedResult: "success" } : null;
  }
  const event = content.eventIndex[pending.id];
  return { choice: event.choices[pickIndex(random, event.choices.length)].id };
}

function collectNodeRows(outcome) {
  return outcome.entries.filter((entry) => entry.kind === "node");
}

function runHistoricalPath(content, seed, fixedFocus) {
  const session = createSession(content, seed);
  const random = createPolicyRandom(seed);
  const rows = [];
  let outcome = advanceYear(session, content);
  for (let year = 0; year < MAX_YEARS && outcome.type !== "ended"; year++) {
    while (outcome.type === "decision") {
      const input = historicalInput(outcome.pending, content, random, fixedFocus);
      if (!input) return rows;
      outcome = resolveDecision(session, content, input);
      rows.push(...collectNodeRows(outcome));
    }
    if (outcome.type !== "ended") outcome = advanceYear(session, content);
  }
  return rows;
}

function productOf(rows) {
  return rows.reduce((product, row) => product * row.probability, 1);
}

function accumulateNodes(totals, rows) {
  for (const row of rows) {
    const total = totals.get(row.node) ?? { node: row.node, difficulty: row.difficulty, score: 0, probability: 0, count: 0 };
    total.score += row.score;
    total.probability += row.probability;
    total.count += 1;
    totals.set(row.node, total);
  }
}

function averagePath(content, runs, fixedFocus) {
  const totals = new Map();
  let productSum = 0;
  let judgementNodes = 0;
  for (let seed = 0; seed < runs; seed++) {
    const rows = runHistoricalPath(content, seed, fixedFocus);
    productSum += productOf(rows);
    judgementNodes = Math.max(judgementNodes, rows.length);
    accumulateNodes(totals, rows);
  }
  const nodes = [...totals.values()].map((total) => ({
    node: total.node,
    title: content.nodeIndex[total.node].title,
    difficulty: total.difficulty,
    score: total.score / total.count,
    probability: total.probability / total.count,
  }));
  return { average: productSum / runs, nodes, judgementNodes };
}

export function computeHistoryMatch(content, { runs = 1000 } = {}) {
  const randomFocus = averagePath(content, runs, null);
  const byFocus = Object.fromEntries(content.stats.map((stat) => [stat.id, averagePath(content, runs, stat.id).average]));
  return { ...randomFocus, byFocus, runs };
}
