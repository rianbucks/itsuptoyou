function indexById(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function sortByYear(items) {
  return [...items].sort((a, b) => a.year - b.year);
}

export function assembleContent(raw) {
  const events = raw.events ?? [];
  const chronicle = sortByYear(raw.chronicle ?? []);
  const era = sortByYear(raw.era ?? []);
  const life = raw.life ?? [];
  return {
    ...raw,
    events,
    chronicle,
    era,
    life,
    growth: sortByYear(raw.growth),
    nodes: sortByYear(raw.nodes),
    traitIndex: indexById([...raw.commonTraits, ...raw.figure.traits]),
    fragmentIndex: indexById(raw.fragments),
    nodeIndex: indexById(raw.nodes),
    growthIndex: indexById(raw.growth),
    eventIndex: indexById(events),
    narrationIndex: {
      chronicle: indexById(chronicle),
      era: indexById(era),
      life: indexById(life),
    },
  };
}

export function findHistoricalChoice(choices) {
  return choices.find((choice) => choice.historical);
}

export function findHistoricalEnding(endings) {
  return endings.find((ending) => ending.kind === "historical");
}
