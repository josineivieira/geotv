import { createHash, randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { db, storage, now, audit, allContents } from "./db.js";
import { mediaUrls } from "../web/shared/presentation.js";
import { deviceSnapshot } from "./publications.js";
import { fail } from "./security.js";
const formats = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};
export function deleteMedia(id, user) {
  const media = db.prepare("SELECT * FROM media WHERE id=?").get(id);
  if (!media) fail(404, "Arquivo não encontrado.");
  const used = allContents().filter((content) =>
    mediaUrls(content).includes(media.url),
  );
  if (used.length)
    fail(
      409,
      "Arquivo utilizado em: " +
        used
          .slice(0, 4)
          .map((c) => c.title)
          .join(", ") +
        ". Remova ou substitua a mídia nesses conteúdos primeiro.",
    );
  for (const device of db
    .prepare("SELECT id,name,publication_id FROM devices")
    .all())
    if (
      deviceSnapshot(device).contents.some((c) =>
        mediaUrls(c).includes(media.url),
      )
    )
      fail(
        409,
        `Arquivo em exibição no canal ${device.name}. Publique a programação atualizada antes de excluir.`,
      );
  const historical = db
    .prepare("SELECT data FROM publications")
    .all()
    .some((row) =>
      JSON.parse(row.data).contents.some((c) =>
        mediaUrls(c).includes(media.url),
      ),
    );
  if (!historical) {
    const file = media.url.match(
      /^\/media\/([a-f0-9-]+\.(?:png|jpg|jpeg|webp|mp4|webm))$/,
    )?.[1];
    if (!file) fail(400, "Caminho de mídia inválido.");
    try {
      unlinkSync(resolve(storage, "media", file));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  db.prepare("DELETE FROM media WHERE id=?").run(id);
  audit(
    user,
    "Excluiu mídia",
    id,
    { name: media.name, url: media.url },
    { retainedForHistory: historical },
  );
  return { ok: true, retainedForHistory: historical };
}
export async function upload(req, user, readBody) {
  const name = decodeURIComponent(req.headers["x-file-name"] || "");
  const ext = name.split(".").pop()?.toLowerCase();
  const mime = formats[ext];
  if (!mime || req.headers["content-type"] !== mime || name.length > 200)
    fail(400, "Formato não aceito. Use JPG, PNG, WEBP, MP4 ou WEBM.");
  const data = await readBody(
    req,
    mime.startsWith("video") ? 100 * 1024 * 1024 : 10 * 1024 * 1024,
    true,
  );
  const valid =
    ext === "png"
      ? data
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : ["jpg", "jpeg"].includes(ext)
        ? data[0] === 255 && data[1] === 216 && data[2] === 255
        : ext === "webp"
          ? data.toString("ascii", 0, 4) === "RIFF" &&
            data.toString("ascii", 8, 12) === "WEBP"
          : ext === "mp4"
            ? data.toString("ascii", 4, 8) === "ftyp"
            : data.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
  if (!valid) fail(400, "O arquivo não corresponde ao formato informado.");
  const hash = createHash("sha256").update(data).digest("hex");
  const existing = db.prepare("SELECT * FROM media WHERE hash=?").get(hash);
  if (existing) return existing;
  const id = randomUUID(),
    url = `/media/${id}.${ext}`,
    path = resolve(storage, "media", `${id}.${ext}`);
  await writeFile(path, data, { flag: "wx" });
  try {
    db.prepare("INSERT INTO media VALUES(?,?,?,?,?,?,?,?)").run(
      id,
      name,
      mime,
      data.length,
      url,
      String(req.headers["x-category"] || "Geral").slice(0, 80),
      hash,
      now(),
    );
    audit(user, "Enviou mídia", id, null, { name });
  } catch (e) {
    await unlink(path);
    throw e;
  }
  return db.prepare("SELECT * FROM media WHERE id=?").get(id);
}
