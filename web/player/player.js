import { createFramePresenter } from "./frame-presenter.js";
import { eligible } from "/shared/schedule.js";
import { presentationFrames } from "/shared/presentation.js";
import { readSnapshot, writeSnapshot, cacheMedia } from "./cache.js";
const id = location.pathname.split("/")[2],
  key = "geotv-token-" + id;
let token = location.hash.slice(1) || localStorage.getItem(key);
if (token) {
  localStorage.setItem(key, token);
  history.replaceState(null, "", location.pathname);
}
const screen = document.querySelector("#screen");
const presenter = createFramePresenter(screen);
let snapshot = null,
  index = -1,
  current = null,
  deadline = 0,
  events,
  syncing = false,
  syncedAt = null,
  lastBeat = 0;
let caching = false,
  pendingCache = null;
async function persist(next) {
  pendingCache = next;
  if (caching) return;
  caching = true;
  try {
    while (pendingCache && token) {
      const value = pendingCache;
      pendingCache = null;
      try {
        await cacheMedia(value);
        if (token && snapshot === value) await writeSnapshot(id, value);
      } catch {}
    }
  } finally {
    caching = false;
  }
}
async function revoke() {
  token = null;
  snapshot = null;
  events?.close();
  localStorage.removeItem(key);
  presenter.cancel();
  screen.querySelectorAll("video").forEach((video) => video.pause());
  opening("Esta TV foi desconectada. Solicite uma nova ativação.");
  await writeSnapshot(id, null).catch(() => {});
}
function opening(message) {
  presenter.cancel();
  screen.innerHTML = `<div class="opening"><strong>geo<span>tv</span><i></i></strong>${message ? "<p>" + message + "</p>" : '<div class="opening-pulse"></div>'}</div>`;
  current = null;
}
function show(content, onShown = () => {}) {
  if (current?.id === content.id && current?._version === content._version)
    return;
  presenter.show(
    content,
    content.transition || snapshot?.settings?.transition,
    () => {
      current = content;
      deadline = Date.now() + content.duration * 1000;
      onShown();
    },
  );
}
function tick() {
  if (!snapshot) return;
  const time = new Date(),
    timezone = snapshot.settings?.timezone || "America/Sao_Paulo";
  const urgent = snapshot.alerts?.find(
    (a) => new Date(a.start) <= time && time < new Date(a.end),
  );
  if (urgent) {
    show({
      id: urgent.id,
      _version: snapshot.version,
      template: "urgent",
      title: urgent.title,
      duration: 3600,
      fields: { message: urgent.message, footer: "AVISO URGENTE" },
    });
    return;
  }
  const list = snapshot.contents
    .filter((c) => eligible(c, time, timezone))
    .flatMap(presentationFrames);
  if (!list.length) {
    if (current || !screen.querySelector(".opening p"))
      opening("Canal aguardando programação.");
    return;
  }
  if (
    !current ||
    !list.some((c) => c.id === current.id) ||
    current._version !== snapshot.version ||
    Date.now() >= deadline
  ) {
    const nextIndex = (index + 1) % list.length;
    show({ ...list[nextIndex], _version: snapshot.version }, () => {
      index = nextIndex;
      presenter.preload(list[(index + 1) % list.length]);
    });
  }
}
async function sync() {
  if (syncing || !token) return;
  syncing = true;
  try {
    const response = await fetch(`/api/player/${id}/snapshot`, {
      cache: "no-store",
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) {
      await revoke();
      return;
    }
    if (!response.ok) throw new Error("Sincronização indisponível");
    const next = await response.json();
    if (!Array.isArray(next.contents) || !Number.isInteger(next.version))
      throw new Error("Programação inválida");
    if (snapshot && JSON.stringify(next) === JSON.stringify(snapshot)) return;
    if (!token) return;
    snapshot = next;
    presenter.cancel();
    current = null;
    index = -1;
    deadline = 0;
    syncedAt = new Date().toISOString();
    tick();
    // Offline downloads must never hold up a live publication or the next sync.
    void persist(next);
  } catch {
    if (!snapshot) opening("Seu canal está aguardando a primeira conexão.");
  } finally {
    syncing = false;
  }
}
async function heartbeat() {
  if (!token) return;
  const interval = (snapshot?.settings?.heartbeat || 20) * 1000;
  if (Date.now() - lastBeat < interval) return;
  lastBeat = Date.now();
  try {
    await fetch(`/api/player/${id}/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        current: current?.title || "",
        version: snapshot?.version || 0,
        syncedAt,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {}
}
async function start() {
  if (!token) {
    opening("Ative esta TV usando o link fornecido pelo administrador.");
    return;
  }
  try {
    snapshot = await readSnapshot(id);
    if (snapshot) tick();
  } catch {}
  if ("serviceWorker" in navigator)
    try {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
    } catch {}
  await sync();
  if (!token) return;
  events = new EventSource(
    `/api/player/${id}/events?token=${encodeURIComponent(token)}`,
  );
  events.addEventListener("publication", sync);
  events.addEventListener("revoked", revoke);
  heartbeat();
}
const tickTimer = setInterval(tick, 1000),
  beatTimer = setInterval(heartbeat, 5000),
  syncTimer = setInterval(sync, 5000);
window.addEventListener("online", sync);
window.addEventListener("pageshow", sync);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    tick();
    sync();
  }
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  events?.close();
  clearInterval(tickTimer);
  clearInterval(beatTimer);
  clearInterval(syncTimer);
  presenter.cancel();
  window.removeEventListener("online", sync);
});
start();
