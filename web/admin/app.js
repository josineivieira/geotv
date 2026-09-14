import { request, toast, date } from "./api.js";
import {
  templates,
  templateById,
  renderSlide,
  escapeHtml as e,
} from "/shared/templates.js";
import { eligible } from "/shared/schedule.js";
import { presentationFrames } from "/shared/presentation.js";
import { openEditor } from "./editor.js";
import { createViews } from "./views.js";
import { showChannels } from "./channels.js";
import { mountTargets } from "./playlist-targets.js";
let state,
  page = "Dashboard";
let authRevision = 0;
const app = document.querySelector("#app"),
  modal = document.querySelector("#modal");
const icons = {
  Dashboard: "▦",
  Conteúdos: "▤",
  Programação: "☷",
  TVs: "▣",
  Mídia: "▧",
  Templates: "◈",
  Histórico: "↶",
  Usuários: "♙",
  Configurações: "⚙",
};
const can = (permission) =>
  ({
    read: ["Administrador", "Editor", "Publicador", "Visualizador"],
    edit: ["Administrador", "Editor"],
    publish: ["Administrador", "Publicador"],
    manage: ["Administrador"],
  })[permission].includes(state.user.role);
const online = (d) =>
  d.last_seen &&
  Date.now() - new Date(d.last_seen).getTime() <
    Math.max(60, state.settings.heartbeat * 3) * 1000;
const badge = (text, kind = "") =>
  `<span class="badge ${kind}">${e(text)}</span>`;
const button = (label, action, style = "", extra = "") =>
  `<button class="${style}" data-action="${action}" ${extra}>${label}</button>`;
