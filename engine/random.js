export function nextRandom(holder) {
  holder.rngState = (holder.rngState + 0x6d2b79f5) >>> 0;
  let mixed = holder.rngState;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
}
