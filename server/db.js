import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDatabase, postgresConnection, postgresSql } from "./database.js";
export const storage = resolve(process.env.GEOTV_STORAGE || "storage");
mkdirSync(storage, { recursive: true });
mkdirSync(resolve(storage, "media"), { recursive: true });
if (process.env.RENDER && !process.env.DATABASE_URL)
  throw new Error(
    "Configure DATABASE_URL no Render. SQLite local não será usado na nuvem.",
  );
export const db = createDatabase(
  process.env.DATABASE_URL
    ? postgresConnection(process.env.DATABASE_URL, process.env.DATABASE_CA_CERT)
    : { filename: resolve(storage, "geotv.sqlite") },
);
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
export const now = () => new Date().toISOString();
export const allContents = async () =>
  (
    await db.prepare("SELECT data FROM contents ORDER BY updated DESC").all()
  ).map((r) => JSON.parse(r.data));
export const settings = async () =>
  JSON.parse(
    (await db.prepare("SELECT data FROM settings WHERE id='general'").get())
      ?.data || "{}",
  );
export async function audit(user, action, entity, before, after) {
  await db
    .prepare(
      "INSERT INTO audit_logs(user_id,action,entity,before_value,after_value,created) VALUES(?,?,?,?,?,?)",
    )
    .run(
      user?.id || null,
      action,
      entity || null,
      JSON.stringify(before ?? null),
      JSON.stringify(after ?? null),
      now(),
    );
}
export const transaction = (fn) => db.transaction(fn);
if (db.kind === "sqlite")
  await db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
await transaction(async () => {
  if (db.kind === "postgres") {
    await db.exec(
      "CREATE SCHEMA IF NOT EXISTS geotv; REVOKE ALL ON SCHEMA geotv FROM PUBLIC;",
    );
    await db.exec(
      postgresSql(schema)
        .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, "SERIAL PRIMARY KEY")
        .replace(/expires INTEGER/g, "expires BIGINT"),
    );
  } else await db.exec(schema);
  await db.prepare("INSERT OR IGNORE INTO settings VALUES(?,?)").run(
    "general",
    JSON.stringify({
      name: "GeoTV",
      duration: 20,
      transition: "fade",
      heartbeat: 20,
      timezone: "America/Sao_Paulo",
      approval: false,
    }),
  );
  if (!(await db.prepare("SELECT id FROM playlists LIMIT 1").get()))
    await db.prepare("INSERT OR IGNORE INTO playlists VALUES(?,?)").run(
      "main",
      JSON.stringify({
        id: "main",
        name: "Programação corporativa",
        items: [],
      }),
    );
});
