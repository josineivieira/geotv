import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
test("fluxo integrado de autorização, conteúdo, publicação, TV e restauração", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "geotv-test-"));
  const port = 34000 + Math.floor(Math.random() * 10000);
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      DATABASE_URL: "",
      SUPABASE_URL: "",
      SUPABASE_SECRET_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      RENDER: "",
      PORT: String(port),
      HOST: "127.0.0.1",
      PUBLIC_ORIGIN: base,
      GEOTV_STORAGE: directory,
      GEOTV_ADMIN_EMAIL: "test@geotv.local",
      GEOTV_ADMIN_PASSWORD: "Test-password-12345",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  t.after(async () => {
    child.kill();
    await once(child, "exit").catch(() => {});
    await rm(directory, { recursive: true, force: true });
  });
  for (
    let attempt = 0;
    attempt < 100 && !output.includes("disponível em");
    attempt++
  )
    await new Promise((r) => setTimeout(r, 50));
  assert.ok(output.includes("disponível em"), output);
  let cookie = "";
  async function call(path, method = "GET", body, auth = cookie) {
    const response = await fetch(base + "/api" + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(auth ? { Cookie: auth } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { response, data: await response.json() };
  }
  assert.equal((await call("/state")).response.status, 401);
  const login = await call("/login", "POST", {
    email: "test@geotv.local",
    password: "Test-password-12345",
  });
  assert.equal(login.response.status, 200);
  cookie = login.response.headers.get("set-cookie").split(";")[0];
  assert.ok(login.response.headers.get("set-cookie").includes("HttpOnly"));
  const device = (
    await call("/devices", "POST", { name: "TV Teste", group: "Manaus" })
  ).data;
  const token = device.url.split("#")[1];
  const player = async () => {
    const r = await fetch(`${base}/api/player/${device.id}/snapshot`, {
      headers: { Authorization: "Bearer " + token },
    });
    return r.json();
  };
  assert.equal(
    (await fetch(`${base}/api/player/${device.id}/snapshot`)).status,
    401,
  );
  const draft = {
    template: "sales",
    title: "Campanha setembro",
    status: "Rascunho",
    duration: 20,
    active: true,
    category: "Comercial",
    fields: { participants: "Fabiola;50\nAna;40", autoSort: true },
  };
  const created = await call("/contents", "POST", draft);
  assert.equal(created.response.status, 201);
  const c = created.data;
  assert.equal(
    (await call("/contents", "POST", { ...draft, duration: -1 })).response
      .status,
    400,
  );
  assert.equal(
    (
      await call("/playlist", "PUT", {
        name: "Comercial",
        items: [{ contentId: c.id, duration: 20 }],
      })
    ).response.status,
    200,
  );
  assert.equal((await player()).contents.length, 0);
  const p1 = (await call("/publish", "POST", { devices: [device.id] })).data;
  assert.equal(p1.id, 1);
  assert.equal(
    (await player()).contents[0].fields.participants,
    "Fabiola;50\nAna;40",
  );
  await call("/contents/" + c.id, "PUT", {
    ...c,
    fields: { ...c.fields, participants: "Fabiola;70\nAna;40" },
  });
  assert.equal(
    (await player()).contents[0].fields.participants,
    "Fabiola;50\nAna;40",
    "editar não modifica a TV",
  );
  const p2 = (await call("/publish", "POST", { devices: [device.id] })).data;
  assert.equal(p2.id, 2);
  assert.ok((await player()).contents[0].fields.participants.includes("70"));
  const restored = await call("/publish", "POST", {
    devices: [device.id],
    restoreId: 1,
  });
  assert.equal(restored.data.id, 3);
  assert.ok((await player()).contents[0].fields.participants.includes("50"));
  const response = await fetch(`${base}/api/player/${device.id}/heartbeat`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: 3,
      current: "Campanha setembro",
      syncedAt: new Date().toISOString(),
    }),
  });
  assert.equal(response.status, 200);
  assert.equal((await call("/state")).data.devices[0].version, 3);
  const secondDevice = (
    await call("/devices", "POST", { name: "TV Operação", group: "Itajaí" })
  ).data;
  const secondPlaylist = (
    await call("/playlists", "POST", { name: "Operacional" })
  ).data;
  await call("/playlist", "PUT", {
    ...secondPlaylist,
    items: [{ contentId: c.id, duration: 30 }],
  });
  await call("/publish", "POST", {
    playlistId: secondPlaylist.id,
    devices: [secondDevice.id],
  });
  const secondSnapshot = await (
    await fetch(`${base}/api/player/${secondDevice.id}/snapshot`, {
      headers: { Authorization: "Bearer " + secondDevice.url.split("#")[1] },
    })
  ).json();
  assert.equal(secondSnapshot.playlist.name, "Operacional");
  assert.equal(secondSnapshot.contents[0].duration, 30);
  assert.equal(
    (await player()).version,
    3,
    "publicação de outra TV não modifica a primeira",
  );
  await call("/users", "POST", {
    name: "Editor",
    email: "editor@test.local",
    password: "Test-password-12345",
    role: "Editor",
  });
  const editorLogin = await call("/login", "POST", {
    email: "editor@test.local",
    password: "Test-password-12345",
  });
  const editorCookie = editorLogin.response.headers
    .get("set-cookie")
    .split(";")[0];
  assert.equal(
    (await call("/publish", "POST", { devices: [device.id] }, editorCookie))
      .response.status,
    403,
  );
  assert.equal(
    (await call("/users", "GET", null, editorCookie)).response.status,
    403,
  );
  const badUpload = await fetch(base + "/api/media", {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "image/png",
      "X-File-Name": "fake.png",
    },
    body: "not an image",
  });
  assert.equal(badUpload.status, 400);
  const cross = await fetch(base + "/api/publish", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://evil.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ devices: [device.id] }),
  });
  assert.equal(cross.status, 403);
  await call("/settings", "PUT", {
    name: "GeoTV",
    duration: 20,
    heartbeat: 20,
    transition: "fade",
    timezone: "America/Sao_Paulo",
    approval: true,
  });
  await call("/contents/" + c.id, "PUT", { ...c, title: "Alteração pendente" });
  assert.equal(
    (await call("/publish", "POST", { devices: [device.id] })).response.status,
    400,
  );
  await call("/approve", "POST", { id: c.id });
  assert.equal(
    (await call("/publish", "POST", { devices: [device.id] })).response.status,
    201,
  );
  const emergency = (
    await call("/emergencies", "POST", {
      title: "Reunião",
      message: "Auditório às 14h",
      start: new Date(Date.now() - 1000).toISOString(),
      end: new Date(Date.now() + 60000).toISOString(),
      devices: [device.id],
    })
  ).data;
  assert.equal((await player()).alerts.length, 1);
  await call("/emergencies/" + emergency.id, "DELETE");
  assert.equal((await player()).alerts.length, 0);
  const stream = await fetch(
    `${base}/api/player/${device.id}/events?token=${token}`,
  );
  assert.equal(stream.headers.get("content-type"), "text/event-stream");
  const reader = stream.body.getReader();
  const event = await reader.read();
  assert.ok(
    new TextDecoder().decode(event.value).includes("event: publication"),
  );
  await reader.cancel();
  const oldToken = token;
  const png = Buffer.from("89504e470d0a1a0a00000000", "hex");
  const uploadResponse = await fetch(base + "/api/media", {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "image/png",
      "X-File-Name": "excluir.png",
    },
    body: png,
  });
  const uploaded = await uploadResponse.json();
  assert.equal(uploadResponse.status, 201);
  const mediaContent = (
    await call("/contents", "POST", {
      ...draft,
      template: "image",
      fields: { media: uploaded.url },
    })
  ).data;
  assert.equal(
    (await call("/media/" + uploaded.id, "DELETE")).response.status,
    409,
  );
  await call("/contents/" + mediaContent.id, "DELETE");
  assert.equal(
    (await call("/media/" + uploaded.id, "DELETE")).response.status,
    200,
  );
  assert.equal((await fetch(base + uploaded.url)).status, 404);
  assert.equal(
    (await call("/media/" + uploaded.id, "DELETE")).response.status,
    404,
  );
  const removalContent = (
    await call("/contents", "POST", { ...draft, title: "Remover do ar" })
  ).data;
  await call("/approve", "POST", { id: removalContent.id });
  const removalPlaylist = (
    await call("/playlists", "POST", { name: "Canal exclusão" })
  ).data;
  const removalDevice = (
    await call("/devices", "POST", { name: "TV exclusão", group: "Teste" })
  ).data;
  const removalItems = [{ contentId: removalContent.id, duration: 20 }];
  await call("/playlist", "PUT", { ...removalPlaylist, items: removalItems });
  await call("/publish", "POST", {
    devices: [removalDevice.id],
    playlistId: removalPlaylist.id,
  });
  const readRemoval = async () =>
    (await call("/channels/" + removalDevice.id)).data;
  assert.equal((await readRemoval()).contents.length, 1);
  await call("/playlist", "PUT", { ...removalPlaylist, items: [] });
  assert.equal(
    (await readRemoval()).contents.length,
    0,
    "item removido não permanece no canal",
  );
  await call("/playlist", "PUT", { ...removalPlaylist, items: removalItems });
  await call("/contents/" + removalContent.id, "DELETE");
  assert.equal(
    (await readRemoval()).contents.length,
    0,
    "conteúdo excluído não permanece no canal",
  );
  await call("/playlists/" + removalPlaylist.id, "DELETE");
  assert.equal(
    (await readRemoval()).contents.length,
    0,
    "programação excluída não permanece no canal",
  );
  await call("/devices/" + removalDevice.id, "DELETE");
  assert.equal(
    (
      await call("/playlist/targets", "PUT", {
        id: "main",
        devices: [device.id],
      })
    ).response.status,
    200,
  );
  assert.deepEqual(
    (await call("/state")).data.playlists.find((p) => p.id === "main")
      .targetDevices,
    [device.id],
  );
  const targetPlaylist = (await call("/state")).data.playlists.find(
    (p) => p.id === "main",
  );
  await call("/playlist", "PUT", {
    id: "main",
    name: targetPlaylist.name,
    items: targetPlaylist.items,
  });
  assert.deepEqual(
    (await call("/state")).data.playlists.find((p) => p.id === "main")
      .targetDevices,
    [device.id],
  );
  assert.equal(
    (
      await call("/playlist/targets", "PUT", {
        id: "main",
        devices: ["invalid"],
      })
    ).response.status,
    400,
  );
  await call("/users", "POST", {
    name: "TV Sala",
    email: "channels@test.local",
    password: "Test-password-12345",
    role: "Canais",
  });
  const channelLogin = await call("/login", "POST", {
    email: "channels@test.local",
    password: "Test-password-12345",
  });
  const channelCookie = channelLogin.response.headers
    .get("set-cookie")
    .split(";")[0];
  const catalog = await call("/channels", "GET", null, channelCookie);
  assert.equal(catalog.response.status, 200);
  assert.ok(catalog.data.length > 0);
  assert.ok(
    catalog.data.some((c) => c.id === device.id && c.name === "TV Teste"),
  );
  const assigned = (
    await call("/channels/" + secondDevice.id, "GET", null, channelCookie)
  ).data;
  assert.equal(assigned.version, secondSnapshot.version);
  assert.equal(assigned.contents[0].duration, 30);
  const emptyTV = (
    await call("/devices", "POST", {
      name: "TV Sem publicação",
      group: "Teste",
    })
  ).data;
  assert.ok(
    (await call("/channels", "GET", null, channelCookie)).data.some(
      (c) => c.id === emptyTV.id && c.version === 0,
    ),
  );
  assert.deepEqual(
    (await call("/channels/" + emptyTV.id, "GET", null, channelCookie)).data
      .contents,
    [],
  );
  await call("/devices/" + emptyTV.id, "DELETE");
  assert.equal(
    (await call("/channels/" + emptyTV.id, "GET", null, channelCookie)).response
      .status,
    404,
  );
  assert.equal(
    (await call("/channels/" + catalog.data[0].id, "GET", null, channelCookie))
      .response.status,
    200,
  );
  for (const route of ["/state", "/users"])
    assert.equal(
      (await call(route, "GET", null, channelCookie)).response.status,
      403,
    );
  assert.equal(
    (await call("/publish", "POST", { devices: [device.id] }, channelCookie))
      .response.status,
    403,
  );
  assert.equal(
    (await call("/me", "GET", null, channelCookie)).data.role,
    "Canais",
  );
  await call("/logout", "POST", {}, channelCookie);
  assert.equal(
    (await call("/channels", "GET", null, channelCookie)).response.status,
    401,
  );
  for (const path of ["/state", "/users", "/playlists"]) {
    const denied = await fetch(base + "/api" + path, {
      headers: { Authorization: "Bearer " + token, Cookie: cookie },
    });
    assert.equal(denied.status, 403, "credencial da TV não acessa o Admin");
  }
  await call("/devices/rotate", "POST", { id: device.id });
  assert.equal(
    (
      await fetch(`${base}/api/player/${device.id}/snapshot`, {
        headers: { Authorization: "Bearer " + oldToken },
      })
    ).status,
    401,
  );
  assert.equal(
    (await call("/devices/" + secondDevice.id, "DELETE", null, editorCookie))
      .response.status,
    403,
  );
  const preserved = (await call("/state")).data.publications.length;
  assert.equal((await call("/playlists/main", "DELETE")).response.status, 200);
  assert.equal((await call("/playlists/main", "DELETE")).response.status, 404);
  assert.equal((await call("/state")).data.playlist.id, secondPlaylist.id);
  assert.equal(
    (await call("/playlists/" + secondPlaylist.id, "DELETE")).response.status,
    200,
  );
  const remaining = (await call("/state")).data;
  assert.equal(remaining.playlists.length, 1);
  assert.equal(remaining.playlist.items.length, 0);
  assert.equal(remaining.publications.length, preserved);
  assert.ok(remaining.contents.some((item) => item.id === c.id));
  assert.equal(
    (await call("/devices/" + secondDevice.id, "DELETE")).response.status,
    200,
  );
  assert.equal(
    (
      await fetch(`${base}/api/player/${secondDevice.id}/snapshot`, {
        headers: { Authorization: "Bearer " + secondDevice.url.split("#")[1] },
      })
    ).status,
    401,
  );
  assert.equal(
    (await call("/devices/" + secondDevice.id, "DELETE")).response.status,
    404,
  );
  await call("/logout", "POST", {});
  assert.equal((await call("/state")).response.status, 401);
});
