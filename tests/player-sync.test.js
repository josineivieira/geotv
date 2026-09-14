import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { presentationFrames } from "../web/shared/presentation.js";

test("canal percorre as três telas de resultados antes do próximo conteúdo", async () => {
  const source = (
    await readFile(new URL("../web/player/watch.js", import.meta.url), "utf8")
  ).replace(/^import .*;\r?\n/gm, "");
  const shown = [];
  const context = vm.createContext({
    location: { pathname: "/watch/test" },
    document: { querySelector: () => ({}), addEventListener() {} },
    window: { addEventListener() {} },
    AbortSignal,
    Date,
    setInterval: () => 1,
    clearInterval() {},
    presentationFrames,
    eligible: () => true,
    createFramePresenter: () => ({
      cancel() {},
      preload() {},
      show(c, effect, done) {
        shown.push(c.id);
        done();
      },
    }),
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        version: 1,
        settings: {},
        alerts: [],
        contents: [
          {
            id: "results",
            template: "monthly-results",
            duration: 30,
            fields: {},
          },
          { id: "next", template: "notice", duration: 10, fields: {} },
        ],
      }),
    }),
  });
  vm.runInContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));
  for (let i = 0; i < 3; i++) {
    await vm.runInContext("sync()", context);
    vm.runInContext("deadline = 0; tick()", context);
  }
  assert.deepEqual(shown, [
    "results:results:0",
    "results:results:1",
    "results:results:2",
    "next",
  ]);
});

test("canal aberto recebe alterações sem recarregar e sem esperar a duração anterior", async () => {
  const source = (
    await readFile(new URL("../web/player/watch.js", import.meta.url), "utf8")
  ).replace(/^import .*;\r?\n/gm, "");
  let title = "Anterior";
  const shown = [];
  const context = vm.createContext({
    location: { pathname: "/watch/test" },
    document: { querySelector: () => ({}), addEventListener() {} },
    window: { addEventListener() {} },
    AbortSignal,
    Date,
    setInterval: () => 1,
    clearInterval() {},
    createFramePresenter: () => ({
      cancel() {},
      preload() {},
      show(c, effect, done) {
        shown.push(c.title);
        done();
      },
    }),
    eligible: () => true,
    presentationFrames: (c) => [c],
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        version: 1,
        contents: [{ id: "same", title, duration: 3600 }],
        settings: {},
        alerts: [],
      }),
    }),
  });
  vm.runInContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));
  title = "Atualizado";
  await vm.runInContext("sync()", context);
  assert.deepEqual(shown, ["Anterior", "Atualizado"]);
  await vm.runInContext("sync()", context);
  assert.equal(
    shown.length,
    2,
    "consulta sem mudanças não reinicia a reprodução",
  );
});

test("player aplica publicações sem aguardar downloads offline", async () => {
  const source = (
    await readFile(new URL("../web/player/player.js", import.meta.url), "utf8")
  ).replace(/^import .*;\r?\n/gm, "");
  const shown = [],
    requests = [];
  let version = 1;
  const context = vm.createContext({
    location: { pathname: "/tv/test", hash: "#token" },
    localStorage: { setItem() {}, getItem() {}, removeItem() {} },
    history: { replaceState() {} },
    document: {
      querySelector: () => ({ querySelector: () => null }),
      addEventListener() {},
    },
    window: { addEventListener() {}, removeEventListener() {} },
    navigator: {},
    AbortSignal,
    Date,
    setInterval: () => 1,
    clearInterval() {},
    EventSource: class {
      addEventListener() {}
      close() {}
    },
    createFramePresenter: () => ({
      cancel() {},
      preload() {},
      show(c, effect, done) {
        shown.push(c);
        done();
      },
    }),
    presentationFrames: (c) => [c],
    eligible: () => true,
    readSnapshot: async () => null,
    writeSnapshot: async () => {},
    cacheMedia: () => new Promise(() => {}),
    fetch: async (url, options) => {
      requests.push(options);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          version,
          contents: [
            { id: "same", title: `Version ${version}`, duration: 3600 },
          ],
          settings: {},
          alerts: [],
        }),
      };
    },
  });
  vm.runInContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(shown.at(-1)?.title, "Version 1");
  version = 2;
  await vm.runInContext("sync()", context);
  assert.equal(shown.at(-1)?.title, "Version 2");
  assert.equal(requests[0].cache, "no-store");
});
