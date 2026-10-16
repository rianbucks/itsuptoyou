const DEATH_CAUSES = { node: "분기점 결과", survival: "생존 판정 실패", naturalDeath: "기록대로 자연사", maxAgeDeath: "100세 도달" };

function formatYear(year) {
  return year < 0 ? `기원전 ${-year}년` : `${year}년`;
}

function percent(probability) {
  return `${(probability * 100).toFixed(1)}%`;
}

function labelOf(choices, choiceId) {
  return choices.find((choice) => choice.id === choiceId).label;
}

function describeEntry(entry, content, statNames) {
  switch (entry.kind) {
    case "focusChosen": return `초점 선택: ${statNames[entry.stat]}`;
    case "focusGrowth": return `${statNames[entry.stat]} +${entry.amount}`;
    case "focusChanged": return `초점 변경: ${statNames[entry.stat]} (${formatYear(entry.fromYear)}부터)`;
    case "growth": {
      const event = content.growthIndex[entry.event];
      return `[사료 성장] ${event.title} → ${labelOf(event.choices, entry.choice)}`;
    }
    case "node": {
      const node = content.nodeIndex[entry.node];
      return `[분기점] ${node.title} → ${labelOf(node.choices, entry.choice)}: ${entry.result === "success" ? "성공" : "실패"} (${percent(entry.probability)})`;
    }
    case "commonEvent": {
      const event = content.eventIndex[entry.event];
      return `[공통 이벤트] ${event.title} → ${labelOf(event.choices, entry.choice)}`;
    }
    case "survival": return `생존 판정 ${percent(entry.probability)} → ${entry.survived ? "생존" : "사망"}`;
    case "death": return `사망: ${DEATH_CAUSES[entry.cause]}`;
    default: return null;
  }
}

export function formatTrace(trace, content) {
  const statNames = Object.fromEntries(content.stats.map((stat) => [stat.id, stat.name]));
  const lines = [];
  let pendingBeforeYear = [];
  for (const entry of trace) {
    if (entry.kind === "year") {
      lines.push(`${formatYear(entry.year)} (${entry.age}세)`);
      lines.push(...pendingBeforeYear.map((text) => `    ${text}`));
      pendingBeforeYear = [];
      continue;
    }
    const text = describeEntry(entry, content, statNames);
    if (!text) continue;
    if (entry.kind === "focusChanged") pendingBeforeYear.push(text);
    else lines.push(`    ${text}`);
  }
  return lines;
}
