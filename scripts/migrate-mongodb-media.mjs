import { MongoClient } from "mongodb";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mongoConnection } from "../server/mongo-database.js";
import { migrateLocalMedia } from "../server/mongo-media-migration.js";

let client;
try {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--apply", "--source-stopped"].includes(arg)))
    throw new Error("Use --apply --source-stopped para transferir as mídias.");
  const apply = args.includes("--apply");
  if (apply && !args.includes("--source-stopped"))
    throw new Error(
      "Pare a origem e use --source-stopped antes de transferir as mídias.",
    );
  const config = mongoConnection(
    process.env.MONGODB_URI || process.env.DATABASE_URL || "",
  );
  client = new MongoClient(config.url, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const directory = resolve(process.env.GEOTV_STORAGE || "storage");
  const report = await migrateLocalMedia({
    database: client.db(config.name),
    directory,
    apply,
  });
  console.log(
    JSON.stringify({
      arquivos: report.files,
      bytes: report.bytes,
      existentes: report.alreadyPresent,
      transferidos: apply ? report.files - report.alreadyPresent : 0,
    }),
  );
  if (apply) {
    const backupDirectory = resolve(directory, "backups");
    await mkdir(backupDirectory, { recursive: true });
    await writeFile(
      resolve(backupDirectory, `mongodb-media-${Date.now()}.json`),
      JSON.stringify(report, null, 2),
      { flag: "wx" },
    );
    console.log(
      "Mídias transferidas e verificadas por SHA-256. Arquivos locais preservados; relatório salvo em storage/backups.",
    );
  } else
    console.log(
      "Prévia verificada. Nenhum arquivo foi enviado. Pare a origem e use --apply --source-stopped para transferir.",
    );
} catch (error) {
  console.error(
    error.name === "Error"
      ? error.message
      : "Migração de mídias não concluída. Confira a conexão e as permissões no MongoDB. A origem foi preservada.",
  );
  process.exitCode = 1;
} finally {
  await client?.close();
}
