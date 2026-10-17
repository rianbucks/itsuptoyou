import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { REPO_ROOT, loadContent, readFigureIds } from "./lib/load-content.js";
import { collectFactItems, factcheckStatus, reviewStatus } from "./lib/fact-items.js";
import { pipelinePath, readArgs, readJsonIfExists, reviewPath, writeJson } from "./lib/pipeline-files.js";
import { allTimelineRows } from "./lib/timeline.js";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 8770;
const PAGE_ROOT = join(REPO_ROOT, "tools", "review", "page");
const PAGE_FILES = { "/": "index.html", "/review.js": "review.js", "/review.css": "review.css" };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const DECISIONS = ["approved", "rejected"];
const MAX_BODY = 200000;

function send(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  response.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) reject(new Error("요청이 너무 크다"));
    });
    request.on("end", () => resolve(body ? JSON.parse(body) : {}));
    request.on("error", reject);
  });
}

function loadReview(figureId) {
  return readJsonIfExists(reviewPath(figureId), { figure: figureId, items: {} });
}

function timelineRows(figureId) {
  const timeline = readJsonIfExists(pipelinePath(figureId, "timeline.json"), null);
  const trace = readJsonIfExists(pipelinePath(figureId, "trace.json"), {});
  const rows = new Map(allTimelineRows(timeline).map((row) => [row.id, row]));
  return (itemId) => (trace[itemId] ?? []).map((rowId) => rows.get(rowId)).filter(Boolean)
    .map(({ id, yearText, event, sourceText, links, marks }) => ({ id, yearText, event, sourceText, links, marks }));
}

function conflictNotes(figureId) {
  const { judgments = [] } = readJsonIfExists(pipelinePath(figureId, "conflicts.json"), {});
  return (kind, ref) => judgments.filter((judgment) => judgment.item === `${kind}:${ref}` && judgment.conflict);
}

function reviewPayload(figureId) {
  const content = loadContent(figureId);
  const review = loadReview(figureId);
  const rowsFor = timelineRows(figureId);
  const conflictsFor = conflictNotes(figureId);
  const items = collectFactItems(content).map((factItem) => {
    const entry = review.items[factItem.id] ?? {};
    const ref = factItem.id.slice(factItem.kind.length + 1);
    return {
      ...factItem,
      reviewStatus: reviewStatus(factItem, review),
      factcheckStatus: factcheckStatus(factItem, review),
      factcheck: entry.factcheck ?? null,
      manual: entry.manual ?? null,
      decision: entry.decision ?? null,
      timelineRows: rowsFor(factItem.id),
      conflicts: ["chronicle", "era"].includes(factItem.kind) ? conflictsFor(factItem.kind, ref) : [],
    };
  });
  return { figure: { id: content.figure.id, name: content.figure.name }, items };
}

function currentItem(figureId, itemId) {
  return collectFactItems(loadContent(figureId)).find((factItem) => factItem.id === itemId) ?? null;
}

function saveEntry(figureId, factItem, update) {
  const review = loadReview(figureId);
  const entry = review.items[factItem.id] ?? {};
  review.items[factItem.id] = { ...entry, label: factItem.label, kind: factItem.kind, text: factItem.text, sources: factItem.sources, hash: factItem.hash, ...update };
  writeJson(reviewPath(figureId), review);
}

async function handleDecision(request, figureId) {
  const body = await readBody(request);
  const factItem = currentItem(figureId, body.item);
  if (!factItem) return [404, { error: "없는 항목" }];
  if (!DECISIONS.includes(body.status)) return [400, { error: "status는 approved 또는 rejected" }];
  saveEntry(figureId, factItem, {
    decision: { status: body.status, note: String(body.note ?? ""), by: String(body.by ?? "검수자"), at: new Date().toISOString(), hash: factItem.hash, elapsedMs: Number(body.elapsedMs) || null },
  });
  return [200, { ok: true }];
}

async function handleExcerpt(request, figureId) {
  const body = await readBody(request);
  const factItem = currentItem(figureId, body.item);
  if (!factItem) return [404, { error: "없는 항목" }];
  saveEntry(figureId, factItem, {
    manual: { source: String(body.source ?? ""), url: String(body.url ?? ""), excerpt: String(body.excerpt ?? ""), translation: String(body.translation ?? ""), at: new Date().toISOString(), hash: factItem.hash },
  });
  return [200, { ok: true }];
}

function figureList() {
  return readFigureIds().map((id) => ({ id, name: loadContent(id).figure.name, hasReview: Boolean(readJsonIfExists(reviewPath(id), null)) }));
}

async function route(request, response) {
  const url = new URL(request.url, `http://${HOST}`);
  if (request.method === "GET" && PAGE_FILES[url.pathname]) {
    const file = PAGE_FILES[url.pathname];
    return send(response, 200, readFileSync(join(PAGE_ROOT, file), "utf8"), TYPES[extname(file)]);
  }
  if (request.method === "GET" && url.pathname === "/api/figures") return send(response, 200, figureList());
  const match = url.pathname.match(/^\/api\/review\/([\w-]+)(?:\/(decision|excerpt))?$/);
  if (!match || !readFigureIds().includes(match[1])) return send(response, 404, { error: "없는 경로" });
  const [, figureId, action] = match;
  if (request.method === "GET" && !action) return send(response, 200, reviewPayload(figureId));
  if (request.method === "POST" && action === "decision") return send(response, ...(await handleDecision(request, figureId)));
  if (request.method === "POST" && action === "excerpt") return send(response, ...(await handleExcerpt(request, figureId)));
  return send(response, 405, { error: "허용되지 않는 요청" });
}

const { options } = readArgs(process.argv.slice(2));
const port = Number(options.port ?? DEFAULT_PORT);
createServer((request, response) => {
  route(request, response).catch((error) => send(response, 500, { error: error.message }));
}).listen(port, HOST, () => console.log(`검수 페이지: http://${HOST}:${port}/`));
