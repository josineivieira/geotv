import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../web/sw.js", import.meta.url), "utf8");

async function activate(previousVersion) {
  const events = {},
    navigated = [],
    deleted = [];
  let claimed = false;
  const context = vm.createContext({
    URL,
    caches: {
      keys: async () =>
        previousVersion ? ["geotv-shell-old", "geotv-media-v1"] : [],
      delete: async (key) => deleted.push(key),
    },
    self: {
      addEventListener: (name, handler) => {
        events[name] = handler;
      },
      clients: {
        claim: async () => {
          claimed = true;
        },
        matchAll: async () =>
          ["/tv/one", "/tv/two", "/admin/"].map((path) => ({
            url: `https://geo.test${path}`,
            navigate: async (url) => {
              assert.equal(claimed, true);
              navigated.push(url);
              if (path === "/tv/one")
                throw new Error("TV fechada durante atualização");
            },
          })),
      },
    },
  });
  vm.runInContext(source, context);
  let pending;
  events.activate({
    waitUntil: (promise) => {
      pending = promise;
    },
  });
  await pending;
  return { navigated, deleted };
}

test("nova versão atualiza TVs abertas, preserva mídia offline e não navega o admin", async () => {
  const result = await activate(true);
  assert.deepEqual(result.navigated, [
    "https://geo.test/tv/one",
    "https://geo.test/tv/two",
  ]);
  assert.deepEqual(result.deleted, ["geotv-shell-old"]);
});

test("primeira instalação não provoca recarga da TV", async () => {
  const result = await activate(false);
  assert.deepEqual(result.navigated, []);
});