function closeModal() {
  modal.close();
  modal.innerHTML = "";
}
export function showModal(title, body, onSubmit) {
  modal.innerHTML = `<form id="dialog-form"><div class="dialog-heading"><h2>${e(title)}</h2><button type="button" data-close aria-label="Fechar">×</button></div>${body}</form>`;
  modal.querySelector("[data-close]").onclick = closeModal;
  modal.querySelector("form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      await onSubmit?.(new FormData(event.target), event.target);
    } catch (error) {
      toast(error.message);
    }
  };
  modal.showModal();
}
function deviceOptions() {
  return `<label>Grupo<select id="target-group"><option value="">Todas as TVs</option>${[...new Set(state.devices.map((d) => d.group_name))].map((g) => `<option>${e(g)}</option>`).join("")}</select></label><div class="device-checks">${state.devices.map((d) => `<label><input type="checkbox" name="devices" value="${d.id}" data-group="${e(d.group_name)}" checked><span>${e(d.name)}<small>${e(d.group_name)}</small></span>${badge(online(d) ? "Online" : "Offline", online(d) ? "green" : "gray")}</label>`).join("") || "<p>Cadastre uma TV primeiro.</p>"}</div>`;
}
function bindGroup() {
  document
    .querySelector("#target-group")
    ?.addEventListener("change", (event) =>
      modal
        .querySelectorAll("[name=devices]")
        .forEach(
          (input) =>
            (input.checked =
              !event.target.value ||
              input.dataset.group === event.target.value),
        ),
    );
}
async function refresh() {
  const revision = authRevision;
  const user = await request("/me");
  if (revision !== authRevision) return;
  if (user.role === "Canais") {
    state = null;
    return showChannels(app, login);
  }
  const next = await request("/state");
  if (revision !== authRevision) return;
  state = next;
  state.playlist =
    state.playlists.find(
      (p) => p.id === localStorage.getItem("geotv-playlist"),
    ) || state.playlist;
  render();
}
function render() {
  app.innerHTML = `<aside class="sidebar"><a class="brand" href="/">geo<span>tv</span><i></i></a><div class="workspace-label">CANAL CORPORATIVO</div><img class="company-logo" src="/assets/geomaritima-logo.png" alt="GeoMarítima Multimodal"><nav>${Object.entries(
    icons,
  )
    .filter(
      ([p]) => !["Usuários", "Configurações"].includes(p) || can("manage"),
    )
    .map(
      ([p, i]) =>
        `<button class="nav-link ${page === p ? "active" : ""}" data-page="${p}"><span>${i}</span>${p}${p === "TVs" ? `<small>${state.devices.length}</small>` : ""}</button>`,
    )
    .join(
      "",
    )}</nav><div class="sidebar-bottom"><div class="signal"><i></i> Central de transmissão</div><p>Conteúdo que conecta.<br>Informação que movimenta.</p><div class="user"><div class="avatar">${e(state.user.name.slice(0, 2).toUpperCase())}</div><div><strong>${e(state.user.name)}</strong><small>${e(state.user.role)}</small></div></div></div></aside><div class="main"><header class="topbar"><span>Workspace <b>/</b> ${e(page)}</span><div><span class="today">${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span><span class="top-dot"></span> GeoTV Admin<button class="logout-button" data-action="logout" aria-label="Sair e voltar ao login"><span aria-hidden="true">↪</span> Sair</button></div></header><main id="content"><div class="page-heading"><div><div class="eyebrow">GEOTV / ${e(page.toUpperCase())}</div><h1>${page === "Dashboard" ? "Sua comunicação, em movimento." : e(page)}</h1><p>${{ Dashboard: "Tudo o que está acontecendo no seu canal, em um só lugar.", Conteúdos: "Crie, organize e dê vida às informações da sua empresa.", Programação: "Organize a sequência. Escolha o destino. Entre no ar.", TVs: "Acompanhe cada ponto de exibição, de onde você estiver.", Templates: "Você cuida da informação. O GeoTV cuida do design.", Mídia: "Seus arquivos, prontos para usar em qualquer conteúdo.", Histórico: "Cada mudança registrada. Cada publicação sob controle.", Usuários: "As pessoas que fazem o seu canal acontecer.", Configurações: "Ajustes para o seu canal funcionar do seu jeito." }[page]}</p></div>${can("edit") && ["Dashboard", "Conteúdos", "Templates"].includes(page) ? button("+ Novo conteúdo", "new", "primary") : ""}</div><div id="page-body"></div></main><footer class="admin-footer">GeoTV <span>Conectando pessoas. Movendo resultados.</span><b>CANAL INTERNO DIGITAL</b></footer></div>`;
  const body = document.querySelector("#page-body");
  const views = createViews({ state, can, button, badge, online });
  body.innerHTML = views[page]();
  bind();
  if (page === "Usuários") loadUsers();
}
async function loadUsers() {
  try {
    const list = await request("/users");
    const target = document.querySelector("#users-table");
    if (target)
      target.innerHTML = `<table><thead><tr><th>NOME</th><th>E-MAIL</th><th>PERFIL</th></tr></thead><tbody>${list.map((u) => `<tr><td>${e(u.name)}</td><td>${e(u.email)}</td><td>${u.id === state.user.id ? badge(u.role, "purple") : `<select data-user-role="${u.id}" aria-label="Perfil de ${e(u.name)}">${["Administrador", "Editor", "Publicador", "Visualizador", "Canais"].map((role) => `<option ${role === u.role ? "selected" : ""}>${role}</option>`).join("")}</select>`}</td></tr>`).join("")}</tbody></table>`;
    target?.querySelectorAll("[data-user-role]").forEach(
      (select) =>
        (select.onchange = async () => {
          try {
            await request(
              "/users/" + select.dataset.userRole + "/role",
              "PUT",
              { role: select.value },
            );
            toast("Perfil atualizado. O usuário deve entrar novamente.");
          } catch (error) {
            toast(error.message);
            await loadUsers();
          }
        }),
    );
  } catch (error) {
    toast(error.message);
  }
}
function publishDialog(restoreId) {
  if (document.querySelector('.playlist-targets[data-unsaved="true"]')) {
    toast("Clique em Salvar canais antes de publicar.");
    return;
  }
  showModal(
    restoreId ? `Restaurar programação v${restoreId}` : "Publicar programação",
    `<p>${e(state.playlist.name)} será enviada para as TVs selecionadas. Edições futuras continuarão como rascunho.</p>${deviceOptions()}<button class="primary" ${!state.devices.length ? "disabled" : ""}>${restoreId ? "Restaurar e publicar" : "Publicar agora"} ↗</button>`,
    async (data) => {
      const result = await request("/publish", "POST", {
        devices: data.getAll("devices"),
        restoreId,
        playlistId: state.playlist.id,
      });
      closeModal();
      await refresh();
      toast(`Programação v${result.id} publicada.`);
    },
  );
  bindGroup();
  if (!restoreId)
    modal
      .querySelectorAll("[name=devices]")
      .forEach(
        (input) =>
          (input.checked =
            state.playlist.targetDevices?.includes(input.value) || false),
      );
}
async function savePlaylist() {
  await request("/playlist", "PUT", state.playlist);
  await refresh();
}
async function action(name, node) {
  const id = node?.dataset.id,
    c = state.contents.find((c) => c.id === id);
  switch (name) {
    case "delete-media": {
      const media = state.media.find((m) => m.id === id);
      return showModal(
        "Excluir mídia",
        `<p>Excluir “${e(media.name)}” da biblioteca?</p><p>Arquivos em uso precisam ser removidos dos conteúdos e canais primeiro. Cópias necessárias ao histórico são preservadas.</p><button class="danger">Excluir mídia</button>`,
        async () => {
          await request("/media/" + id, "DELETE");
          closeModal();
          await refresh();
          toast("Mídia excluída da biblioteca.");
        },
      );
    }
    case "delete-playlist":
      return showModal(
        "Excluir programação",
        `<p>Excluir “${e(state.playlist.name)}” e sua sequência de itens? Os conteúdos continuam no acervo, mas esta programação deixa de passar nos canais conectados.</p><p>Se for a última programação, será aberta uma nova programação vazia.</p><button class="danger">Excluir programação</button>`,
        async () => {
          await request("/playlists/" + state.playlist.id, "DELETE");
          localStorage.removeItem("geotv-playlist");
          closeModal();
          await refresh();
          toast("Programação excluída.");
        },
      );
    case "delete-device": {
      const device = state.devices.find((d) => d.id === id);
      return showModal(
        "Excluir TV",
        `<p>Excluir “${e(device.name)}”? O link de ativação será invalidado. A TV conectada interrompe a reprodução; uma TV sem rede só recebe a remoção quando se reconectar.</p><button class="danger">Excluir TV</button>`,
        async () => {
          await request("/devices/" + id, "DELETE");
          closeModal();
          await refresh();
          toast("TV excluída.");
        },
      );
    }
    case "logout":
      await request("/logout", "POST");
      return login();
    case "new":
      page = "Templates";
      return render();
    case "playlist":
      page = "Programação";
      return render();
    case "devices":
      page = "TVs";
      return render();
    case "new-playlist":
      return showModal(
        "Nova programação",
        '<label>Nome<input name="name" placeholder="Programação Comercial" required></label><button class="primary">Criar programação</button>',
        async (data) => {
          const created = await request("/playlists", "POST", {
            name: data.get("name"),
          });
          localStorage.setItem("geotv-playlist", created.id);
          closeModal();
          await refresh();
        },
      );
    case "template":
      if (can("edit")) {
        const saved = state.contents.filter((item) => item.template === id);
        if (saved.length) {
          showModal(
            "Abrir conteúdo salvo",
            `<p>Você já tem conteúdos com este modelo. Escolha qual deseja editar.</p><label>Conteúdo<select name="savedContent">${saved.map((item) => `<option value="${e(item.id)}">${e(item.title)} · ${e(item.status)}</option>`).join("")}</select></label><button class="primary" type="submit">Editar conteúdo salvo</button> <button type="button" id="create-from-template">Criar novo conteúdo</button>`,
            (data) => {
              const existing = saved.find(
                (item) => item.id === data.get("savedContent"),
              );
              closeModal();
              openEditor(existing, state, refresh);
            },
          );
          modal.querySelector("#create-from-template").onclick = () => {
            closeModal();
            openEditor(
              {
                template: id,
                title: templateById(id).name,
                duration: state.settings.duration,
                category: templateById(id).category,
                status: "Rascunho",
                active: true,
                fields: { autoSort: true },
              },
              state,
              refresh,
            );
          };
          return;
        }
      }
      if (can("edit"))
        openEditor(
          {
            template: id,
            title: templateById(id).name,
            duration: state.settings.duration,
            category: templateById(id).category,
            status: "Rascunho",
            active: true,
            fields: { autoSort: true },
          },
          state,
          refresh,
        );
      return;
    case "edit":
      openEditor(c, state, refresh);
      return;
    case "preview": {
      const frames = presentationFrames(c);
      showModal(
        "Visualizar como ficará na TV",
        `<div class="large-preview" id="sequence-preview">${renderSlide(frames[0])}</div><p id="sequence-position">Tela 1 de ${frames.length}</p>`,
      );
      if (frames.length > 1) {
        let scene = 0,
          timer;
        const preview = modal.querySelector("#sequence-preview");
        const position = modal.querySelector("#sequence-position");
        const advance = () => {
          timer = setTimeout(
            () => {
              if (!preview.isConnected || !modal.open) return;
              scene = (scene + 1) % frames.length;
              preview.innerHTML = renderSlide(frames[scene]);
              position.textContent = `Tela ${scene + 1} de ${frames.length}`;
              advance();
            },
            Math.max(5, Number(frames[scene].duration) || 5) * 1000,
          );
        };
        advance();
        modal.addEventListener("close", () => clearTimeout(timer), {
          once: true,
        });
      }
      return;
    }
    case "duplicate": {
      const { id: oldId, ...copy } = c;
      await request("/contents", "POST", {
        ...copy,
        title: "Cópia de " + c.title,
      });
      await refresh();
      return toast("Cópia criada como rascunho.");
    }
    case "approve":
      await request("/approve", "POST", { id });
      await refresh();
      return toast("Conteúdo aprovado.");
    case "publish":
      return publishDialog();
    case "restore":
      return publishDialog(Number(id));
    case "new-device":
      return showModal(
        "Novo ponto de exibição",
        '<label>Nome da TV<input name="name" placeholder="TV Recepção" required maxlength="100"></label><label>Grupo / unidade<input name="group" placeholder="Manaus" required maxlength="80"></label><button class="primary">Cadastrar TV</button>',
        async (data) => {
          const result = await request(
            "/devices",
            "POST",
            Object.fromEntries(data),
          );
          closeModal();
          await refresh();
          activation(result.url);
        },
      );
    case "device-detail": {
      const d = state.devices.find((d) => d.id === id);
      showModal(
        d.name,
        `<dl class="device-details"><dt>Status</dt><dd>${online(d) ? "Online" : "Offline"}</dd><dt>Grupo</dt><dd>${e(d.group_name)}</dd><dt>Exibindo agora</dt><dd>${e(d.current_content || "—")}</dd><dt>Versão recebida / destinada</dt><dd>${d.version} / ${d.publication_id || 0}</dd><dt>Último heartbeat</dt><dd>${date(d.last_seen)}</dd><dt>Última sincronização</dt><dd>${date(d.synced_at)}</dd></dl>${can("manage") ? '<p>Gerar um novo link invalida o link anterior desta TV.</p><button class="primary">Gerar novo link de ativação</button>' : ""}`,
        async () => {
          const r = await request("/devices/rotate", "POST", { id });
          closeModal();
          activation(r.url);
        },
      );
      return;
    }
    case "urgent":
      showModal(
        "Aviso urgente",
        `<p>Este aviso tem prioridade e interrompe a programação durante o período definido.</p><label>Título<input name="title" value="Atenção" required></label><label>Mensagem<textarea name="message" required maxlength="1500"></textarea></label><div class="form-row"><label>Início<input name="start" type="datetime-local" required></label><label>Término<input name="end" type="datetime-local" required></label></div>${deviceOptions()}<button class="danger">Publicar aviso urgente</button>${state.alerts.map((a) => `<p>${e(a.title)} · ${date(a.end)} ${button("Encerrar", "cancel-alert", "", `data-id="${a.id}" type="button"`)}</p>`).join("")}`,
        async (data) => {
          await request("/emergencies", "POST", {
            title: data.get("title"),
            message: data.get("message"),
            start: new Date(data.get("start")).toISOString(),
            end: new Date(data.get("end")).toISOString(),
            devices: data.getAll("devices"),
          });
          closeModal();
          await refresh();
          toast("Aviso publicado.");
        },
      );
      bindGroup();
      modal.querySelectorAll('[data-action="cancel-alert"]').forEach(
        (b) =>
          (b.onclick = async () => {
            await request("/emergencies/" + b.dataset.id, "DELETE");
            closeModal();
            await refresh();
            toast("Aviso encerrado.");
          }),
      );
      return;
    case "add-picker":
      return showModal(
        "Adicionar à programação",
        `<label>Conteúdo<select name="contentId">${state.contents
          .filter((c) => c.status !== "Arquivado")
          .map((c) => `<option value="${c.id}">${e(c.title)}</option>`)
          .join(
            "",
          )}</select></label><button class="primary" ${!state.contents.length ? "disabled" : ""}>Adicionar</button>`,
        async (data) => {
          const content = state.contents.find(
            (c) => c.id === data.get("contentId"),
          );
          state.playlist.items.push({
            contentId: content.id,
            duration: content.duration,
          });
          await savePlaylist();
          closeModal();
        },
      );
    case "remove-item":
      state.playlist.items.splice(Number(node.dataset.index), 1);
      return savePlaylist();
    case "move-up":
    case "move-down": {
      const i = Number(node.dataset.index),
        j = i + (name === "move-up" ? -1 : 1);
      if (j < 0 || j >= state.playlist.items.length) return;
      [state.playlist.items[i], state.playlist.items[j]] = [
        state.playlist.items[j],
        state.playlist.items[i],
      ];
      return savePlaylist();
    }
    case "new-user":
      return showModal(
        "Novo usuário",
        `<label>Nome<input name="name" required></label><label>E-mail<input name="email" type="email" required></label><label>Senha inicial<input name="password" type="password" minlength="12" required autocomplete="new-password"></label><label>Perfil<select name="role">${["Administrador", "Editor", "Publicador", "Visualizador", "Canais"].map((r) => `<option>${r}</option>`).join("")}</select></label><button class="primary">Criar usuário</button>`,
        async (data) => {
          await request("/users", "POST", Object.fromEntries(data));
          closeModal();
          await refresh();
          toast("Usuário criado.");
        },
      );
  }
}
function activation(url) {
  showModal(
    "TV cadastrada. Vamos conectar?",
    `<p>Abra este endereço uma vez na TV e ative o modo de tela cheia do navegador. Guarde o link: ele contém a credencial desta TV.</p><input class="activation-link" readonly value="${e(location.origin + url)}"><a class="button primary" href="${e(url)}" target="_blank" rel="noopener">Abrir GeoTV Player ↗</a>`,
  );
}
function bind() {
  mountTargets(state, can, refresh);
  app.querySelectorAll("[data-duration]").forEach((input) => {
    const item = state.playlist.items[Number(input.dataset.duration)];
    const content = state.contents.find((c) => c.id === item.contentId);
    if (!content?.slides?.length) return;
    input.readOnly = true;
    input.title = "Total calculado. Use Editar telas para alterar a duração.";
    if (can("edit")) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Editar telas";
      edit.className = "text-button";
      edit.onclick = () => openEditor(content, state, refresh);
      input.closest("label").after(edit);
    }
  });
  document
    .querySelector("#playlist-select")
    ?.addEventListener("change", async (event) => {
      localStorage.setItem("geotv-playlist", event.target.value);
      await refresh();
    });
  app.querySelectorAll("[data-page]").forEach(
    (b) =>
      (b.onclick = () => {
        page = b.dataset.page;
        render();
      }),
  );
  app
    .querySelectorAll("[data-action]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          action(b.dataset.action, b).catch((error) => toast(error.message))),
    );
  app.onchange = async (event) => {
    const select = event.target.closest("[data-content-action]");
    if (!select) return;
    try {
      const c = state.contents.find(
        (c) => c.id === select.dataset.contentAction,
      );
      const v = select.value;
      if (v === "delete") {
        showModal(
          "Excluir conteúdo",
          `<p>Excluir “${e(c.title)}” do acervo e dos canais? Ele deixará de ser reproduzido assim que os aparelhos sincronizarem. O histórico continua preservado.</p><button class="danger">Excluir conteúdo</button>`,
          async () => {
            await request("/contents/" + c.id, "DELETE");
            closeModal();
            await refresh();
          },
        );
      } else if (v === "add") {
        state.playlist.items.push({
          contentId: c.id,
          duration: c.duration,
        });
        await savePlaylist();
        toast("Adicionado à programação.");
      } else if (v) {
        await request("/contents/" + c.id, "PUT", {
          ...c,
          ...(v === "archive"
            ? { status: "Arquivado" }
            : { active: c.active === false }),
        });
        await refresh();
      }
    } catch (error) {
      toast(error.message);
    }
  };
  for (const id of [
    "search",
    "filter-status",
    "filter-category",
    "filter-sector",
    "filter-author",
    "filter-date",
  ])
    document.getElementById(id)?.addEventListener("input", () => {
      const value = (k) => document.getElementById(k).value.toLowerCase();
      const filtered = state.contents.filter(
        (c) =>
          (!value("search") ||
            c.title.toLowerCase().includes(value("search"))) &&
          (!value("filter-status") ||
            c.status.toLowerCase() === value("filter-status")) &&
          (!value("filter-category") ||
            c.category.toLowerCase() === value("filter-category")) &&
          (!value("filter-sector") ||
            (c.sector || "").toLowerCase().includes(value("filter-sector"))) &&
          (!value("filter-author") ||
            (c.author || "").toLowerCase().includes(value("filter-author"))) &&
          (!value("filter-date") ||
            ((!c.start || c.start.slice(0, 10) <= value("filter-date")) &&
              (!c.end || c.end.slice(0, 10) >= value("filter-date")))),
      );
      document.querySelector("#content-grid").innerHTML = createViews({
        state,
        can,
        button,
        badge,
        online,
      }).contentCards(filtered);
      document
        .querySelectorAll("#content-grid [data-action]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              action(b.dataset.action, b).catch((error) =>
                toast(error.message),
              )),
        );
    });
  document.querySelectorAll("[data-duration]").forEach(
    (input) =>
      (input.onchange = async () => {
        try {
          state.playlist.items[Number(input.dataset.duration)].duration =
            Number(input.value);
          await savePlaylist();
        } catch (error) {
          toast(error.message);
          await refresh();
        }
      }),
  );
  let dragIndex;
  document.querySelectorAll(".playlist-item").forEach((row) => {
    row.ondragstart = () => (dragIndex = Number(row.dataset.index));
    row.ondragover = (event) => event.preventDefault();
    row.ondrop = async (event) => {
      event.preventDefault();
      if (!can("edit") || dragIndex === undefined) return;
      const [item] = state.playlist.items.splice(dragIndex, 1);
      state.playlist.items.splice(Number(row.dataset.index), 0, item);
      try {
        await savePlaylist();
      } catch (error) {
        toast(error.message);
      }
    };
  });
  document
    .querySelector("#upload")
    ?.addEventListener("change", async (event) => {
      for (const file of event.target.files) {
        try {
          toast("Enviando " + file.name + "…");
          const res = await fetch("/api/media", {
            method: "POST",
            headers: {
              "Content-Type": file.type,
              "X-File-Name": encodeURIComponent(file.name),
            },
            body: file,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
        } catch (error) {
          toast(error.message);
          return;
        }
      }
      await refresh();
      toast("Arquivos disponíveis na biblioteca.");
    });
  document
    .querySelector("#media-search")
    ?.addEventListener("input", (event) =>
      document
        .querySelectorAll("[data-media-name]")
        .forEach(
          (card) =>
            (card.hidden = !card.dataset.mediaName.includes(
              event.target.value.toLowerCase(),
            )),
        ),
    );
  document
    .querySelector("#settings-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      try {
        await request("/settings", "PUT", {
          ...data,
          duration: Number(data.duration),
          heartbeat: Number(data.heartbeat),
          approval: data.approval === "on",
        });
        await refresh();
        toast("Configurações salvas.");
      } catch (error) {
        toast(error.message);
      }
    });
}
function login() {
  authRevision++;
  state = null;
  page = "Dashboard";
  closeModal();
  app.innerHTML = `<div class="login-page"><section class="login-story"><a class="brand">geo<span>tv</span><i></i></a><img class="login-company-logo" src="/assets/geomaritima-logo.png" alt="GeoMarítima Multimodal"><div class="login-copy"><div class="eyebrow">SEU CANAL INTERNO DIGITAL</div><h1>Informação que<br>conecta.<br><em>Resultados que<br>movimentam.</em></h1><p>Uma plataforma. Todas as suas TVs.<br>A comunicação da sua empresa em sintonia.</p></div><span>GEOTV · CONECTANDO PESSOAS</span></section><section class="login-form"><form id="login" autocomplete="on"><span class="eyebrow">BEM-VINDO AO GEOTV</span><h2>Seu canal começa aqui.</h2><p>Entre para gerenciar conteúdos e conectar suas TVs.</p><label>E-mail<input name="email" type="email" required autocomplete="username" placeholder="seu.email@empresa.com.br"></label><label>Senha<input name="password" type="password" required autocomplete="current-password" placeholder="Sua senha"></label><label class="check-label"><input type="checkbox" name="remember" checked> Manter conectado neste dispositivo</label><small>Para salvar sua senha, aceite a opção “Salvar senha” oferecida pelo navegador.</small><p id="login-error" role="alert"></p><button class="primary">Entrar no GeoTV ↗</button><small>Acesso exclusivo para usuários autorizados.</small></form></section></div>`;
  document.querySelector("#login").onsubmit = async (event) => {
    event.preventDefault();
    const b = event.target.querySelector("button");
    b.disabled = true;
    try {
      await request("/login", "POST", {
        ...Object.fromEntries(new FormData(event.target)),
        remember: new FormData(event.target).has("remember"),
      });
      await refresh();
    } catch (error) {
      document.querySelector("#login-error").textContent = error.message;
      b.disabled = false;
    }
  };
}
request("/me").then(refresh).catch(login);
setInterval(async () => {
  if (state && page === "Dashboard" && !modal.open) {
    try {
      await refresh();
    } catch {}
  }
}, 30000);
