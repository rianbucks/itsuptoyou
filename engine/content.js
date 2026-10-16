function indexById(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function sortByYear(items) {
  return [...items].sort((a, b) => a.year - b.year);
}

export function assembleContent(raw) {
  return {
    ...raw,
    growth: sortByYear(raw.growth),
    nodes: sortByYear(raw.nodes),
    traitIndex: indexById([...raw.commonTraits, ...raw.figure.traits]),
    fragmentIndex: indexById(raw.fragments),
    nodeIndex: indexById(raw.nodes),
    growthIndex: indexById(raw.growth),
  };
}

export function findHistoricalChoice(choices) {
  return choices.find((choice) => choice.historical);
}

export function findHistoricalEnding(endings) {
  return endings.find((ending) => ending.kind === "historical");
}
