// Node.js HTTP entry point for the TanStack Start fetch handler.
// Serves static client assets from dist/client/ and delegates everything else
// to the SSR/server-fn fetch handler exported by dist/server/index.js.

import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, resolve, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import serverEntry from "./dist/server/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLIENT_DIR = resolve(__dirname, "dist/client");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

// Convert a Node.js IncomingMessage into a Web Request
function toWebRequest(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || `${HOST}:${PORT}`;
  const url = new URL(req.url || "/", `${proto}://${host}`);

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) for (const item of v) headers.append(k, item);
    else if (v !== undefined) headers.set(k, String(v));
  }

  const init = { method: req.method, headers };
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    init.body = req;
    init.duplex = "half";
  }
  return new Request(url.toString(), init);
}

// Write a Web Response to a Node.js ServerResponse
async function sendWebResponse(webRes, res) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      const existing = res.getHeader("set-cookie");
      if (existing) {
        res.setHeader(
          "set-cookie",
          Array.isArray(existing) ? [...existing, value] : [existing, value],
        );
      } else {
        res.setHeader("set-cookie", value);
      }
    } else {
      res.setHeader(key, value);
    }
  });

  if (!webRes.body) {
    res.end();
    return;
  }
  const reader = webRes.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(value)) await new Promise((r) => res.once("drain", r));
    }
  } finally {
    res.end();
  }
}

// Resolve a request URL to a safe path inside CLIENT_DIR; null if escapes.
function resolveStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = normalize(decoded).replace(/^([/\\])+/, "");
  const full = join(CLIENT_DIR, normalized);
  if (!full.startsWith(CLIENT_DIR)) return null;
  return full;
}

async function tryServeStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const urlPath = (req.url || "/").split("?")[0];
  if (urlPath === "/" || urlPath === "") return false;

  const candidate = resolveStaticPath(urlPath);
  if (!candidate) return false;

  try {
    const s = await stat(candidate);
    if (!s.isFile()) return false;
    const ext = extname(candidate).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.statusCode = 200;
    res.setHeader("content-type", mime);
    res.setHeader("content-length", s.size);
    if (urlPath.startsWith("/assets/")) {
      res.setHeader("cache-control", "public, max-age=31536000, immutable");
    }
    if (req.method === "HEAD") {
      res.end();
      return true;
    }
    await new Promise((resolveStream, reject) => {
      const stream = createReadStream(candidate);
      stream.on("error", reject);
      stream.on("end", resolveStream);
      stream.pipe(res);
    });
    return true;
  } catch {
    return false;
  }
}

const fetchHandler =
  typeof serverEntry === "function" ? serverEntry : serverEntry?.fetch;

if (typeof fetchHandler !== "function") {
  console.error("server entry has no fetch handler — check dist/server/server.js");
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    if (await tryServeStatic(req, res)) return;
    const webReq = toWebRequest(req);
    const webRes = await fetchHandler(webReq);
    if (!webRes) {
      res.statusCode = 500;
      res.end("Server handler returned no response");
      return;
    }
    await sendWebResponse(webRes, res);
  } catch (err) {
    console.error("Request error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    try { res.end(`Server error: ${err?.message || "unknown"}`); } catch {}
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ENA Fees listening on http://${HOST}:${PORT}`);
});
