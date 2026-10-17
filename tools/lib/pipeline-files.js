import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { REPO_ROOT } from "./load-content.js";

export function pipelineDir(figureId) {
  return join(REPO_ROOT, "tools", "pipeline", figureId);
}

export function pipelinePath(figureId, file) {
  return join(pipelineDir(figureId), file);
}

export function reviewPath(figureId) {
  return join(REPO_ROOT, "tools", "review", `${figureId}.json`);
}

export function timelinePath(figureId) {
  return join(REPO_ROOT, "docs", "figures", `${figureId}_timeline.md`);
}

export function readJsonIfExists(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

export function readArgs(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const [key, inline] = arg.slice(2).split("=");
    const next = argv[index + 1];
    if (inline !== undefined) options[key] = inline;
    else if (next !== undefined && !next.startsWith("--")) options[key] = argv[++index];
    else options[key] = true;
  }
  return { positional, options };
}
