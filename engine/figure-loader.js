import { assembleContent } from "./content.js";

const DATA_ROOT = new URL("../data/", import.meta.url);

async function readJson(path) {
  const response = await fetch(new URL(path, DATA_ROOT));
  if (!response.ok) throw new Error(`${path}을(를) 읽지 못했다 (${response.status})`);
  return response.json();
}

export function readFigureIds() {
  return readJson("figures/index.json");
}

export function loadFigureHeader(figureId) {
  return readJson(`figures/${figureId}/figure.json`);
}

export async function loadFigureContent(figureId) {
  const folder = `figures/${figureId}/`;
  const [rules, stats, commonTraits, figure, growth, nodes, fragments, endings] = await Promise.all([
    readJson("common/rules.json"),
    readJson("common/stats.json"),
    readJson("common/traits.json"),
    readJson(`${folder}figure.json`),
    readJson(`${folder}growth.json`),
    readJson(`${folder}nodes.json`),
    readJson(`${folder}fragments.json`),
    readJson(`${folder}endings.json`),
  ]);
  return assembleContent({ rules, stats, commonTraits, figure, growth, nodes, fragments, endings });
}
