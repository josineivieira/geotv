const SHELL = "geotv-shell-v12";
const files = [
  "/assets/geomaritima-logo.png",
  "/player/index.html",
  "/player/player.js",
  "/player/fullscreen.js",
  "/player/frame-presenter.js",
  "/player/player.css",
  "/player/cache.js",
  "/shared/templates.js",
  "/shared/schedule.js",
  "/shared/presentation.js",
  "/shared/client-story.js",
  "/shared/hydrology.js",
  "/shared/slides.css",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(files))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("geotv-shell-") && key !== SHELL)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin ||
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (url.pathname.startsWith("/tv/"))
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/player/index.html")),
    );
  else if (files.includes(url.pathname))
    event.respondWith(
      (async () => {
        const client = event.clientId
          ? await self.clients.get(event.clientId)
          : null;
        const player =
          client && new URL(client.url).pathname.startsWith("/tv/");
        if (!player) {
          try {
            const response = await fetch(event.request);
            if (response.ok) return response;
          } catch {}
        }
        return (await caches.match(event.request)) || fetch(event.request);
      })(),
    );
  else if (url.pathname.startsWith("/media/"))
    event.respondWith(
      (async () => {
        const cached = await caches.match(url.pathname);
        if (!cached) return fetch(event.request);
        const range = event.request.headers.get("range");
        if (!range) return cached;
        const bytes = await cached.arrayBuffer(),
          match = range.match(/^bytes=(\d+)-(\d*)$/);
        if (!match) return fetch(event.request);
        const start = Number(match[1]),
          end = match[2]
            ? Math.min(Number(match[2]), bytes.byteLength - 1)
            : bytes.byteLength - 1;
        if (start > end || start >= bytes.byteLength)
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${bytes.byteLength}` },
          });
        return new Response(bytes.slice(start, end + 1), {
          status: 206,
          headers: {
            "Content-Type": cached.headers.get("Content-Type"),
            "Content-Range": `bytes ${start}-${end}/${bytes.byteLength}`,
            "Content-Length": String(end - start + 1),
            "Accept-Ranges": "bytes",
          },
        });
      })(),
    );
});
