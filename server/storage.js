import { storage, db } from "./db.js";
import { createObjectStorage } from "./object-storage.js";
export const mediaStorage = createObjectStorage({
  directory: storage,
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.SUPABASE_STORAGE_BUCKET || "geotv-media",
  required: db.kind === "postgres" || !!process.env.RENDER,
});
