import { AsyncLocalStorage } from "node:async_hooks";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

const tables =
  "users|sessions|contents|playlists|devices|publications|media|emergencies|audit_logs|settings|data_sources";

// Only application-owned SQL passes through this adapter; values stay bound.
export function postgresSql(sql, schema = "geotv") {
  if (!/^[a-z][a-z0-9_]*$/.test(schema)) throw new Error("Schema inválido.");
  let index = 0;
  let converted = sql.replace(/'([^']|'')*'|\?/g, (token) =>
    token === "?" ? `$${++index}` : token,
  );
  const ignore = /^INSERT OR IGNORE /i.test(converted);
  converted = converted.replace(/^INSERT OR IGNORE /i, "INSERT ");
  converted = converted.replace(
    new RegExp(
      `\\b(FROM|JOIN|INTO|UPDATE|REFERENCES|TABLE IF NOT EXISTS)\\s+(${tables})\\b`,
      "gi",
    ),
    `$1 ${schema}.$2`,
  );
  converted = converted.replace(/\browid\b/g, "id");
  if (ignore) converted += " ON CONFLICT DO NOTHING";
  if (/^INSERT INTO (?:\w+\.)?(publications|audit_logs)\b/i.test(converted))
    converted += " RETURNING id";
  return converted;
}

export function createDatabase({
  url,
  filename,
  schema = "geotv",
  ssl,
  pool: suppliedPool,
} = {}) {
  const context = new AsyncLocalStorage();
  const sqlite = url || suppliedPool ? null : new DatabaseSync(filename);
  const pool =
    suppliedPool ||
    (url
      ? new pg.Pool({
          connectionString: url,
          ssl,
          max: 5,
          connectionTimeoutMillis: 15000,
          idleTimeoutMillis: 30000,
          statement_timeout: 30000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
        })
      : null);
  // Pool handles idle clients; checked-out clients also need an error listener.
  pool?.on?.("connect", (client) => {
    client.on("error", (error) => {
      console.error(
        "Conexão PostgreSQL ativa interrompida:",
        error.code || "erro de rede",
      );
    });
  });
  pool?.on?.("error", (error) =>
    console.error(
      "Conexão PostgreSQL interrompida:",
      error.code || "erro de rede",
    ),
  );
  let tail = Promise.resolve();
  function exclusive(fn) {
    const next = tail.then(fn);
    tail = next.catch(() => {});
    return next;
  }
  function execute(sql, args, mode) {
    if (pool)
      return (context.getStore() || pool)
        .query(postgresSql(sql, schema), args)
        .then((result) => {
          if (mode === "get") return result.rows[0];
          if (mode === "all") return result.rows;
          return {
            changes: result.rowCount,
            lastInsertRowid: result.rows[0]?.id,
          };
        });
    const run = () => sqlite.prepare(sql)[mode](...args);
    return context.getStore() ? Promise.resolve().then(run) : exclusive(run);
  }
  return {
    kind: pool ? "postgres" : "sqlite",
    prepare(sql) {
      return Object.fromEntries(
        ["get", "all", "run"].map((mode) => [
          mode,
          (...args) => execute(sql, args, mode),
        ]),
      );
    },
    async exec(sql) {
      if (pool) return (context.getStore() || pool).query(sql);
      if (context.getStore()) return sqlite.exec(sql);
      return exclusive(() => sqlite.exec(sql));
    },
    async transaction(fn) {
      if (context.getStore())
        throw new Error("Transação aninhada não suportada.");
      if (!pool)
        return exclusive(async () => {
          sqlite.exec("BEGIN IMMEDIATE");
          try {
            const result = await context.run(true, fn);
            sqlite.exec("COMMIT");
            return result;
          } catch (error) {
            sqlite.exec("ROLLBACK");
            throw error;
          }
        });
      const client = await pool.connect();
      let connectionError;
      const onError = (error) => {
        connectionError = error;
      };
      client.on?.("error", onError);
      try {
        await client.query("BEGIN");
        // Serialize GeoTV transactions across processes, including first boot.
        await client.query("SELECT pg_advisory_xact_lock(714025, 1)");
        const result = await context.run(client, fn);
        if (connectionError) throw connectionError;
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.removeListener?.("error", onError);
        client.release(connectionError);
      }
    },
    async close() {
      if (pool) await pool.end();
      else await exclusive(() => sqlite.close());
    },
  };
}

export function postgresConnection(raw, ca) {
  let url;
  try {
    url = new URL(raw.trim());
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      url.hash
    )
      throw new Error();
    // Validate escapes before passing credentials to the PostgreSQL driver.
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
  } catch {
    // URL parser errors contain the original input, including the password.
    // Never attach that error as a cause or log the connection string.
    throw new Error(
      "DATABASE_URL inválida. No Render, use a URL PostgreSQL sem aspas e codifique os caracteres especiais da senha (por exemplo, # como %23, @ como %40 e % como %25).",
    );
  }
  // SSL URL parameters must not override certificate verification.
  for (const key of [
    "sslmode",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "pgbouncer",
  ])
    url.searchParams.delete(key);
  return {
    url: url.toString(),
    ssl: {
      rejectUnauthorized: true,
      ...(ca ? { ca: ca.replace(/\\n/g, "\n") } : {}),
    },
  };
}
