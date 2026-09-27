import { MongoClient } from "mongodb";
import { mongoConnection } from "../server/mongo-database.js";
import { mongoTables } from "../server/mongo-schema.js";

let client;
try {
  const config = mongoConnection(
    process.env.MONGODB_URI || process.env.DATABASE_URL || "",
  );
  client = new MongoClient(config.url, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(config.name);
  await db.command({ ping: 1 });
  const counts = [];
  for (const collection of Object.keys(mongoTables))
    counts.push({
      collection,
      registros: await db.collection(collection).countDocuments(),
    });
  console.log(`Conexão verificada. Banco: ${config.name}`);
  console.table(counts);
} catch (error) {
  console.error(
    `Conexão não verificada (${error.name}, código ${Number.isInteger(error.code) ? error.code : "indisponível"}). Confira credenciais, DNS e acesso de rede no Atlas.`,
  );
  process.exitCode = 1;
} finally {
  await client?.close();
}
