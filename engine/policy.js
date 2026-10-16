import { nextRandom } from "./random.js";

export function createPolicyRandom(seed) {
  const holder = { rngState: (seed ^ 0x9e3779b9) >>> 0 };
  return () => nextRandom(holder);
}

export function pickIndex(random, length) {
  return Math.floor(random() * length);
}
