import { AsyncLocalStorage } from "node:async_hooks";
import { MongoClient } from "mongodb";
import {
  mongoTables,
  numericIds,
  primaryKey,
  columns,
  field,
  mongoValidator,
} from "./mongo-schema.js";

export function mongoConnection(raw) {
  try {
    const url = new URL(raw.trim());
    if (
      !["mongodb:", "mongodb+srv:"].includes(url.protocol) ||
      !url.hostname ||
      url.hash ||
      raw.includes("<") ||
      raw.includes(">")
    )
      throw new Error();
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
    const name = decodeURIComponent(url.pathname.slice(1)) || "geotv";
    if (
      !/^[a-zA-Z0-9_-]{1,63}$/.test(name) ||
      ["admin", "local", "config"].includes(name)
    )
      throw new Error();
    for (const [key, value] of url.searchParams) {
      if (
        (["tls", "ssl"].includes(key.toLowerCase()) && value === "false") ||
        ([
          "tlsinsecure",
          "tlsallowinvalidcertificates",
          "tlsallowinvalidhostnames",
        ].includes(key.toLowerCase()) &&
          value !== "false")
      )
        throw new Error();
    }
    return { url: url.toString(), name };
  } catch {
    throw new Error(
      "Conexão MongoDB inválida. Configure a senha real, codifique caracteres especiais e use o banco /geotv. Não desative a verificação TLS.",
    );
  }
}

// This is deliberately a restricted adapter for GeoTV's application-owned SQL,
// not a general SQL engine. Unsupported syntax fails instead of being ignored.
export function compileMongoQuery(sql) {
  if (sql === "SELECT 1 AS ok") return { type: "ping" };
  if (sql.startsWith("SELECT u.")) {
    const match = sql.match(
      /^SELECT (u\.[a-z]+(?:,u\.[a-z]+)*) FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=\? AND s.expires>\?$/,
    );
    if (match)
      return {
        type: "session",
        fields: match[1].split(",").map((v) => field("users", v.slice(2))),
      };
  }
  if (
    sql ===
    "SELECT p.id,p.created,u.name AS author FROM publications p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.id DESC LIMIT 100"
  )
    return {
      type: "authors",
      table: "publications",
      fields: ["id", "created"],
    };
  if (
    sql ===
    "SELECT a.*,u.name AS author FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100"
  )
    return {
      type: "authors",
      table: "audit_logs",
      fields: columns("audit_logs"),
    };
  if (
    sql ===
    "SELECT data FROM playlists ORDER BY CASE WHEN id='main' THEN 0 ELSE 1 END, rowid LIMIT 1"
  )
    return { type: "playlist" };
  let match = sql.match(
    /^INSERT( OR IGNORE)? INTO ([a-z_]+)(?:\(([a-z_,]+)\))? VALUES\((\?(?:,\?)*)\)$/,
  );
  if (match) {
    const table = match[2],
      names = match[3]
        ? match[3].split(",").map((v) => field(table, v))
        : columns(table);
    if (names.length !== match[4].split(",").length)
      throw new Error("Quantidade de parâmetros inválida.");
    return { type: "insert", table, fields: names, ignore: !!match[1] };
  }
  match = sql.match(
    /^SELECT (\*|count\(\*\) AS n|[a-z_,]+) FROM ([a-z_]+)(?: WHERE (.*?))?(?: ORDER BY ([a-z_]+)( DESC)?)?(?: LIMIT ([1-9][0-9]*))?$/,
  );
  if (match) {
    const table = match[2];
    columns(table);
    return {
      type: "select",
      table,
      fields:
        match[1] === "*"
          ? columns(table)
          : match[1] === "count(*) AS n"
            ? null
            : match[1].split(",").map((v) => field(table, v)),
      where: conditions(table, match[3]),
      sort: match[4]
        ? {
            [match[4] === "rowid" ? "_id" : field(table, match[4])]: match[5]
              ? -1
              : 1,
          }
        : undefined,
      limit: Number(match[6]) || undefined,
    };
  }
  match = sql.match(
    /^UPDATE ([a-z_]+) SET ([a-z_]+=\?(?:,[a-z_]+=\?)*) WHERE (.+)$/,
  );
  if (match)
    return {
      type: "update",
      table: match[1],
      fields: match[2].split(",").map((v) => field(match[1], v.slice(0, -2))),
      where: conditions(match[1], match[3]),
    };
  match = sql.match(/^DELETE FROM ([a-z_]+) WHERE (.+)$/);
  if (match)
    return {
      type: "delete",
      table: match[1],
      where: conditions(match[1], match[2]),
    };
  throw new Error("Consulta não suportada pelo adaptador MongoDB.");
}

