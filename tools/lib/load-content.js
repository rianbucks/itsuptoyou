import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleContent } from "../../engine/content.js";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readJson(...parts) {
  return JSON.parse(readFileSync(join(REPO_ROOT, ...parts), "utf8"));
}

export function readFigureIds() {
  return readJson("data", "figures", "index.json");
}

export function loadSchemas() {
  const names = readdirSync(join(REPO_ROOT, "schemas")).filter((name) => name.endsWith(".schema.json"));
  return Object.fromEntries(names.map((name) => [name, readJson("schemas", name)]));
}

export function loadContent(figureId) {
  const common = (file) => readJson("data", "common", file);
  const figureFile = (file) => readJson("data", "figures", figureId, file);
  return assembleContent({
    rules: common("rules.json"),
    stats: common("stats.json"),
    commonTraits: common("traits.json"),
    figure: figureFile("figure.json"),
    growth: figureFile("growth.json"),
    nodes: figureFile("nodes.json"),
    fragments: figureFile("fragments.json"),
    endings: figureFile("endings.json"),
    events: figureFile("events.json"),
    chronicle: figureFile("chronicle.json"),
    era: figureFile("era.json"),
    life: figureFile("life.json"),
  });
}
