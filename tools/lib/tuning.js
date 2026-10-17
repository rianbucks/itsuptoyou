import { selectEnding } from "../../engine/ending.js";
import { playHistoricalPath } from "../../engine/purity.js";
import { playRandomly } from "./play.js";

export function choiceKey(node, choice) {
  return `${node.id}/${choice.id}`;
}

export function readDifficulties(content) {
  return new Map(content.nodes.flatMap((node) => node.choices.map((choice) => [choiceKey(node, choice), choice.check.difficulty])));
}

export function withDifficulties(content, difficulties) {
  const nodes = content.nodes.map((node) => ({
    ...node,
    choices: node.choices.map((choice) => ({ ...choice, check: { ...choice.check, difficulty: difficulties.get(choiceKey(node, choice)) } })),
  }));
  return { ...content, nodes, nodeIndex: Object.fromEntries(nodes.map((node) => [node.id, node])) };
}

export function historicalChoiceKeys(content) {
  return content.nodes
    .filter((node) => node.kind === "historical")
    .flatMap((node) => node.choices.filter((choice) => choice.historical).map((choice) => ({ key: choiceKey(node, choice), node, choice })));
}

export function alternateChoiceKeys(content) {
  return content.nodes.flatMap((node) => node.choices.filter((choice) => !choice.historical).map((choice) => ({ key: choiceKey(node, choice), node, choice })));
}

export function historyMatchAverage(content, runs, fixedFocus = null) {
  let sum = 0;
  for (let seed = 0; seed < runs; seed++) {
    const { rows } = playHistoricalPath(content, seed, fixedFocus);
    sum += rows.reduce((product, row) => product * row.probability, 1);
  }
  return sum / runs;
}

export function measureHistoryMatch(content, runs) {
  const byFocus = Object.fromEntries(content.stats.map((stat) => [stat.id, historyMatchAverage(content, runs, stat.id)]));
  const [bestStat, bestValue] = Object.entries(byFocus).reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  return { average: historyMatchAverage(content, runs), bestStat, bestValue, byFocus };
}

export function measureEndings(content, runs) {
  const counts = new Map(content.endings.map((ending) => [ending.id, 0]));
  const samples = [];
  for (let seed = 0; seed < runs; seed++) {
    const { state } = playRandomly(content, seed).session;
    const ending = selectEnding(content.endings, state.flags);
    counts.set(ending.id, counts.get(ending.id) + 1);
    samples.push({ ending: ending.id, outcomes: state.history.map((entry) => ({ key: `${entry.node}/${entry.choice}`, result: entry.result })) });
  }
  const shares = Object.fromEntries([...counts].map(([id, count]) => [id, count / runs]));
  return { shares, samples, runs };
}

export function endingProblems(content, shares) {
  const { max } = content.rules.endingShare;
  return content.endings.flatMap((ending) => {
    const share = shares[ending.id];
    if (share >= max) return [{ ending, kind: "high", share }];
    if (share === 0 && ending.kind !== "historical") return [{ ending, kind: "zero", share }];
    return [];
  });
}
