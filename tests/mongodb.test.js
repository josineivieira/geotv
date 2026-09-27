import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import {
  createMongoDatabase,
  compileMongoQuery,
  mongoConnection,
} from "../server/mongo-database.js";
import { mongoTables, columns } from "../server/mongo-schema.js";
import {
  readSqliteSnapshot,
  migrateSnapshot,
  snapshotDigest,
} from "../server/mongo-migration.js";

test("MongoDB: todas as consultas de produção têm suporte e sintaxes desconhecidas falham", async () => {
  let count = 0;
  for (const file of await readdir(new URL("../server/", import.meta.url))) {
    if (!file.endsWith(".js")) continue;
    const source = await readFile(
      new URL(`../server/${file}`, import.meta.url),
      "utf8",
    );
    for (const match of source.matchAll(/\.prepare\(\s*"([^"\n]+)"/g)) {
      if (match[1].startsWith("PRAGMA")) continue;
      assert.doesNotThrow(
        () => compileMongoQuery(match[1]),
        `${file}: ${match[1]}`,
      );
      count++;
    }
  }
  assert.ok(count > 60);
  for (const sql of [
    "DELETE FROM users",
    "SELECT password FROM secrets",
    "SELECT * FROM users WHERE email=? OR 1=1",
    "UPDATE users SET role=? WHERE id=? LIMIT 1",
  ])
    assert.throws(() => compileMongoQuery(sql));
});

test("MongoDB: conexão valida senha, banco e TLS sem expor credenciais", () => {
  for (const value of [
    "mongodb+srv://user:<secret>@example.com/",
    "mongodb+srv://user:secret%ZZ@example.com/",
    "mongodb+srv://user:secret@example.com/admin",
    "mongodb+srv://user:secret@example.com/geotv?tls=false",
    "mongodb+srv://user:secret@example.com/geotv?tlsInsecure=true",
  ])
    assert.throws(
      () => mongoConnection(value),
      (error) => !error.stack.includes("secret") && !error.cause,
    );
  assert.equal(
    mongoConnection(
      "mongodb+srv://user:encoded%40password@example.com/?appName=GEOTV",
    ).name,
    "geotv",
  );
});

