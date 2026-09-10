import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  createDatabase,
  postgresSql,
  postgresConnection,
} from "../server/database.js";

test("PostgreSQL: schema, parâmetros, sessões, publicação e rollback", async () => {
  const engine = new PGlite();
  // PGlite executes real PostgreSQL SQL. Adapt its transport to node-postgres.
  const connection = {
    async query(sql, args) {
      if (/pg_advisory_xact_lock/.test(sql)) return { rows: [], rowCount: 1 };
      const result = args
        ? await engine.query(sql, args)
        : (await engine.exec(sql)).at(-1);
      return { rows: result?.rows || [], rowCount: result?.affectedRows || 0 };
    },
    release() {},
  };
  const db = createDatabase({
    pool: {
      ...connection,
      connect: async () => connection,
      end: () => engine.close(),
    },
  });
  try {
    await db.exec("CREATE SCHEMA geotv");
    const schema = await readFile(
      new URL("../server/schema.sql", import.meta.url),
      "utf8",
    );
    await db.exec(
      postgresSql(schema)
        .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, "SERIAL PRIMARY KEY")
        .replace(/expires INTEGER/g, "expires BIGINT"),
    );
    await db
      .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
      .run(
        "admin",
        "Nome ' com ?",
        "admin@test.local",
        "hash",
        "Administrador",
      );
    assert.equal(
      (await db.prepare("SELECT * FROM users WHERE id=?").get("admin")).name,
      "Nome ' com ?",
    );
    await db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run("token", "admin", Date.now() + 10000);
    assert.equal(
      (
        await db
          .prepare(
            "SELECT u.id,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
          )
          .get("token", Date.now())
      ).role,
      "Administrador",
    );
    await db
      .prepare("INSERT OR IGNORE INTO settings VALUES(?,?)")
      .run("general", "{}");
    await db
      .prepare("INSERT OR IGNORE INTO settings VALUES(?,?)")
      .run("general", "changed");
    assert.equal(
      (await db.prepare("SELECT data FROM settings WHERE id='general'").get())
        .data,
      "{}",
    );
    await db.prepare("INSERT INTO playlists VALUES(?,?)").run("main", "{}");
    assert.equal(
      (
        await db
          .prepare(
            "SELECT data FROM playlists ORDER BY CASE WHEN id='main' THEN 0 ELSE 1 END, rowid LIMIT 1",
          )
          .get()
      ).data,
      "{}",
    );
    const result = await db.transaction(async () => {
      const row = await db
        .prepare("INSERT INTO publications(data,created,user_id) VALUES(?,?,?)")
        .run("{}", new Date().toISOString(), "admin");
      await db
        .prepare(
          "INSERT INTO devices(id,name,group_name,token) VALUES(?,?,?,?)",
        )
        .run("tv", "Canal", "Geral", "tv-token");
      await db
        .prepare("UPDATE devices SET publication_id=? WHERE id=?")
        .run(row.lastInsertRowid, "tv");
      return row;
    });
    assert.equal(typeof result.lastInsertRowid, "number");
    assert.equal(
      (await db.prepare("SELECT * FROM devices WHERE id=?").get("tv"))
        .publication_id,
      result.lastInsertRowid,
    );
    assert.equal(
      (
        await db
          .prepare("UPDATE devices SET token=? WHERE id=?")
          .run("x", "missing")
      ).changes,
      0,
    );
    await assert.rejects(
      db.transaction(async () => {
        await db.prepare("DELETE FROM devices WHERE id=?").run("tv");
        throw new Error("rollback");
      }),
      /rollback/,
    );
    assert.equal((await db.prepare("SELECT * FROM devices").all()).length, 1);
    await assert.rejects(
      db
        .prepare("INSERT INTO sessions VALUES(?,?,?)")
        .run("invalid", "missing", 123),
      /foreign key/i,
    );
  } finally {
    await db.close();
  }
});

test("SQLite: uma transação assíncrona não incorpora consultas de outra requisição", async () => {
  const db = createDatabase({ filename: ":memory:" });
  await db.exec("CREATE TABLE items(id TEXT PRIMARY KEY)");
  let release, entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const failed = db.transaction(async () => {
    await db.prepare("INSERT INTO items VALUES(?)").run("rolled-back");
    entered();
    await gate;
    throw new Error("rollback");
  });
  const checked = assert.rejects(failed, /rollback/);
  await ready;
  const other = db.prepare("INSERT INTO items VALUES(?)").run("kept");
  release();
  await checked;
  await other;
  assert.deepEqual(
    (await db.prepare("SELECT id FROM items").all()).map((r) => r.id),
    ["kept"],
  );
  await db.close();
});

test("TLS não pode ser desativado por parâmetros de DATABASE_URL", () => {
  const config = postgresConnection(
    "postgresql://user:password@localhost:6543/postgres?sslmode=no-verify&pgbouncer=true",
  );
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(new URL(config.url).search, "");
  assert.equal(
    postgresSql("SELECT '?' AS literal FROM contents WHERE id=?"),
    "SELECT '?' AS literal FROM geotv.contents WHERE id=$1",
  );
});

test("URL inválida não expõe credenciais e senha codificada é preservada", () => {
  for (const raw of [
    "postgresql://user:dummy-secret#value@host:6543/postgres",
    "postgresql://user:dummy-secret%ZZ@host:6543/postgres",
    '"postgresql://user:dummy-secret@host:6543/postgres"',
  ]) {
    assert.throws(
      () => postgresConnection(raw),
      (error) => {
        assert.match(error.message, /DATABASE_URL inválida/);
        assert.ok(!error.stack.includes("dummy-secret"));
        assert.equal(error.cause, undefined);
        assert.equal(error.input, undefined);
        return true;
      },
    );
  }
  const password = "sample#@$%/?";
  const raw = `postgresql://user:${encodeURIComponent(password)}@host:6543/postgres`;
  assert.equal(
    decodeURIComponent(new URL(postgresConnection(raw).url).password),
    password,
  );
});

test("transações PostgreSQL usam a mesma conexão e liberam após falha", async () => {
  const calls = [];
  const client = {
    query: async (sql) => {
      calls.push(sql);
      return { rows: [], rowCount: 0 };
    },
    release: () => calls.push("release"),
  };
  const db = createDatabase({
    pool: {
      connect: async () => client,
      query: () => {
        throw new Error("pool não pode executar transação");
      },
    },
  });
  await assert.rejects(
    db.transaction(async () => {
      await db.prepare("DELETE FROM contents WHERE id=?").run("id");
      throw new Error("abort");
    }),
    /abort/,
  );
  assert.deepEqual(calls, [
    "BEGIN",
    "SELECT pg_advisory_xact_lock(714025, 1)",
    "DELETE FROM geotv.contents WHERE id=$1",
    "ROLLBACK",
    "release",
  ]);
});
