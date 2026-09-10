import test from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { createObjectStorage } from "../server/object-storage.js";

test("Storage privado: upload, leitura com Range, HEAD e exclusão", async () => {
  const calls = [];
  const client = {
    storage: {
      getBucket: async () => ({ data: { public: false } }),
      from: (bucket) => ({
        upload: async (...args) => {
          calls.push([bucket, "upload", ...args]);
          return {};
        },
        remove: async (files) => {
          calls.push(["remove", files]);
          return {};
        },
        createSignedUrl: async () => ({
          data: { signedUrl: "https://storage.example/private?token=secret" },
        }),
      }),
    },
  };
  const adapter = createObjectStorage({
    client,
    fetcher: async (url, options) => {
      assert.equal(options.headers.Range, "bytes=0-2");
      assert.match(url, /token=secret/);
      return new Response(
        options.method === "HEAD" ? null : new Uint8Array([1, 2, 3]),
        {
          status: 206,
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": "3",
            "Content-Range": "bytes 0-2/9",
          },
        },
      );
    },
  });
  await adapter.initialize();
  await adapter.put("abc.mp4", Buffer.from([1, 2, 3]), "video/mp4");
  for (const method of ["GET", "HEAD"]) {
    const chunks = [],
      headers = {};
    const res = new Writable({
      write(chunk, encoding, done) {
        chunks.push(chunk);
        done();
      },
    });
    res.setHeader = (k, v) => {
      headers[k] = v;
    };
    res.writeHead = (status) => assert.equal(status, 206);
    await adapter.serve(
      { method, headers: { range: "bytes=0-2" } },
      res,
      "abc.mp4",
    );
    assert.equal(Buffer.concat(chunks).length, method === "HEAD" ? 0 : 3);
    assert.equal(headers["content-range"], "bytes 0-2/9");
    assert.ok(!JSON.stringify(headers).includes("secret"));
  }
  await adapter.remove("abc.mp4");
  assert.equal(calls[0][4].upsert, false);
  assert.deepEqual(calls.at(-1), ["remove", ["abc.mp4"]]);
  await assert.rejects(adapter.put("../secret", Buffer.from([])), /inválido/);
});

test("Storage: exige configuração na nuvem, impede bucket público e trata limite", async () => {
  assert.throws(() => createObjectStorage({ required: true }), /SUPABASE_URL/);
  assert.throws(
    () => createObjectStorage({ url: "https://example.supabase.co" }),
    /juntas/,
  );
  const client = {
    storage: {
      getBucket: async () => ({ data: { public: true } }),
      from: () => ({
        upload: async () => ({
          error: { statusCode: "413", message: "secret must not leak" },
        }),
      }),
    },
  };
  const adapter = createObjectStorage({ client });
  await assert.rejects(adapter.initialize(), /privado/);
  await assert.rejects(
    adapter.put("abc.png", Buffer.from([])),
    (error) => error.status === 413 && !error.message.includes("secret"),
  );
});
