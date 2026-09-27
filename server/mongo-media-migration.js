import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  createMongoStorage,
  mediaFilePattern,
  mediaTypes,
} from "./mongo-storage.js";

export async function migrateLocalMedia({
  database,
  directory,
  apply = false,
}) {
  const storage = createMongoStorage(database);
  const mediaDirectory = resolve(directory, "media");
  const entries = await readdir(mediaDirectory, { withFileTypes: true });
  const names = new Set(
    entries
      .filter((entry) => entry.isFile() && mediaFilePattern.test(entry.name))
      .map((entry) => entry.name),
  );
  const metadata = new Map();
  for (const row of await database.collection("media").find({}).toArray()) {
    const name = row.url?.startsWith("/media/") ? row.url.slice(7) : "";
    if (!mediaFilePattern.test(name))
      throw new Error("Caminho inválido no catálogo de mídias.");
    names.add(name);
    metadata.set(name, row);
  }
  function collect(value) {
    if (
      typeof value === "string" &&
      value.startsWith("/media/") &&
      mediaFilePattern.test(value.slice(7))
    )
      names.add(value.slice(7));
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object")
      Object.values(value).forEach(collect);
  }
  for (const collection of [
    "contents",
    "publications",
    "playlists",
    "emergencies",
    "settings",
  ]) {
    for await (const row of database
      .collection(collection)
      .find({}, { projection: { data: 1 } }))
      if (row.data) collect(JSON.parse(row.data));
  }
  const plan = [];
  // Verify every source and existing destination before uploading anything.
  for (const name of names) {
    let bytes;
    try {
      bytes = await readFile(resolve(mediaDirectory, name));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      throw new Error(
        `Mídia ausente na origem local: ${name}. Recupere o arquivo antes de continuar.`,
      );
    }
    const hash = createHash("sha256").update(bytes).digest("hex"),
      size = bytes.length;
    const row = metadata.get(name);
    if (row && (row.hash !== hash || row.size !== size))
      throw new Error(`Mídia local diverge do catálogo: ${name}.`);
    const existing = await storage.digest(name);
    if (existing && (existing.hash !== hash || existing.size !== size))
      throw new Error(
        `Destino contém uma mídia diferente: ${name}. Nenhum arquivo foi sobrescrito.`,
      );
    plan.push({ name, hash, size, existing: !!existing });
  }
  if (apply) {
    await storage.initialize();
    for (const item of plan) {
      if (item.existing) continue;
      const bytes = await readFile(resolve(mediaDirectory, item.name));
      if (
        bytes.length !== item.size ||
        createHash("sha256").update(bytes).digest("hex") !== item.hash
      )
        throw new Error(
          "A origem mudou durante a transferência. Execute novamente com o servidor de origem parado.",
        );
      try {
        await storage.put(
          item.name,
          bytes,
          mediaTypes[item.name.split(".").pop()],
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
      const stored = await storage.digest(item.name);
      if (stored?.hash !== item.hash || stored?.size !== item.size)
        throw new Error(
          `Verificação do arquivo transferido falhou: ${item.name}.`,
        );
    }
  }
  return {
    applied: apply,
    files: plan.length,
    bytes: plan.reduce((sum, item) => sum + item.size, 0),
    alreadyPresent: plan.filter((item) => item.existing).length,
    entries: plan,
  };
}
