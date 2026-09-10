import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { api, json } from "./api.js";
import { storage, transaction, db } from "./db.js";
import { bootstrapAdmin } from "./security.js";
import { mediaStorage } from "./storage.js";
await mediaStorage.initialize();
await transaction(bootstrapAdmin);
const web = resolve("web");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".bcmap": "application/octet-stream",
  ".pfb": "application/octet-stream",
  ".ttf": "font/ttf",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".svg": "image/svg+xml",
};
const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
  );
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/health" && req.method === "GET") {
      try {
        await db.prepare("SELECT 1 AS ok").get();
        return json(res, 200, { ok: true });
      } catch {
        return json(res, 503, { ok: false });
      }
    }
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (!["GET", "HEAD"].includes(req.method))
      return json(res, 405, { error: "Método não permitido." });
    let route = decodeURIComponent(url.pathname);
    if (route.startsWith("/media/") && mediaStorage.remote)
      return await mediaStorage.serve(req, res, route.slice(7));
    let root = web;
    if (route.startsWith("/vendor/pdfjs/")) {
      const relative = route.slice("/vendor/pdfjs/".length);
      if (
        !/^(build\/(pdf|pdf.worker)\.mjs|cmaps\/[\w.-]+|standard_fonts\/[\w.-]+|wasm\/[\w.-]+)$/.test(
          relative,
        )
      )
        return json(res, 404, { error: "Arquivo não encontrado." });
      root = resolve("node_modules/pdfjs-dist");
      route = "/" + relative;
    }
    if (route.startsWith("/media/")) root = storage;
    else if (route.startsWith("/watch/")) route = "/player/watch.html";
    else if (route.startsWith("/tv/")) route = "/player/index.html";
    else if (route === "/" || route === "/admin") route = "/admin/index.html";
    const path = resolve(root, "." + route);
    if (!path.startsWith(root + sep))
      return json(res, 403, { error: "Acesso negado." });
    const info = await stat(path).catch(() => null);
    if (!info?.isFile())
      return json(res, 404, { error: "Arquivo não encontrado." });
    res.setHeader(
      "Content-Type",
      types[extname(path)] || "application/octet-stream",
    );
    res.setHeader(
      "Cache-Control",
      route.startsWith("/media/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );
    const range = req.headers.range;
    if (range && /^bytes=\d+-\d*$/.test(range)) {
      const [first, final] = range.slice(6).split("-");
      const start = Number(first);
      const last = final === "" ? info.size - 1 : Number(final);
      if (start >= info.size || last >= info.size || last < start) {
        res.writeHead(416, { "Content-Range": `bytes */${info.size}` });
        return res.end();
      }
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${last}/${info.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": last - start + 1,
      });
      if (req.method === "HEAD") return res.end();
      return createReadStream(path, { start, end: last }).pipe(res);
    }
    res.setHeader("Content-Length", info.size);
    if (req.method === "HEAD") return res.end();
    createReadStream(path)
      .on("error", () => res.destroy())
      .pipe(res);
  } catch (error) {
    if (!error.status) console.error(error);
    if (!res.headersSent)
      json(res, error.status || 500, {
        error: error.status
          ? error.message
          : "Não foi possível concluir. Tente novamente.",
      });
    else res.end();
  }
});
server.requestTimeout = 120000;
server.listen(
  Number(process.env.PORT) || 3000,
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `GeoTV disponível em http://localhost:${process.env.PORT || 3000}`,
    ),
);