test(
  "MongoDB real: migração, integridade, consultas e rollback",
  { timeout: 180000 },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "geotv-mongo-"));
    const replica = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
      instanceOpts: [{ launchTimeout: 60000 }],
    });
    const databases = [];
    let sqlite, copied;
    t.after(async () => {
      copied?.close();
      sqlite?.close();
      for (const db of databases) await db.close();
      await replica.stop();
      await rm(directory, { recursive: true, force: true });
    });
    async function database(name) {
      const db = await createMongoDatabase({ url: replica.getUri(name) });
      databases.push(db);
      return db;
    }
    sqlite = new DatabaseSync(join(directory, "source.sqlite"));
    sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    sqlite.exec(
      await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
    );
    for (const table of Object.keys(mongoTables))
      assert.deepEqual(
        sqlite
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .map((row) => row.name),
        columns(table),
      );
    sqlite
      .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
      .run(
        "user",
        "Nome com ' e ?",
        "test@example.com",
        "scrypt:unchanged",
        "Administrador",
      );
    sqlite
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run("hashed-token", "user", Date.now() + 3600000);
    sqlite
      .prepare("INSERT INTO contents VALUES(?,?,?)")
      .run("content", '{"title":"Açúcar 日本語","id":"content"}', "2026-09-27");
    sqlite
      .prepare("INSERT INTO playlists VALUES(?,?)")
      .run("other", '{"id":"other"}');
    sqlite
      .prepare("INSERT INTO playlists VALUES(?,?)")
      .run("main", '{"id":"main"}');
    sqlite
      .prepare(
        "INSERT INTO devices(id,name,group_name,token,publication_id) VALUES(?,?,?,?,?)",
      )
      .run("tv", "TV", "Group", "device-token", 42);
    sqlite
      .prepare(
        "INSERT INTO publications(id,data,created,user_id) VALUES(?,?,?,?)",
      )
      .run(42, '{"contents":[]}', "2026-09-27", "user");
    sqlite
      .prepare("INSERT INTO media VALUES(?,?,?,?,?,?,?,?)")
      .run(
        "media",
        "file.png",
        "image/png",
        123,
        "/media/file.png",
        "Geral",
        "sha256",
        "2026-09-27",
      );
    sqlite.prepare("INSERT INTO emergencies VALUES(?,?)").run("alert", "{}");
    sqlite
      .prepare("INSERT INTO audit_logs VALUES(?,?,?,?,?,?,?)")
      .run(70, "user", "Test", null, null, "{}", "2026-09-27");
    sqlite
      .prepare("INSERT INTO settings VALUES(?,?)")
      .run("general", '{"name":"GeoTV"}');
    sqlite.prepare("INSERT INTO data_sources VALUES(?,?)").run("source", "{}");
    await backup(sqlite, join(directory, "backup.sqlite"));
    copied = new DatabaseSync(join(directory, "backup.sqlite"), {
      readOnly: true,
    });
    const snapshot = readSqliteSnapshot(copied);
    const originalDigest = snapshotDigest(readSqliteSnapshot(sqlite));
    assert.equal(snapshotDigest(snapshot), originalDigest);
    const db = await database("migration");
    assert.equal((await migrateSnapshot(db, snapshot)).digest, originalDigest);
    assert.equal(
      (await db.prepare("SELECT * FROM users WHERE id=?").get("user")).password,
      "scrypt:unchanged",
    );
    assert.equal(
      (
        await db
          .prepare(
            "SELECT data FROM playlists ORDER BY CASE WHEN id='main' THEN 0 ELSE 1 END, rowid LIMIT 1",
          )
          .get()
      ).data,
      '{"id":"main"}',
    );
    const sessionQuery =
      "SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?";
    assert.equal(
      (await db.prepare(sessionQuery).get("hashed-token", Date.now())).role,
      "Administrador",
    );
    assert.equal(
      await db.prepare(sessionQuery).get("hashed-token", Date.now() + 86400000),
      undefined,
    );
    assert.equal(
      (await db.prepare("SELECT count(*) AS n FROM users").get()).n,
      1,
    );
    assert.equal((await db.prepare("SELECT 1 AS ok").get()).ok, 1);
    assert.equal(
      (
        await db
          .prepare(
            "SELECT p.id,p.created,u.name AS author FROM publications p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.id DESC LIMIT 100",
          )
          .all()
      )[0].author,
      "Nome com ' e ?",
    );
    await db.transaction(async () => {
      const publication = await db
        .prepare("INSERT INTO publications(data,created,user_id) VALUES(?,?,?)")
        .run("{}", "today", "user");
      assert.equal(publication.lastInsertRowid, 43);
      const audit = await db
        .prepare(
          "INSERT INTO audit_logs(user_id,action,entity,before_value,after_value,created) VALUES(?,?,?,?,?,?)",
        )
        .run("user", "next", null, null, "{}", "today");
      assert.equal(audit.lastInsertRowid, 71);
      assert.equal(
        (
          await db
            .prepare("UPDATE devices SET publication_id=? WHERE id=?")
            .run(43, "tv")
        ).changes,
        1,
      );
    });
    await assert.rejects(
      db.transaction(async () => {
        await db.prepare("DELETE FROM devices WHERE id=?").run("tv");
        await db
          .prepare(
            "INSERT INTO publications(data,created,user_id) VALUES(?,?,?)",
          )
          .run("{}", "rollback", "user");
        throw new Error("abort");
      }),
      /abort/,
    );
    assert.equal(
      (await db.prepare("SELECT * FROM devices WHERE id=?").get("tv"))
        .publication_id,
      43,
    );
    assert.equal(
      (await db.prepare("SELECT * FROM publications").all()).length,
      2,
    );
    assert.equal(
      (
        await db
          .prepare(
            "INSERT INTO publications(data,created,user_id) VALUES(?,?,?)",
          )
          .run("{}", "after", "user")
      ).lastInsertRowid,
      44,
    );
    await db.transaction(async () => {
      await db
        .prepare("INSERT OR IGNORE INTO settings VALUES(?,?)")
        .run("general", "overwritten");
    });
    assert.equal(
      (await db.prepare("SELECT data FROM settings WHERE id='general'").get())
        .data,
      '{"name":"GeoTV"}',
    );
    assert.equal(
      (
        await db
          .prepare("UPDATE devices SET token=? WHERE id=?")
          .run("device-token", "tv")
      ).changes,
      1,
    );
    assert.equal(
      (
        await db
          .prepare("UPDATE devices SET token=? WHERE id=?")
          .run("unused", "absent")
      ).changes,
      0,
    );
    await assert.rejects(
      db
        .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
        .run("other", "Other", "test@example.com", "hash", "Editor"),
      { code: 11000 },
    );
    await assert.rejects(
      db.prepare("SELECT * FROM users WHERE email=?").get({ $ne: null }),
      /Parâmetro inválido/,
    );
    await assert.rejects(
      db.prepare("INSERT INTO sessions VALUES(?,?,?)").run("bad", "missing", 1),
      /Foreign key/,
    );
    await assert.rejects(
      migrateSnapshot(db, snapshot),
      /Destino não está vazio/,
    );
    const empty = await database("rollback");
    const invalid = structuredClone(snapshot);
    invalid.users.push({ ...invalid.users[0], id: "duplicate-email" });
    await assert.rejects(migrateSnapshot(empty, invalid), { code: 11000 });
    for (const table of Object.keys(mongoTables))
      assert.equal(await empty.database.collection(table).countDocuments(), 0);
    assert.equal(
      (await migrateSnapshot(empty, snapshot)).digest,
      originalDigest,
    );
    assert.equal(snapshotDigest(readSqliteSnapshot(sqlite)), originalDigest);
    // Concurrent bootstrap/publication transactions serialize across sessions.
    const boot = await database("concurrent");
    await Promise.all(
      [1, 2].map(() =>
        boot.transaction(async () => {
          if (!(await boot.prepare("SELECT count(*) AS n FROM users").get()).n)
            await boot
              .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
              .run(
                "first",
                "Admin",
                "first@example.com",
                "hash",
                "Administrador",
              );
        }),
      ),
    );
    assert.equal(
      (await boot.prepare("SELECT count(*) AS n FROM users").get()).n,
      1,
    );
  },
);
