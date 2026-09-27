// Column order mirrors schema.sql so existing bound application queries retain
// their contract. JSON payloads and password hashes are copied without changes.
export const mongoTables = {
  users: "id,name,email,password,role",
  sessions: "token,user_id,expires",
  contents: "id,data,updated",
  playlists: "id,data",
  devices:
    "id,name,group_name,token,publication_id,last_seen,current_content,version,synced_at",
  publications: "id,data,created,user_id",
  media: "id,name,mime,size,url,category,hash,created",
  emergencies: "id,data",
  audit_logs: "id,user_id,action,entity,before_value,after_value,created",
  settings: "id,data",
  data_sources: "id,data",
};
export const numericIds = new Set(["publications", "audit_logs"]);
export const primaryKey = (table) => (table === "sessions" ? "token" : "id");
export function columns(table) {
  if (!Object.hasOwn(mongoTables, table))
    throw new Error("Coleção não suportada.");
  return mongoTables[table].split(",");
}
export function field(table, name) {
  if (!columns(table).includes(name)) throw new Error("Campo não suportado.");
  return name;
}

export function mongoValidator(table) {
  const nullable = {
    sessions: ["user_id"],
    devices: [
      "publication_id",
      "last_seen",
      "current_content",
      "version",
      "synced_at",
    ],
    publications: ["user_id"],
    audit_logs: ["user_id", "entity", "before_value", "after_value"],
  };
  return {
    $jsonSchema: {
      bsonType: "object",
      required: columns(table),
      properties: Object.fromEntries(
        columns(table).map((key) => {
          const types =
            ["expires", "publication_id", "version", "size"].includes(key) ||
            (key === "id" && numericIds.has(table))
              ? ["int", "long", "double"]
              : ["string"];
          if (nullable[table]?.includes(key)) types.push("null");
          return [key, { bsonType: types }];
        }),
      ),
    },
  };
}
