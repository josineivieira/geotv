import { db } from "./db.js";
import { deviceSnapshot } from "./publications.js";
export function publishedChannels() {
  return db
    .prepare(
      "SELECT id,name,group_name,publication_id FROM devices ORDER BY rowid",
    )
    .all()
    .map((device) => {
      const snapshot = deviceSnapshot(device);
      return {
        id: device.id,
        name: device.name,
        group: device.group_name,
        version: snapshot.version,
        created: snapshot.created,
        contents: snapshot.contents,
        settings: snapshot.settings,
        alerts: snapshot.alerts,
      };
    });
}
