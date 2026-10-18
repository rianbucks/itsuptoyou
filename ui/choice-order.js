const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function hashText(text) {
  let hash = FNV_OFFSET;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
}

export function orderChoices(choices, seed, eventId) {
  return choices
    .map((choice, index) => ({ choice, index, key: hashText(`${seed}:${eventId}:${choice.id}`) }))
    .sort((a, b) => a.key - b.key || a.index - b.index)
    .map(({ choice }) => choice);
}
