import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
export const storage = resolve(process.env.GEOTV_STORAGE || "storage");
mkdirSync(storage, { recursive: true });
mkdirSync(resolve(storage, "media"), { recursive: true });
export const db = new DatabaseSync(resolve(storage, "geotv.sqlite"));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS contents(id TEXT PRIMARY KEY,data TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS playlists(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,name TEXT NOT NULL,group_name TEXT NOT NULL,token TEXT UNIQUE NOT NULL,publication_id INTEGER,last_seen TEXT,current_content TEXT,version INTEGER DEFAULT 0,synced_at TEXT);
CREATE TABLE IF NOT EXISTS publications(id INTEGER PRIMARY KEY AUTOINCREMENT,data TEXT NOT NULL,created TEXT NOT NULL,user_id TEXT REFERENCES users(id));
CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,url TEXT NOT NULL,category TEXT NOT NULL,hash TEXT UNIQUE NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS emergencies(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT,action TEXT NOT NULL,entity TEXT,before_value TEXT,after_value TEXT,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS data_sources(id TEXT PRIMARY KEY,data TEXT NOT NULL);
`);
export const now = () => new Date().toISOString();
export const allContents = () =>
  db
    .prepare("SELECT data FROM contents ORDER BY updated DESC")
    .all()
    .map((r) => JSON.parse(r.data));
export const settings = () =>
  JSON.parse(
    db.prepare("SELECT data FROM settings WHERE id='general'").get()?.data ||
      "{}",
  );
export function audit(user, action, entity, before, after) {
  db.prepare(
    "INSERT INTO audit_logs(user_id,action,entity,before_value,after_value,created) VALUES(?,?,?,?,?,?)",
  ).run(
    user?.id || null,
    action,
    entity || null,
    JSON.stringify(before ?? null),
    JSON.stringify(after ?? null),
    now(),
  );
}
export function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
db.prepare("INSERT OR IGNORE INTO settings VALUES(?,?)").run(
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
if (!db.prepare("SELECT id FROM playlists LIMIT 1").get())
  db.prepare("INSERT OR IGNORE INTO playlists VALUES(?,?)").run(
    "main",
    JSON.stringify({ id: "main", name: "Programação corporativa", items: [] }),
  );
