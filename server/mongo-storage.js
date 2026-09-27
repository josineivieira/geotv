import { GridFSBucket } from "mongodb";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const mediaFilePattern = /^[a-f0-9-]+\.(png|jpg|jpeg|webp|mp4|webm)$/;
export const mediaTypes = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};
function checkFile(file) {
  if (!mediaFilePattern.test(file))
    throw Object.assign(new Error("Arquivo inválido."), { status: 400 });
}

function byteRange(value, length) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  // Unsupported/multiple ranges are ignored, as allowed by HTTP.
  if (!match || (!match[1] && !match[2])) return null;
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return false;
    start = Math.max(0, length - suffix);
    end = length - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start >= length ||
    start > end
  )
    return false;
  return { start, end };
}

export function createMongoStorage(database) {
  const bucketName = "geotv_media";
  const bucket = new GridFSBucket(database, {
    bucketName,
    writeConcern: { w: "majority" },
  });
  const files = database.collection(`${bucketName}.files`);
  return {
    remote: true,
    kind: "gridfs",
    async initialize() {
      await files.createIndex({ filename: 1 }, { unique: true });
      await files.createIndex({ filename: 1, uploadDate: 1 });
      await database
        .collection(`${bucketName}.chunks`)
        .createIndex({ files_id: 1, n: 1 }, { unique: true });
    },
    async stat(file) {
      checkFile(file);
      return files.findOne({ filename: file });
    },
    async put(file, bytes, contentType) {
      checkFile(file);
      const upload = bucket.openUploadStream(file, {
        metadata: {
          contentType: contentType || mediaTypes[file.split(".").pop()],
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      });
      try {
        await pipeline(Readable.from([bytes]), upload);
      } catch (error) {
        // The upload has its own ObjectId. Never delete an existing file with
        // the same name when a concurrent insert hits the unique index.
        await bucket.delete(upload.id).catch(() => {});
        throw error;
      }
    },
    async digest(file) {
      checkFile(file);
      const info = await files.findOne({ filename: file });
      if (!info) return null;
      const hash = createHash("sha256");
      let size = 0;
      for await (const chunk of bucket.openDownloadStream(info._id)) {
        hash.update(chunk);
        size += chunk.length;
      }
      return { hash: hash.digest("hex"), size };
    },
    async remove(file) {
      checkFile(file);
      const info = await files.findOne({ filename: file });
      if (info) await bucket.delete(info._id);
    },
    async serve(req, res, file) {
      checkFile(file);
      const info = await files.findOne({ filename: file });
      if (!info) {
        res.writeHead(404, { "Cache-Control": "no-store" });
        res.end();
        return;
      }
      const range = byteRange(req.headers.range, info.length);
      if (range === false) {
        res.writeHead(416, {
          "Content-Range": `bytes */${info.length}`,
          "Cache-Control": "no-store",
        });
        res.end();
        return;
      }
      res.setHeader(
        "Content-Type",
        info.metadata?.contentType || mediaTypes[file.split(".").pop()],
      );
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader(
        "Content-Length",
        range ? range.end - range.start + 1 : info.length,
      );
      if (range)
        res.setHeader(
          "Content-Range",
          `bytes ${range.start}-${range.end}/${info.length}`,
        );
      res.writeHead(range ? 206 : 200);
      if (req.method === "HEAD" || info.length === 0) {
        res.end();
        return;
      }
      await pipeline(
        bucket.openDownloadStream(
          info._id,
          range ? { start: range.start, end: range.end + 1 } : {},
        ),
        res,
      );
    },
  };
}
