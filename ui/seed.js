export function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
}

export function seedFromUrl() {
  const raw = new URLSearchParams(location.search).get("seed");
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function canRewriteUrl() {
  return ["http:", "https:", "file:"].includes(location.protocol);
}

export function writeSeedToUrl(seed) {
  if (!canRewriteUrl()) return;
  try {
    const url = new URL(location.href);
    url.searchParams.set("seed", seed);
    history.replaceState(null, "", url);
  } catch {
    return;
  }
}