function conditions(table, where) {
  columns(table);
  return where
    ? where.split(" AND ").map((part) => {
        const match = part.match(/^([a-z_]+)(=|<|>)(\?|'general')$/);
        if (!match) throw new Error("Filtro não suportado.");
        return {
          field: field(table, match[1]),
          operator: { "=": "$eq", "<": "$lt", ">": "$gt" }[match[2]],
          bound: match[3] === "?",
        };
      })
    : [];
}
function parameters(args) {
  let index = 0;
  return {
    next() {
      if (index >= args.length) throw new Error("Parâmetro ausente.");
      const value = args[index++];
      if (value !== null && !["string", "number"].includes(typeof value))
        throw new Error("Parâmetro inválido.");
      return value;
    },
    end() {
      if (index !== args.length) throw new Error("Parâmetros excedentes.");
    },
  };
}
function filter(query, params) {
  const parts = query.where.map((item) => ({
    [item.field]: { [item.operator]: item.bound ? params.next() : "general" },
  }));
  return parts.length ? { $and: parts } : {};
}
const project = (fields) =>
  Object.fromEntries([["_id", 0], ...fields.map((v) => [v, 1])]);

export async function createMongoDatabase({
  url,
  client: suppliedClient,
  name: suppliedName,
}) {
  const config = mongoConnection(url);
  const client =
    suppliedClient ||
    new MongoClient(config.url, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 15000,
    });
  const database = client.db(suppliedName || config.name);
  const context = new AsyncLocalStorage();
  const options = () =>
    context.getStore() ? { session: context.getStore() } : {};
  async function execute(query, args, mode) {
    const params = parameters(args);
    if (query.type === "ping") {
      params.end();
      await database.command({ ping: 1 }, options());
      return [{ ok: 1 }];
    }
    if (query.type === "session") {
      const token = params.next(),
        expires = params.next();
      params.end();
      return database
        .collection("sessions")
        .aggregate(
          [
            { $match: { token: { $eq: token }, expires: { $gt: expires } } },
            {
              $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "id",
                as: "user",
              },
            },
            { $unwind: "$user" },
            { $replaceWith: "$user" },
            { $project: project(query.fields) },
          ],
          options(),
        )
        .toArray();
    }
    if (query.type === "authors") {
      params.end();
      return database
        .collection(query.table)
        .aggregate(
          [
            { $sort: { id: -1 } },
            { $limit: 100 },
            {
              $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "id",
                as: "authorUser",
              },
            },
            {
              $set: {
                author: {
                  $ifNull: [{ $arrayElemAt: ["$authorUser.name", 0] }, null],
                },
              },
            },
            { $project: project([...query.fields, "author"]) },
          ],
          options(),
        )
        .toArray();
    }
    if (query.type === "playlist") {
      params.end();
      return database
        .collection("playlists")
        .aggregate(
          [
            { $set: { priority: { $cond: [{ $eq: ["$id", "main"] }, 0, 1] } } },
            { $sort: { priority: 1, _id: 1 } },
            { $limit: 1 },
            { $project: { _id: 0, data: 1 } },
          ],
          options(),
        )
        .toArray();
    }
    const collection = database.collection(query.table);
    if (query.type === "insert") {
      const row = Object.fromEntries(
        columns(query.table).map((key) => [
          key,
          query.table === "devices" && key === "version" ? 0 : null,
        ]),
      );
      for (const key of query.fields) row[key] = params.next();
      params.end();
      if (
        ["sessions", "publications"].includes(query.table) &&
        row.user_id !== null &&
        !(await database
          .collection("users")
          .findOne({ id: { $eq: row.user_id } }, options()))
      )
        throw new Error("Foreign key: usuário inexistente.");
      if (query.ignore) {
        // Only bootstrap settings/playlists use IGNORE; upsert avoids aborting
        // a MongoDB transaction by deliberately provoking a duplicate key.
        if (!["settings", "playlists"].includes(query.table))
          throw new Error("INSERT OR IGNORE não suportado nesta coleção.");
        const result = await collection.updateOne(
          { [primaryKey(query.table)]: { $eq: row[primaryKey(query.table)] } },
          { $setOnInsert: row },
          { ...options(), upsert: true },
        );
        return { changes: result.upsertedCount };
      }
      if (numericIds.has(query.table) && row.id === null) {
        const counter = await database
          .collection("_geotv_counters")
          .findOneAndUpdate(
            { _id: query.table },
            { $inc: { value: 1 } },
            {
              ...options(),
              returnDocument: "after",
              includeResultMetadata: false,
            },
          );
        row.id = counter.value;
      }
      await collection.insertOne(row, options());
      return {
        changes: 1,
        lastInsertRowid: numericIds.has(query.table) ? row.id : undefined,
      };
    }
    const update = {};
    if (query.type === "update")
      for (const key of query.fields) update[key] = params.next();
    const where = filter(query, params);
    params.end();
    if (query.type === "select") {
      if (!query.fields)
        return [{ n: await collection.countDocuments(where, options()) }];
      return collection
        .find(where, {
          ...options(),
          projection: project(query.fields),
          ...(query.sort ? { sort: query.sort } : {}),
          ...(mode === "get" || query.limit
            ? { limit: mode === "get" ? 1 : query.limit }
            : {}),
        })
        .toArray();
    }
    if (query.type === "update")
      return {
        changes: (
          await collection.updateMany(where, { $set: update }, options())
        ).matchedCount,
      };
    return {
      changes: (await collection.deleteMany(where, options())).deletedCount,
    };
  }
  const adapter = {
    kind: "mongodb",
    database,
    sessionOptions: options,
    async initialize() {
      for (const table of Object.keys(mongoTables)) {
        try {
          await database.createCollection(table, {
            validator: mongoValidator(table),
          });
        } catch (error) {
          if (error.code !== 48) throw error;
        }
        await database
          .collection(table)
          .createIndex({ [primaryKey(table)]: 1 }, { unique: true });
      }
      for (const [table, key] of [
        ["users", "email"],
        ["devices", "token"],
        ["media", "hash"],
      ])
        await database
          .collection(table)
          .createIndex({ [key]: 1 }, { unique: true });
      await database.collection("media").createIndex({ url: 1 });
      await database.collection("sessions").createIndex({ expires: 1 });
      for (const id of [...numericIds, "transaction"])
        await database
          .collection("_geotv_counters")
          .updateOne(
            { _id: id },
            { $setOnInsert: { value: 0 } },
            { upsert: true },
          );
    },
    prepare(sql) {
      const query = compileMongoQuery(sql);
      return Object.fromEntries(
        ["get", "all", "run"].map((mode) => [
          mode,
          async (...args) => {
            const result = await execute(query, args, mode);
            return mode === "get" ? result[0] : result;
          },
        ]),
      );
    },
    async transaction(fn) {
      if (context.getStore())
        throw new Error("Transação aninhada não suportada.");
      const session = client.startSession();
      try {
        return await session.withTransaction(
          () =>
            context.run(session, async () => {
              // Equivalent to the PostgreSQL advisory lock: competing app
              // transactions conflict here and retry with a fresh snapshot.
              await database
                .collection("_geotv_counters")
                .updateOne(
                  { _id: "transaction" },
                  { $inc: { value: 1 } },
                  { session },
                );
              return fn();
            }),
          {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
            readPreference: "primary",
          },
        );
      } finally {
        await session.endSession();
      }
    },
    async close() {
      if (!suppliedClient) await client.close();
    },
  };
  try {
    await client.connect();
    await adapter.initialize();
    return adapter;
  } catch {
    await adapter.close();
    throw new Error(
      "Não foi possível preparar o MongoDB. Confira credenciais, acesso de rede no Atlas e permissões no banco.",
    );
  }
}
