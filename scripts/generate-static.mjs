/**
 * Netlify static build helper.
 *
 * TanStack Start is an SSR framework — it doesn't emit dist/client/index.html
 * by default. This script:
 *   1. Imports the compiled SSR server entry.
 *   2. Renders the /login route (no auth cookie → no MongoDB call).
 *   3. Writes the resulting HTML to dist/client/index.html.
 *
 * That file becomes the Netlify publish entry point. All server function
 * requests (/_server/*) are proxied to EC2 via netlify.toml redirects.
 *
 * Usage (added automatically via build:netlify):
 *   node scripts/generate-static.mjs
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Set placeholder env vars BEFORE importing the server bundle.
// db.ts reads process.env.MONGO_URI at module load time; the actual
// getDb() call only happens inside request handlers, which we never
// trigger for the unauthenticated login render.
if (!process.env.MONGO_URI)
  process.env.MONGO_URI = "mongodb://placeholder:27017/fmsena";
if (!process.env.MONGO_DB_NAME) process.env.MONGO_DB_NAME = "fmsena";
if (!process.env.JWT_SECRET)
  process.env.JWT_SECRET = "static-gen-placeholder-not-used";

// TanStack Start emits dist/server/index.js (not server.js)
const serverPath = resolve(__dirname, "../dist/server/index.js");

let serverEntry;
try {
  serverEntry = await import(serverPath);
} catch (err) {
  console.error("✗ Failed to import dist/server/server.js:", err.message);
  console.error("  Make sure you ran `npm run build` first.");
  process.exit(1);
}

// TanStack Start's server entry exports a fetch handler either as the
// default export itself or as default.fetch.
const fetchHandler =
  typeof serverEntry.default === "function"
    ? serverEntry.default
    : serverEntry.default?.fetch;

if (typeof fetchHandler !== "function") {
  console.error("✗ Server entry has no fetch() handler. Check dist/server/server.js.");
  process.exit(1);
}

// Render /login with no auth cookie.
// beforeLoad in login.tsx calls getSessionFn() → readAuthCookie() returns
// null immediately → no MongoDB connection is made.
const req = new Request("http://localhost:3000/login", {
  headers: {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "User-Agent": "netlify-static-gen/1.0",
  },
});

let html;
try {
  const res = await fetchHandler(req);
  html = await res.text();
} catch (err) {
  console.error("✗ SSR render failed:", err.message);
  process.exit(1);
}

const looks_like_html =
  html.includes("<!DOCTYPE html>") || html.includes("<html");
if (!looks_like_html) {
  console.error(
    "✗ Rendered output does not look like HTML:",
    html.slice(0, 300),
  );
  process.exit(1);
}

const outPath = resolve(__dirname, "../dist/client/index.html");
await writeFile(outPath, html, "utf-8");
console.log(
  `✓ Generated dist/client/index.html (${(html.length / 1024).toFixed(1)} KB)`,
);
console.log("  Netlify will serve this as the SPA entry point.");
