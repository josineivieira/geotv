import { randomUUID } from "node:crypto";
import { db, allContents, settings, now, audit, transaction } from "./db.js";
import {
  authorize,
  sessionUser,
  secret,
  digest,
  verifyPassword,
  hashPassword,
  permissions,
  fail,
  rateLimit,
} from "./security.js";
import { string, validateContent } from "./validation.js";
import { publish, deviceSnapshot, streams, notify } from "./publications.js";
import { upload, deleteMedia } from "./media.js";
import { publishedChannels } from "./channels.js";
import { convertPowerPoint, documentCapabilities } from "./documents.js";
export async function readBody(req, limit = 128 * 1024, raw = false) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) fail(413, "Arquivo ou requisição acima do limite.");
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  if (raw) return buffer;
  try {
    return JSON.parse(buffer.toString() || "{}");
  } catch {
    fail(400, "Dados inválidos.");
  }
}
export function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
export async function api(req, res, url) {
  const path = url.pathname,
    method = req.method;
  // Device bearer credentials never authorize administrative endpoints,
  // even if a browser happens to carry an admin session cookie as well.
  if (
    req.headers.authorization?.startsWith("Bearer ") &&
    !path.startsWith("/api/player/")
  )
    fail(403, "O acesso da TV é exclusivo para reprodução do canal.");
  rateLimit(req, "api", 600);
  if (!["GET", "HEAD"].includes(method)) {
    const origin = req.headers.origin;
    const expected = process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
    const allowedOrigins = new Set([
      expected,
      ...(process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ]);
    if (origin && !allowedOrigins.has(origin))
      fail(403, "Origem não autorizada.");
    if (req.headers["sec-fetch-site"] === "cross-site")
      fail(403, "Origem não autorizada.");
  }
  if (path === "/api/login" && method === "POST") {
    rateLimit(req, "login", 10);
    const body = await readBody(req);
    string(body.email, "E-mail", 200);
    string(body.password, "Senha", 200);
    const user = await db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(body.email.toLowerCase());
    if (!user || !verifyPassword(body.password, user.password))
      fail(401, "E-mail ou senha incorretos.");
    const token = secret();
    await db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    await db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(digest(token), user.id, Date.now() + 8 * 3600000);
    res.setHeader(
      "Set-Cookie",
      `geotv_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`,
    );
    await audit(user, "Entrou no sistema", user.id);
    return json(res, 200, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  }
  if (path.startsWith("/api/player/")) {
    const match = path.match(
      /^\/api\/player\/([^/]+)\/(snapshot|heartbeat|events)$/,
    );
    if (!match) fail(404, "Rota não encontrada.");
    const token =
      req.headers.authorization?.replace(/^Bearer /, "") ||
      url.searchParams.get("token");
    const device = token
      ? await db
          .prepare("SELECT * FROM devices WHERE id=? AND token=?")
          .get(match[1], digest(token))
      : null;
    if (!device) fail(401, "Dispositivo não autorizado.");
    if (match[2] === "snapshot" && method === "GET")
      return json(res, 200, await deviceSnapshot(device));
    if (match[2] === "heartbeat" && method === "POST") {
      const body = await readBody(req);
      await db
        .prepare(
          "UPDATE devices SET last_seen=?,current_content=?,version=?,synced_at=? WHERE id=?",
        )
        .run(
          now(),
          String(body.current || "").slice(0, 200),
          Number.isInteger(body.version) ? body.version : 0,
          body.syncedAt && Number.isFinite(Date.parse(body.syncedAt))
            ? body.syncedAt
            : null,
          device.id,
        );
      return json(res, 200, { ok: true });
    }
    if (match[2] === "events" && method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write("retry: 5000\nevent: publication\ndata: {}\n\n");
      const key = randomUUID();
      res.deviceId = device.id;
      streams.set(key, res);
      const interval = setInterval(() => res.write(": keepalive\n\n"), 25000);
      res.on("close", () => {
        clearInterval(interval);
        streams.delete(key);
      });
      return;
    }
    fail(405, "Método não permitido.");
  }
  const user = await sessionUser(req);
  if (!user) fail(401, "Entre na sua conta para continuar.");
  if (path === "/api/me") return json(res, 200, user);
  if (path === "/api/logout" && method === "POST") {
    const token = req.headers.cookie?.match(/geotv_session=([a-f0-9]+)/)?.[1];
    if (token)
      await db.prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
    res.setHeader(
      "Set-Cookie",
      "geotv_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
    );
    return json(res, 200, { ok: true });
  }
  if (path === "/api/channels" && method === "GET") {
    if (user.role !== "Canais") authorize(user, "read");
    return json(
      res,
      200,
      (await publishedChannels()).map(
        ({ contents, settings, alerts, ...channel }) => ({
          ...channel,
          count: contents.length,
          duration: contents.reduce((sum, c) => sum + c.duration, 0),
        }),
      ),
    );
  }
  const channelMatch = path.match(/^\/api\/channels\/([^/]+)$/);
  if (channelMatch && method === "GET") {
    if (user.role !== "Canais") authorize(user, "read");
    const channel = (await publishedChannels()).find(
      (c) => c.id === channelMatch[1],
    );
    if (!channel) fail(404, "Canal indisponível.");
    return json(res, 200, channel);
  }
  authorize(user, "read");
  const mediaDelete = path.match(/^\/api\/media\/([^/]+)$/);
  if (mediaDelete && method === "DELETE") {
    authorize(user, "edit");
    return json(res, 200, await deleteMedia(mediaDelete[1], user));
  }
  const roleMatch = path.match(/^\/api\/users\/([^/]+)\/role$/);
  if (roleMatch && method === "PUT") {
    authorize(user, "manage");
    const { role } = await readBody(req);
    if (!permissions[role]) fail(400, "Perfil inválido.");
    const target = await db
      .prepare("SELECT id,name,role FROM users WHERE id=?")
      .get(roleMatch[1]);
    if (!target) fail(404, "Usuário não encontrado.");
    if (target.id === user.id)
      fail(400, "Use outro administrador para mudar seu próprio perfil.");
    await transaction(async () => {
      await db
        .prepare("UPDATE users SET role=? WHERE id=?")
        .run(role, target.id);
      await db.prepare("DELETE FROM sessions WHERE user_id=?").run(target.id);
      await audit(
        user,
        "Alterou perfil",
        target.id,
        { role: target.role },
        { role },
      );
    });
    return json(res, 200, { ok: true });
  }
  if (path === "/api/state" && method === "GET")
    return json(res, 200, {
      user,
      contents: await allContents(),
      devices: await db
        .prepare(
          "SELECT id,name,group_name,publication_id,last_seen,current_content,version,synced_at FROM devices",
        )
        .all(),
      playlists: (await db.prepare("SELECT data FROM playlists").all()).map(
        (r) => JSON.parse(r.data),
      ),
      playlist: JSON.parse(
        (
          await db
            .prepare(
              "SELECT data FROM playlists ORDER BY CASE WHEN id='main' THEN 0 ELSE 1 END, rowid LIMIT 1",
            )
            .get()
        ).data,
      ),
      settings: await settings(),
      media: await db
        .prepare("SELECT * FROM media ORDER BY created DESC")
        .all(),
      publications: await db
        .prepare(
          "SELECT p.id,p.created,u.name AS author FROM publications p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.id DESC LIMIT 100",
        )
        .all(),
      alerts: (await db.prepare("SELECT data FROM emergencies").all()).map(
        (r) => JSON.parse(r.data),
      ),
      audit: await db
        .prepare(
          "SELECT a.*,u.name AS author FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100",
        )
        .all(),
    });
  if (path === "/api/contents" && method === "POST") {
    authorize(user, "edit");
    const input = await readBody(req);
    const content = await validateContent({
      ...input,
      id: randomUUID(),
      author: user.name,
      status: "Rascunho",
      updated: now(),
    });
    await db
      .prepare("INSERT INTO contents VALUES(?,?,?)")
      .run(content.id, JSON.stringify(content), now());
    await audit(user, "Criou conteúdo", content.id, null, content);
    return json(res, 201, content);
  }
  const contentMatch = path.match(/^\/api\/contents\/([^/]+)$/);
  if (contentMatch && ["PUT", "DELETE"].includes(method)) {
    authorize(user, "edit");
    const old = await db
      .prepare("SELECT data FROM contents WHERE id=?")
      .get(contentMatch[1]);
    if (!old) fail(404, "Conteúdo não encontrado.");
    const before = JSON.parse(old.data);
    if (method === "DELETE") {
      await transaction(async () => {
        await db
          .prepare("DELETE FROM contents WHERE id=?")
          .run(contentMatch[1]);
        for (const row of await db
          .prepare("SELECT data FROM playlists")
          .all()) {
          const playlist = JSON.parse(row.data);
          playlist.items = playlist.items.filter(
            (i) => i.contentId !== contentMatch[1],
          );
          await db
            .prepare("UPDATE playlists SET data=? WHERE id=?")
            .run(JSON.stringify(playlist), playlist.id);
        }
        await audit(user, "Excluiu conteúdo", contentMatch[1], before, null);
      });
      notify();
      return json(res, 200, { ok: true });
    }
    const body = await readBody(req);
    if (body.status === "Aprovado") authorize(user, "publish");
    if (body.status === "Publicado") body.status = "Rascunho";
    const content = await validateContent({
      ...body,
      id: contentMatch[1],
      author: before.author,
      updated: now(),
    });
    if ((await settings()).approval && body.status !== "Aprovado")
      content.status = "Rascunho";
    await transaction(async () => {
      await db
        .prepare("UPDATE contents SET data=?,updated=? WHERE id=?")
        .run(JSON.stringify(content), now(), content.id);
      if (content.slides?.length)
        for (const row of await db
          .prepare("SELECT id,data FROM playlists")
          .all()) {
          const playlist = JSON.parse(row.data);
          let changed = false;
          for (const item of playlist.items)
            if (item.contentId === content.id) {
              item.duration = content.duration;
              changed = true;
            }
          if (changed)
            await db
              .prepare("UPDATE playlists SET data=? WHERE id=?")
              .run(JSON.stringify(playlist), row.id);
        }
      await audit(user, "Editou conteúdo", content.id, before, content);
    });
    return json(res, 200, content);
  }
  if (path === "/api/approve" && method === "POST") {
    authorize(user, "publish");
    const { id } = await readBody(req);
    const row = await db
      .prepare("SELECT data FROM contents WHERE id=?")
      .get(id);
    if (!row) fail(404, "Conteúdo não encontrado.");
    const c = JSON.parse(row.data);
    c.status = "Aprovado";
    await db
      .prepare("UPDATE contents SET data=?,updated=? WHERE id=?")
      .run(JSON.stringify(c), now(), id);
    await audit(user, "Aprovou conteúdo", id);
    return json(res, 200, c);
  }
  const playlistDelete = path.match(/^\/api\/playlists\/([^/]+)$/);
  if (playlistDelete && method === "DELETE") {
    authorize(user, "edit");
    const id = playlistDelete[1],
      row = await db.prepare("SELECT data FROM playlists WHERE id=?").get(id);
    if (!row) fail(404, "Programação não encontrada.");
    await transaction(async () => {
      await db.prepare("DELETE FROM playlists WHERE id=?").run(id);
      // Keep an empty workspace available when the last playlist is removed.
      if (!(await db.prepare("SELECT id FROM playlists LIMIT 1").get())) {
        const replacement = {
          id: randomUUID(),
          name: "Nova programação",
          items: [],
        };
        await db
          .prepare("INSERT INTO playlists VALUES(?,?)")
          .run(replacement.id, JSON.stringify(replacement));
      }
      await audit(user, "Excluiu programação", id, JSON.parse(row.data), null);
    });
    notify();
    return json(res, 200, { ok: true });
  }
  const deviceDelete = path.match(/^\/api\/devices\/([^/]+)$/);
  if (deviceDelete && method === "DELETE") {
    authorize(user, "manage");
    const id = deviceDelete[1],
      device = await db
        .prepare("SELECT id,name,group_name FROM devices WHERE id=?")
        .get(id);
    if (!device) fail(404, "TV não encontrada.");
    await transaction(async () => {
      await db.prepare("DELETE FROM devices WHERE id=?").run(id);
      for (const row of await db
        .prepare("SELECT id,data FROM emergencies")
        .all()) {
        const alert = JSON.parse(row.data);
        if (!alert.devices.includes(id)) continue;
        alert.devices = alert.devices.filter((target) => target !== id);
        if (alert.devices.length)
          await db
            .prepare("UPDATE emergencies SET data=? WHERE id=?")
            .run(JSON.stringify(alert), row.id);
        else await db.prepare("DELETE FROM emergencies WHERE id=?").run(row.id);
      }
      await audit(user, "Excluiu TV", id, device, null);
    });
    for (const response of streams.values())
      if (response.deviceId === id) {
        response.write("event: revoked\ndata: {}\n\n");
        response.end();
      }
    return json(res, 200, { ok: true });
  }
  if (path === "/api/playlists" && method === "POST") {
    authorize(user, "edit");
    const body = await readBody(req);
    const playlist = {
      id: randomUUID(),
      name: string(body.name, "Nome", 100),
      items: [],
    };
    await db
      .prepare("INSERT INTO playlists VALUES(?,?)")
      .run(playlist.id, JSON.stringify(playlist));
    await audit(user, "Criou programação", playlist.id, null, playlist);
    return json(res, 201, playlist);
  }
  if (path === "/api/playlist/targets" && method === "PUT") {
    if (user.role !== "Publicador") authorize(user, "edit");
    const body = await readBody(req),
      row = await db
        .prepare("SELECT data FROM playlists WHERE id=?")
        .get(body.id);
    if (!row) fail(404, "Programação não encontrada.");
    if (
      !Array.isArray(body.devices) ||
      body.devices.length > 500 ||
      body.devices.some((id) => typeof id !== "string")
    )
      fail(400, "Selecione canais válidos.");
    for (const id of body.devices)
      if (!(await db.prepare("SELECT id FROM devices WHERE id=?").get(id)))
        fail(400, "Selecione canais válidos.");
    const playlist = JSON.parse(row.data),
      before = playlist.targetDevices || [];
    playlist.targetDevices = [...new Set(body.devices)];
    await db
      .prepare("UPDATE playlists SET data=? WHERE id=?")
      .run(JSON.stringify(playlist), playlist.id);
    await audit(
      user,
      "Alterou canais da programação",
      playlist.id,
      before,
      playlist.targetDevices,
    );
    return json(res, 200, { ok: true });
  }
  if (path === "/api/playlist" && method === "PUT") {
    authorize(user, "edit");
    const body = await readBody(req);
    string(body.name, "Nome");
    if (!Array.isArray(body.items) || body.items.length > 200)
      fail(400, "Programação inválida.");
    for (const item of body.items) {
      const referenced = await db
        .prepare("SELECT data FROM contents WHERE id=?")
        .get(item.contentId);
      if (referenced) {
        const content = JSON.parse(referenced.data);
        if (content.slides?.length) item.duration = content.duration;
      }
      if (
        !(await db
          .prepare("SELECT id FROM contents WHERE id=?")
          .get(item.contentId)) ||
        !Number.isFinite(item.duration) ||
        item.duration < 5 ||
        item.duration > 3600
      )
        fail(400, "Item de programação inválido.");
    }
    const id = body.id || "main",
      row = await db.prepare("SELECT data FROM playlists WHERE id=?").get(id);
    if (!row) fail(404, "Programação não encontrada.");
    const before = row.data;
    await db.prepare("UPDATE playlists SET data=? WHERE id=?").run(
      JSON.stringify({
        ...JSON.parse(before),
        id,
        name: body.name,
        items: body.items,
      }),
      id,
    );
    await audit(user, "Alterou programação", id, JSON.parse(before), body);
    notify();
    return json(res, 200, { ok: true });
  }
  if (path === "/api/publish" && method === "POST") {
    authorize(user, "publish");
    const body = await readBody(req);
    return json(
      res,
      201,
      await publish(user, body.devices, body.restoreId, body.playlistId),
    );
  }
  if (path === "/api/devices" && method === "POST") {
    authorize(user, "manage");
    const body = await readBody(req);
    const name = string(body.name, "Nome da TV", 100),
      group = string(body.group || "Geral", "Grupo", 80);
    const id = randomUUID(),
      token = secret();
    await db
      .prepare("INSERT INTO devices(id,name,group_name,token) VALUES(?,?,?,?)")
      .run(id, name, group, digest(token));
    await audit(user, "Cadastrou TV", id, null, { name, group });
    return json(res, 201, { id, url: `/tv/${id}#${token}` });
  }
  if (path === "/api/devices/rotate" && method === "POST") {
    authorize(user, "manage");
    const { id } = await readBody(req);
    const token = secret();
    if (
      !(
        await db
          .prepare("UPDATE devices SET token=? WHERE id=?")
          .run(digest(token), id)
      ).changes
    )
      fail(404, "TV não encontrada.");
    for (const res of streams.values()) res.end();
    await audit(user, "Renovou ativação", id);
    return json(res, 200, { url: `/tv/${id}#${token}` });
  }
  if (path === "/api/media" && method === "POST") {
    authorize(user, "edit");
    return json(res, 201, await upload(req, user, readBody));
  }
  if (path === "/api/emergencies" && method === "POST") {
    authorize(user, "publish");
    const body = await readBody(req);
    string(body.title, "Título");
    string(body.message, "Mensagem", 1500);
    if (
      !Array.isArray(body.devices) ||
      !body.devices.length ||
      body.devices.length > 500 ||
      body.devices.some((id) => typeof id !== "string")
    )
      fail(400, "Selecione TVs válidas.");
    for (const id of body.devices)
      if (!(await db.prepare("SELECT id FROM devices WHERE id=?").get(id)))
        fail(400, "Selecione TVs válidas.");
    if (
      !Number.isFinite(Date.parse(body.start)) ||
      !Number.isFinite(Date.parse(body.end)) ||
      body.start >= body.end
    )
      fail(400, "Informe um período válido.");
    const alert = { ...body, id: randomUUID() };
    await db
      .prepare("INSERT INTO emergencies VALUES(?,?)")
      .run(alert.id, JSON.stringify(alert));
    await audit(user, "Publicou aviso urgente", alert.id, null, alert);
    notify();
    return json(res, 201, alert);
  }
  if (path.startsWith("/api/emergencies/") && method === "DELETE") {
    authorize(user, "publish");
    const id = path.split("/").pop();
    await db.prepare("DELETE FROM emergencies WHERE id=?").run(id);
    await audit(user, "Encerrou aviso urgente", id);
    notify();
    return json(res, 200, { ok: true });
  }
  if (path === "/api/settings" && method === "PUT") {
    authorize(user, "manage");
    const b = await readBody(req);
    string(b.name, "Nome", 80);
    if (
      !["fade", "slide", "zoom", "none"].includes(b.transition) ||
      !Number.isInteger(b.duration) ||
      b.duration < 5 ||
      b.duration > 3600 ||
      !Number.isInteger(b.heartbeat) ||
      b.heartbeat < 10 ||
      b.heartbeat > 120
    )
      fail(400, "Configuração inválida.");
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: b.timezone });
    } catch {
      fail(400, "Fuso horário inválido.");
    }
    const before = await settings();
    const value = {
      name: b.name,
      duration: b.duration,
      transition: b.transition,
      heartbeat: b.heartbeat,
      timezone: b.timezone,
      approval: !!b.approval,
    };
    await db
      .prepare("UPDATE settings SET data=? WHERE id='general'")
      .run(JSON.stringify(value));
    await audit(user, "Alterou configurações", "general", before, value);
    return json(res, 200, value);
  }
  if (path === "/api/users" && method === "GET") {
    authorize(user, "manage");
    return json(
      res,
      200,
      await db.prepare("SELECT id,name,email,role FROM users").all(),
    );
  }
  if (path === "/api/users" && method === "POST") {
    authorize(user, "manage");
    const b = await readBody(req);
    string(b.name, "Nome", 100);
    string(b.email, "E-mail", 200);
    string(b.password, "Senha", 200);
    if (b.password.length < 12 || !permissions[b.role])
      fail(400, "Use senha com 12 caracteres e um perfil válido.");
    if (
      await db
        .prepare("SELECT id FROM users WHERE email=?")
        .get(b.email.toLowerCase())
    )
      fail(409, "E-mail já cadastrado.");
    const id = randomUUID();
    await db
      .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
      .run(id, b.name, b.email.toLowerCase(), hashPassword(b.password), b.role);
    await audit(user, "Criou usuário", id, null, {
      name: b.name,
      role: b.role,
    });
    return json(res, 201, { id });
  }
  if (path === "/api/imports/capabilities" && method === "GET") {
    authorize(user, "edit");
    return json(res, 200, documentCapabilities());
  }
  if (path === "/api/imports/powerpoint" && method === "POST") {
    authorize(user, "edit");
    return convertPowerPoint(req, res, user, readBody);
  }
  fail(404, "Rota não encontrada.");
}
