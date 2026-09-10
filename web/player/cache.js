const DB_NAME = "geotv-player";
import { mediaUrls } from "/shared/presentation.js";
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("snapshots");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readSnapshot(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots");
    const request = tx.objectStore("snapshots").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
export async function writeSnapshot(id, value) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite");
    tx.objectStore("snapshots").put(value, id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function cacheMedia(snapshot) {
  const urls = [...new Set(snapshot.contents.flatMap(mediaUrls))];
  if (!urls.length) return;
  if (!("caches" in window)) {
    // HTTP on a LAN cannot use CacheStorage; online playback must still work.
    for (const url of urls) {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw new Error("Mídia indisponível");
      await response.arrayBuffer();
    }
    return;
  }
  const cache = await caches.open("geotv-media-v1");
  for (const url of urls) {
    if (await cache.match(url)) continue;
    const response = await fetch(url, {
      cache: "no-cache",
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error("Mídia indisponível");
    await cache.put(url, response);
  }
}
