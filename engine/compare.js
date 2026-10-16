import { findHistoricalChoice, findHistoricalEnding } from "./content.js";
import { selectEnding } from "./ending.js";

export function describeRunEntry(content, entry) {
  const node = content.nodeIndex[entry.node];
  const choice = node.choices.find((item) => item.id === entry.choice);
  return { entry, node, choice, fragment: content.fragmentIndex[choice[entry.result].fragment] };
}

export function findRunEntryForNode(session, content, nodeId) {
  const relatedIds = [nodeId, ...content.nodes.filter((node) => node.replaces === nodeId).map((node) => node.id)];
  const entry = session.state.history.find((item) => relatedIds.includes(item.node));
  if (!entry) return null;
  return describeRunEntry(content, entry);
}

export function listRunFragments(session, content) {
  return session.state.history.map((entry) => describeRunEntry(content, entry));
}

function buildGrowthComparison(session, content) {
  return content.growth.map((event) => {
    const realChoice = findHistoricalChoice(event.choices);
    const picked = session.state.growthHistory.find((item) => item.event === event.id);
    const runChoice = picked ? event.choices.find((choice) => choice.id === picked.choice) : null;
    return { event, realChoice, runChoice };
  });
}

function buildNodeComparison(session, content) {
  return content.nodes
    .filter((node) => node.kind === "historical")
    .map((node) => {
      const realChoice = findHistoricalChoice(node.choices);
      return { node, realChoice, realFragment: content.fragmentIndex[realChoice.success.fragment], run: findRunEntryForNode(session, content, node.id) };
    });
}

function buildAfterRecordComparison(session, content) {
  return session.state.history
    .map((entry) => describeRunEntry(content, entry))
    .filter(({ node }) => node.kind === "alternate" && !node.replaces);
}

export function buildComparison(session, content) {
  return {
    growth: buildGrowthComparison(session, content),
    nodes: buildNodeComparison(session, content),
    afterRecord: buildAfterRecordComparison(session, content),
    realEnding: findHistoricalEnding(content.endings),
    runEnding: selectEnding(content.endings, session.state.flags),
  };
}
