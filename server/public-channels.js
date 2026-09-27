import { readFileSync } from "node:fs";
import { db, audit, transaction } from "./db.js";
import { deviceSnapshot } from "./publications.js";

const template = readFileSync(
  new URL("../web/player/watch.html", import.meta.url),
  "utf8",
);
const key = (id) => `public-channel:${id}`;
const validId = (id) => /^[a-f0-9-]{36}$/.test(id);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export const publicOrigin = () =>
  new URL(
    process.env.PUBLIC_ORIGIN || `http://localhost:${process.env.PORT || 3000}`,
  ).origin;
export async function sharingStatus(id) {
  if (!validId(id)) return { enabled: false };
  const row = await db
    .prepare("SELECT data FROM settings WHERE id=?")
    .get(key(id));
  return {
    enabled: JSON.parse(row?.data || "{}").enabled === true,
    url: `${publicOrigin()}/public/watch/${id}`,
  };
}
export async function setChannelSharing(id, enabled, user) {
  if (!validId(id) || typeof enabled !== "boolean")
    throw Object.assign(new Error("Compartilhamento inválido."), {
      status: 400,
    });
  await transaction(async () => {
    if (!(await db.prepare("SELECT id FROM devices WHERE id=?").get(id)))
      throw Object.assign(new Error("TV não encontrada."), { status: 404 });
    const before = await sharingStatus(id);
    await db
      .prepare("INSERT OR IGNORE INTO settings VALUES(?,?)")
      .run(key(id), "{}");
    await db
      .prepare("UPDATE settings SET data=? WHERE id=?")
      .run(JSON.stringify({ enabled }), key(id));
    await audit(
      user,
      enabled
        ? "Ativou link público do canal"
        : "Desativou link público do canal",
      id,
      { enabled: before.enabled },
      { enabled },
    );
  });
  return sharingStatus(id);
}
export async function publicChannel(id) {
  if (!(await sharingStatus(id)).enabled) return null;
  const device = await db
    .prepare("SELECT id,name,publication_id FROM devices WHERE id=?")
    .get(id);
  if (!device?.publication_id) return null;
  const snapshot = await deviceSnapshot(device);
  if (!snapshot.version) return null;
  return {
    id: device.id,
    name: device.name,
    version: snapshot.version,
    created: snapshot.created,
    contents: snapshot.contents.map(({ author, ...content }) => content),
    settings: {
      timezone: snapshot.settings.timezone,
      transition: snapshot.settings.transition,
    },
    alerts: snapshot.alerts.map(({ id, title, message, start, end }) => ({
      id,
      title,
      message,
      start,
      end,
    })),
  };
}
export function publicChannelHtml(channel) {
  const title = `${channel.name} | GeoTV`;
  const description =
    "Acompanhe a programação da GeoTV: resultados, conquistas e novidades da GeoMarítima.";
  const url = `${publicOrigin()}/public/watch/${channel.id}`;
  const image = `${publicOrigin()}/assets/geotv-cover.png`;
  return template.replace(
    "<title>GeoTV · Canal</title>",
    `<title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="canonical" href="${escape(url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="GeoTV" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:url" content="${escape(url)}" />
    <meta property="og:image" content="${escape(image)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="GeoTV — Conectando pessoas. Movendo resultados." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(title)}" />
    <meta name="twitter:image" content="${escape(image)}" />`,
  );
}
