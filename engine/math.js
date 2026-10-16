export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function weightOf(item) {
  return item.weight ?? 1;
}

export function pickWeighted(items, roll) {
  let remaining = roll * items.reduce((sum, item) => sum + weightOf(item), 0);
  for (const item of items) {
    remaining -= weightOf(item);
    if (remaining < 0) return item;
  }
  return items[items.length - 1];
}
