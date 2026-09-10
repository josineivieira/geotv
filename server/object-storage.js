import { createClient } from "@supabase/supabase-js";
import { writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const filePattern = /^[a-f0-9-]+\.(png|jpg|jpeg|webp|mp4|webm)$/;
function checkFile(file) {
  if (!filePattern.test(file))
    throw Object.assign(new Error("Arquivo inválido."), { status: 400 });
}
function storageError(error) {
  const tooLarge =
    String(error.statusCode || error.status) === "413" ||
    /maximum allowed size|exceeded.*size/i.test(error.message || "");
  return Object.assign(
    new Error(
      tooLarge
        ? "Arquivo acima do limite do Supabase Storage. Reduza o arquivo ou ajuste o limite do bucket/plano."
        : "Falha no Supabase Storage. Confira URL, chave de servidor e bucket nas variáveis do Render.",
    ),
    { status: tooLarge ? 413 : 502 },
  );
}

export function createObjectStorage({
  directory,
  url,
  key,
  bucket = "geotv-media",
  required = false,
  client,
  fetcher = fetch,
} = {}) {
  if (!url && !key && !client) {
    if (required)
      throw new Error(
        "Configure SUPABASE_URL e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) para persistir as mídias.",
      );
    return {
      remote: false,
      async initialize() {},
      async put(file, bytes) {
        checkFile(file);
        await writeFile(resolve(directory, "media", file), bytes, {
          flag: "wx",
        });
      },
      async remove(file) {
        checkFile(file);
        await unlink(resolve(directory, "media", file)).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
      },
    };
  }
  if (!client && (!url || !key))
    throw new Error(
      "Configure SUPABASE_URL e a chave de servidor do Supabase juntas.",
    );
  if (!/^[a-z0-9][a-z0-9_-]{0,99}$/.test(bucket))
    throw new Error("SUPABASE_STORAGE_BUCKET inválido.");
  if (url && new URL(url).protocol !== "https:")
    throw new Error("SUPABASE_URL deve usar HTTPS.");
  const supabase =
    client ||
    createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  const objects = supabase.storage.from(bucket);
  return {
    remote: true,
    async initialize() {
      const { data, error } = await supabase.storage.getBucket(bucket);
      if (!error) {
        if (data.public)
          throw new Error(
            "O bucket GeoTV deve ser privado. Desative Public bucket no Supabase Storage.",
          );
        return;
      }
      if (
        !/not found/i.test(error.message || "") &&
        String(error.status) !== "404" &&
        String(error.statusCode) !== "404"
      )
        throw storageError(error);
      const result = await supabase.storage.createBucket(bucket, {
        public: false,
      });
      if (result.error) {
        // Another instance might have created it during deployment.
        const check = await supabase.storage.getBucket(bucket);
        if (check.error || check.data.public) throw storageError(result.error);
      }
    },
    async put(file, bytes, contentType) {
      checkFile(file);
      const { error } = await objects.upload(file, bytes, {
        contentType,
        upsert: false,
        cacheControl: "31536000",
      });
      if (error) throw storageError(error);
    },
    async remove(file) {
      checkFile(file);
      const { error } = await objects.remove([file]);
      if (error) throw storageError(error);
    },
    async serve(req, res, file) {
      checkFile(file);
      const { data, error } = await objects.createSignedUrl(file, 60);
      if (error) {
        if (/not found|does not exist/i.test(error.message || "")) {
          res.writeHead(404);
          res.end();
          return;
        }
        throw storageError(error);
      }
      const controller = new AbortController();
      const abort = () => controller.abort();
      res.on("close", abort);
      try {
        const upstream = await fetcher(data.signedUrl, {
          method: req.method,
          headers: req.headers.range ? { Range: req.headers.range } : {},
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(120000),
          ]),
        });
        if (![200, 206, 416, 404].includes(upstream.status)) {
          await upstream.body?.cancel();
          throw storageError({});
        }
        for (const header of [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
          "etag",
          "last-modified",
        ])
          if (upstream.headers.has(header))
            res.setHeader(header, upstream.headers.get(header));
        res.setHeader(
          "Cache-Control",
          upstream.ok ? "public, max-age=31536000, immutable" : "no-store",
        );
        res.writeHead(upstream.status);
        if (req.method === "HEAD" || !upstream.body) {
          await upstream.body?.cancel();
          res.end();
        } else await pipeline(Readable.fromWeb(upstream.body), res);
      } finally {
        res.off("close", abort);
      }
    },
  };
}
