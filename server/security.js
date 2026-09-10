import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { db } from "./db.js";
export const secret = () => randomBytes(32).toString("hex");
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export function hashPassword(password) {
  const salt = secret();
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}
export const permissions = {
  Administrador: ["read", "edit", "publish", "manage"],
  Editor: ["read", "edit"],
  Publicador: ["read", "publish"],
  Visualizador: ["read"],
  Canais: ["channels"],
};
export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export function authorize(user, permission) {
  if (!user) fail(401, "Entre na sua conta para continuar.");
  if (!permissions[user.role]?.includes(permission))
    fail(403, "Seu perfil não permite esta ação.");
}
export async function sessionUser(req) {
  const token = req.headers.cookie?.match(
    /(?:^|; )geotv_session=([a-f0-9]+)/,
  )?.[1];
  if (!token) return null;
  return await db
    .prepare(
      "SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
    )
    .get(digest(token), Date.now());
}
const limits = new Map();
export function rateLimit(req, key, max = 150) {
  const id = req.socket.remoteAddress + key;
  const current = limits.get(id);
  const value =
    current && current.until > Date.now()
      ? current
      : { count: 0, until: Date.now() + 60000 };
  value.count++;
  limits.set(id, value);
  if (limits.size > 10000)
    for (const [k, v] of limits) if (v.until < Date.now()) limits.delete(k);
  if (value.count > max) fail(429, "Muitas tentativas. Aguarde um minuto.");
}
export async function bootstrapAdmin() {
  if (Number((await db.prepare("SELECT count(*) AS n FROM users").get()).n))
    return;
  const password = process.env.GEOTV_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    console.log(
      "Configure GEOTV_ADMIN_PASSWORD com pelo menos 12 caracteres no .env para criar o administrador.",
    );
    return;
  }
  await db
    .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
    .run(
      randomUUID(),
      process.env.GEOTV_ADMIN_NAME || "Administrador",
      (process.env.GEOTV_ADMIN_EMAIL || "admin@geotv.local").toLowerCase(),
      hashPassword(password),
      "Administrador",
    );
}
