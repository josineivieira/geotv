import { createHash } from "node:crypto";
import {
  mongoTables,
  columns,
  numericIds,
  primaryKey,
} from "./mongo-schema.js";

export function readSqliteSnapshot(sqlite) {
  if (sqlite.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
    throw new Error(
      "A integridade do SQLite precisa ser corrigida antes da migração.",
    );
  if (sqlite.prepare("PRAGMA foreign_key_check").all().length)
    throw new Error("O SQLite contém referências inválidas.");
  return Object.fromEntries(
    Object.keys(mongoTables).map((table) => [
      table,
      sqlite
        .prepare(
          `SELECT ${columns(table).join(",")} FROM ${table} ORDER BY rowid`,
        )
        .all()
        .map((row) => ({ ...row })),
    ]),
  );
}

export function snapshotDigest(snapshot) {
  const normalized = Object.keys(mongoTables).map((table) => [
    table,
    [...snapshot[table]]
      .sort((a, b) => {
        const key = primaryKey(table);
        return a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
      })
      .map((row) => columns(table).map((key) => row[key])),
  ]);
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export async function migrateSnapshot(target, snapshot) {
  const digest = snapshotDigest(snapshot);
  return target.transaction(async () => {
    const options = target.sessionOptions();
    // Never overwrite existing production data or merge users by email.
    for (const table of Object.keys(mongoTables)) {
      if (await target.database.collection(table).findOne({}, options))
        throw new Error(
          `Destino não está vazio (${table}). Nenhum registro foi importado.`,
        );
    }
    for (const table of Object.keys(mongoTables)) {
      const rows = snapshot[table];
      for (let start = 0; start < rows.length; start += 250) {
        await target.database.collection(table).insertMany(
          rows.slice(start, start + 250).map((row) => ({ ...row })),
          options,
        );
      }
      if (numericIds.has(table)) {
        const maximum = rows.reduce((value, row) => Math.max(value, row.id), 0);
        await target.database
          .collection("_geotv_counters")
          .updateOne({ _id: table }, { $set: { value: maximum } }, options);
      }
    }
    const imported = {};
    for (const table of Object.keys(mongoTables))
      imported[table] = await target.database
        .collection(table)
        .find({}, { ...options, projection: { _id: 0 } })
        .toArray();
    if (snapshotDigest(imported) !== digest)
      throw new Error(
        "Verificação dos dados importados falhou. Transação cancelada.",
      );
    return {
      digest,
      counts: Object.fromEntries(
        Object.entries(snapshot).map(([table, rows]) => [table, rows.length]),
      ),
    };
  });
}
