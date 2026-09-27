import { DatabaseSync, backup } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createMongoDatabase } from "../server/mongo-database.js";
import {
  readSqliteSnapshot,
  migrateSnapshot,
  snapshotDigest,
} from "../server/mongo-migration.js";

const args = process.argv.slice(2);
if (args.some((arg) => !["--apply", "--source-stopped"].includes(arg)))
  throw new Error("Use npm run migrate:mongodb -- [--apply --source-stopped].");
const apply = args.includes("--apply");
const directory = resolve(process.env.GEOTV_STORAGE || "storage");
const filename = resolve(
  process.env.MIGRATION_SQLITE_PATH || resolve(directory, "geotv.sqlite"),
);
let source, snapshotDb, target;
try {
  if (apply && !args.includes("--source-stopped"))
    throw new Error(
      "Pare o servidor de origem e confirme com --source-stopped para evitar alterações durante a transferência.",
    );
  source = new DatabaseSync(filename, { readOnly: true });
  let snapshot;
  if (apply) {
    const backupDirectory = resolve(directory, "backups");
    await mkdir(backupDirectory, { recursive: true });
    const backupFile = resolve(
      backupDirectory,
      `before-mongodb-${Date.now()}.sqlite`,
    );
    await backup(source, backupFile);
    console.log(`Backup consistente criado: ${backupFile}`);
    snapshotDb = new DatabaseSync(backupFile, { readOnly: true });
    snapshot = readSqliteSnapshot(snapshotDb);
  } else {
    source.exec("BEGIN");
    try {
      snapshot = readSqliteSnapshot(source);
    } finally {
      source.exec("ROLLBACK");
    }
  }
  console.table(
    Object.entries(snapshot).map(([collection, rows]) => ({
      collection,
      registros: rows.length,
    })),
  );
  console.log(`SHA-256 dos dados: ${snapshotDigest(snapshot)}`);
  if (apply) {
    if (!process.env.MONGODB_URI)
      throw new Error("Configure MONGODB_URI no .env antes de importar.");
    target = await createMongoDatabase({ url: process.env.MONGODB_URI });
    const result = await migrateSnapshot(target, snapshot);
    console.log(`Importação concluída e verificada. SHA-256: ${result.digest}`);
    console.log(
      "Transfira também as mídias com npm run migrate:mongodb-media -- --apply --source-stopped. Depois use a mesma conexão em DATABASE_URL e reinicie o servidor.",
    );
  } else
    console.log(
      "Prévia concluída. Nenhum dado foi enviado ao MongoDB. Para importar, pare a origem e use --apply --source-stopped.",
    );
} catch (error) {
  // Driver errors can contain values from duplicate keys. Keep credentials,
  // password hashes and application data out of command output.
  console.error(
    error.name === "Error"
      ? error.message
      : "Migração não concluída. Confira conexão, permissões e integridade dos dados; a origem foi preservada.",
  );
  process.exitCode = 1;
} finally {
  await target?.close();
  snapshotDb?.close();
  source?.close();
}
