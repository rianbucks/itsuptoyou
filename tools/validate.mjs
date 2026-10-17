import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCommon, validateFigure } from "./lib/validate-content.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(root, relativePath), "utf8"));
}

async function loadSchemas() {
  const names = (await readdir(join(root, "schemas"))).filter((name) => name.endsWith(".schema.json"));
  const entries = await Promise.all(names.map(async (name) => [name, await readJson(join("schemas", name))]));
  return Object.fromEntries(entries);
}

async function loadFigure(folder) {
  const base = join("data", "figures", folder);
  const files = ["figure.json", "growth.json", "nodes.json", "fragments.json", "endings.json", "events.json", "chronicle.json", "era.json", "life.json"];
  const [figure, growth, nodes, fragments, endings, events, chronicle, era, life] = await Promise.all(files.map((file) => readJson(join(base, file))));
  const reviewFile = join("tools", "review", `${folder}.json`);
  const review = existsSync(join(root, reviewFile)) ? await readJson(reviewFile) : null;
  return { folder, figure, growth, nodes, fragments, endings, events, chronicle, era, life, review };
}

let errorCount = 0;

function printResult(label, { errors, warnings, summary, details }) {
  console.log(`\n${label}`);
  if (summary) console.log(`  ${summary}`);
  for (const line of details ?? []) console.log(`    ${line}`);
  for (const message of errors) console.log(`  오류  ${message}`);
  for (const message of warnings) console.log(`  경고  ${message}`);
  errorCount += errors.length;
}

const schemas = await loadSchemas();
const common = {
  stats: await readJson(join("data", "common", "stats.json")),
  commonTraits: await readJson(join("data", "common", "traits.json")),
  rules: await readJson(join("data", "common", "rules.json")),
};
const figureIds = await readJson(join("data", "figures", "index.json"));

printResult("공통 데이터", validateCommon(common, schemas));
for (const folder of figureIds) {
  const bundle = { ...(await loadFigure(folder)), ...common };
  printResult(folder, validateFigure(bundle, schemas));
}

console.log(`\n오류 ${errorCount}개`);
process.exitCode = errorCount > 0 ? 1 : 0;
