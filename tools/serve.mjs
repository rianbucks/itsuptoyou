import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { REPO_ROOT } from "./lib/load-content.js";
import { readArgs } from "./lib/pipeline-files.js";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 8765;
const SERVED_FOLDERS = ["ui", "engine", "data"];
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function send(response, status, body, type = "text/plain; charset=utf-8") {
  response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  response.end(body);
}

function resolvePath(urlPath) {
  const relative = decodeURIComponent(urlPath).replace(/^\/+/, "");
  if (relative === "" || relative === "index.html") return join(REPO_ROOT, "index.html");
  const [folder] = relative.split("/");
  if (!SERVED_FOLDERS.includes(folder)) return null;
  const full = normalize(join(REPO_ROOT, relative));
  return full.startsWith(join(REPO_ROOT, folder) + sep) ? full : null;
}

async function handle(request, response) {
  if (request.method !== "GET") return send(response, 405, "GET만 받는다");
  const path = resolvePath(new URL(request.url, `http://${HOST}`).pathname);
  if (!path) return send(response, 404, "없는 경로");
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) return send(response, 404, "없는 파일");
  send(response, 200, await readFile(path), TYPES[extname(path)] ?? "application/octet-stream");
}

const { options } = readArgs(process.argv.slice(2));
const port = Number(options.port ?? DEFAULT_PORT);
createServer((request, response) => handle(request, response).catch((error) => send(response, 500, error.message)))
  .listen(port, HOST, () => console.log(`게임: http://${HOST}:${port}/  (개발자 모드: http://${HOST}:${port}/?dev=1)`));
