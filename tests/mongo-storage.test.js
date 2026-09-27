import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createMongoStorage } from "../server/mongo-storage.js";
import { migrateLocalMedia } from "../server/mongo-media-migration.js";

test(
  "GridFS: arquivos persistentes, vídeo por intervalos e migração verificada",
  { timeout: 180000 },
  async (t) => {
    const replica = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      instanceOpts: [{ launchTimeout: 60000 }],
    });
    const client = new MongoClient(replica.getUri("storage"));
    const directory = await mkdtemp(join(tmpdir(), "geotv-gridfs-"));
    let server;
    t.after(async () => {
      if (server) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      await client.close();
      await replica.stop();
      await rm(directory, { recursive: true, force: true });
    });
    await client.connect();
    const database = client.db("storage"),
      adapter = createMongoStorage(database);
    await adapter.initialize();
    const bytes = Buffer.alloc(1024 * 1024 + 19);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
    await adapter.put("abc.mp4", bytes, "video/mp4");
    assert.deepEqual(await adapter.digest("abc.mp4"), {
      size: bytes.length,
      hash: createHash("sha256").update(bytes).digest("hex"),
    });
    const chunks = await database
      .collection("geotv_media.chunks")
      .countDocuments();
    assert.ok(chunks > 1);
    await assert.rejects(
      adapter.put("abc.mp4", Buffer.from("replacement"), "video/mp4"),
      { code: 11000 },
    );
    assert.equal(
      await database.collection("geotv_media.chunks").countDocuments(),
      chunks,
    );
    assert.equal((await adapter.stat("abc.mp4")).length, bytes.length);
    await assert.rejects(adapter.put("../private", bytes), { status: 400 });
    // A new adapter reads the same persisted data, without any local files.
    const reader = createMongoStorage(database);
    await reader.initialize();
    server = createServer((req, res) => {
      reader.serve(req, res, req.url.slice(1)).catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const full = await fetch(base + "/abc.mp4");
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("content-type"), "video/mp4");
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes);
    for (const [range, start, end] of [
      ["bytes=0-2", 0, 2],
      ["bytes=260000-270000", 260000, 270000],
      ["bytes=-7", bytes.length - 7, bytes.length - 1],
      [`bytes=${bytes.length - 3}-`, bytes.length - 3, bytes.length - 1],
      ["bytes=0-99999999", 0, bytes.length - 1],
    ]) {
      const response = await fetch(base + "/abc.mp4", {
        headers: { Range: range },
      });
      assert.equal(response.status, 206);
      assert.equal(
        response.headers.get("content-range"),
        `bytes ${start}-${end}/${bytes.length}`,
      );
      assert.deepEqual(
        Buffer.from(await response.arrayBuffer()),
        bytes.subarray(start, end + 1),
      );
    }
    for (const range of ["bytes=99999999-", "bytes=5-2", "bytes=-0"]) {
      const response = await fetch(base + "/abc.mp4", {
        headers: { Range: range },
      });
      assert.equal(response.status, 416);
      await response.arrayBuffer();
    }
    for (const range of [undefined, "bytes=1-8"]) {
      const response = await fetch(base + "/abc.mp4", {
        method: "HEAD",
        headers: range ? { Range: range } : {},
      });
      assert.equal(response.status, range ? 206 : 200);
      assert.equal(
        Number(response.headers.get("content-length")),
        range ? 8 : bytes.length,
      );
      assert.equal((await response.arrayBuffer()).byteLength, 0);
    }
    await adapter.remove("abc.mp4");
    await adapter.remove("abc.mp4");
    assert.equal(
      await database.collection("geotv_media.chunks").countDocuments(),
      0,
    );
    const missing = await fetch(base + "/abc.mp4");
    assert.equal(missing.status, 404);
    await missing.arrayBuffer();

    await mkdir(join(directory, "media"));
    const image = Buffer.from("local image"),
      history = Buffer.from("historical video");
    await writeFile(join(directory, "media", "abc.png"), image);
    await writeFile(join(directory, "media", "def.mp4"), history);
    await database.collection("media").insertOne({
      url: "/media/abc.png",
      size: image.length,
      hash: createHash("sha256").update(image).digest("hex"),
    });
    await database.collection("publications").insertOne({
      data: JSON.stringify({
        contents: [{ fields: { media: "/media/def.mp4" } }],
      }),
    });
    const preview = await migrateLocalMedia({ database, directory });
    assert.equal(preview.files, 2);
    assert.equal(
      await database.collection("geotv_media.files").countDocuments(),
      0,
    );
    const result = await migrateLocalMedia({
      database,
      directory,
      apply: true,
    });
    assert.equal(result.files, 2);
    assert.equal(result.alreadyPresent, 0);
    assert.equal(
      (await migrateLocalMedia({ database, directory, apply: true }))
        .alreadyPresent,
      2,
    );
    assert.deepEqual(
      await readFile(join(directory, "media", "abc.png")),
      image,
    );
    await writeFile(join(directory, "media", "abc.png"), "corrupted");
    await assert.rejects(
      migrateLocalMedia({ database, directory, apply: true }),
      /diverge do catálogo/,
    );
    assert.equal(
      (await adapter.digest("abc.png")).hash,
      createHash("sha256").update(image).digest("hex"),
    );
    await writeFile(join(directory, "media", "abc.png"), image);
    await database
      .collection("publications")
      .insertOne({ data: JSON.stringify({ media: "/media/dead.mp4" }) });
    await assert.rejects(
      migrateLocalMedia({ database, directory, apply: true }),
      /Mídia ausente/,
    );
    assert.equal(
      await database.collection("geotv_media.files").countDocuments(),
      2,
    );
  },
);
