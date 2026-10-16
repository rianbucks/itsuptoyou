const NARRATION_STREAM = 0x9e3779b9;

export function nextRandom(holder, key = "rngState") {
  holder[key] = (holder[key] + 0x6d2b79f5) >>> 0;
  let mixed = holder[key];
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
}

export function narrationSeed(seed) {
  let mixed = Math.imul((seed ^ NARRATION_STREAM) >>> 0, 0x85ebca6b);
  mixed ^= mixed >>> 13;
  mixed = Math.imul(mixed, 0xc2b2ae35);
  return (mixed ^ (mixed >>> 16)) >>> 0;
}
