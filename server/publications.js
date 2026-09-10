import { db, allContents, settings, now, audit, transaction } from "./db.js";
import { fail } from "./security.js";
export const streams = new Map();
export function notify() {
  for (const response of streams.values())
    response.write("event: publication\ndata: {}\n\n");
}
export function publish(user, deviceIds, restoreId, playlistId = "main") {
  if (!Array.isArray(deviceIds) || !deviceIds.length)
    fail(400, "Selecione pelo menos uma TV.");
  for (const id of deviceIds)
    if (!db.prepare("SELECT id FROM devices WHERE id=?").get(id))
      fail(400, "TV não encontrada.");
  let snapshot;
  if (restoreId) {
    const row = db
      .prepare("SELECT data FROM publications WHERE id=?")
      .get(Number(restoreId));
    if (!row) fail(404, "Versão não encontrada.");
    snapshot = JSON.parse(row.data);
  } else {
    const row = db
      .prepare("SELECT data FROM playlists WHERE id=?")
      .get(playlistId);
    if (!row) fail(404, "Programação não encontrada.");
    const playlist = JSON.parse(row.data);
    const contents = allContents();
    snapshot = {
      playlist,
      settings: settings(),
      contents: playlist.items.map((item) => {
        const c = contents.find((c) => c.id === item.contentId);
        if (!c) fail(400, "A programação contém um conteúdo removido.");
        if (
          settings().approval &&
          c.status !== "Aprovado" &&
          c.status !== "Publicado"
        )
          fail(400, `Aprovação pendente: ${c.title}`);
        return {
          ...c,
          duration: c.slides?.length ? c.duration : item.duration || c.duration,
        };
      }),
    };
    if (!snapshot.contents.length)
      fail(400, "Adicione conteúdos à programação.");
  }
  const result = transaction(() => {
    const created = now();
    const id = Number(
      db
        .prepare("INSERT INTO publications(data,created,user_id) VALUES(?,?,?)")
        .run(JSON.stringify(snapshot), created, user.id).lastInsertRowid,
    );
    for (const device of new Set(deviceIds))
      db.prepare("UPDATE devices SET publication_id=? WHERE id=?").run(
        id,
        device,
      );
    if (!restoreId)
      for (const content of snapshot.contents) {
        const row = db
          .prepare("SELECT data FROM contents WHERE id=?")
          .get(content.id);
        const draft = JSON.parse(row.data);
        if (!["Arquivado", "Encerrado"].includes(draft.status)) {
          draft.status = "Publicado";
          db.prepare("UPDATE contents SET data=? WHERE id=?").run(
            JSON.stringify(draft),
            draft.id,
          );
        }
      }
    audit(
      user,
      restoreId ? "Restaurou versão" : "Publicou programação",
      String(id),
      null,
      { devices: deviceIds, restoreId },
    );
    return { id, created };
  });
  notify();
  return result;
}
export function deviceSnapshot(device) {
  const row = device.publication_id
    ? db
        .prepare("SELECT * FROM publications WHERE id=?")
        .get(device.publication_id)
    : null;
  const alerts = db
    .prepare("SELECT data FROM emergencies")
    .all()
    .map((r) => JSON.parse(r.data))
    .filter(
      (a) => a.devices.includes(device.id) && new Date(a.end) > new Date(),
    );
  const published = row
    ? JSON.parse(row.data)
    : { contents: [], settings: settings() };
  // Keep historical publications immutable, but never replay deleted material.
  const draft = published.playlist?.id
    ? db
        .prepare("SELECT data FROM playlists WHERE id=?")
        .get(published.playlist.id)
    : null;
  const items = draft ? JSON.parse(draft.data).items : [];
  const allowed = new Set(items.map((item) => item.contentId));
  const existing = new Set(
    db
      .prepare("SELECT id FROM contents")
      .all()
      .map((content) => content.id),
  );
  published.contents = published.contents.filter(
    (content) => allowed.has(content.id) && existing.has(content.id),
  );
  if (published.playlist)
    published.playlist = {
      ...published.playlist,
      items: published.playlist.items.filter(
        (item) => allowed.has(item.contentId) && existing.has(item.contentId),
      ),
    };
  return {
    version: row?.id || 0,
    created: row?.created || null,
    device: { id: device.id, name: device.name },
    ...published,
    alerts,
  };
}
