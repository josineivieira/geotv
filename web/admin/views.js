import { date } from "./api.js";
import { templates, renderSlide, escapeHtml as e } from "/shared/templates.js";
import { eligible } from "/shared/schedule.js";
export function createViews({ state, can, button, badge, online }) {
  function dashboard() {
    const live = state.devices.filter(online).length,
      active = state.contents.filter((c) =>
        eligible(c, new Date(), state.settings.timezone),
      ).length;
    const scheduled = state.contents.filter(
      (c) => c.start && new Date(c.start) > new Date(),
    );
    const last = state.publications[0];
    const alerts = state.alerts.filter(
      (a) => new Date(a.start) <= new Date() && new Date(a.end) > new Date(),
    );
    const upcoming = scheduled.sort((a, b) =>
      a.start.localeCompare(b.start),
    )[0];
    const expiring = state.contents.filter(
      (c) =>
        c.end &&
        new Date(c.end) > new Date() &&
        new Date(c.end) - Date.now() < 7 * 86400000,
    );
    return `<section class="stats"><div class="stat"><span>TVs online <i class="green-dot"></i></span><strong>${live}<small>/ ${state.devices.length}</small></strong><p>${state.devices.length - live} offline · monitoramento ao vivo</p></div><div class="stat"><span>Conteúdos disponíveis <i>▤</i></span><strong>${active}<small>conteúdos</small></strong><p>${scheduled.length} agendados · ${expiring.length} expirando</p></div><div class="stat"><span>Programação publicada <i>◉</i></span><strong>${last ? "v" + last.id : "—"}</strong><p>${last ? date(last.created) : "Sua primeira publicação começa aqui"}</p></div><div class="stat"><span>Avisos urgentes <i>⚑</i></span><strong>${alerts.length}<small>ativos</small></strong><p>${alerts.length ? "Com prioridade nas TVs selecionadas" : "Tudo tranquilo no seu canal"}</p></div></section><div class="dashboard-grid"><section class="panel on-air"><div class="section-heading"><h2><i class="green-dot"></i> Na programação</h2>${badge("RASCUNHO", "purple")}</div><div class="dashboard-preview">${state.playlist.items.length ? renderSlide(state.contents.find((c) => c.id === state.playlist.items[0].contentId) || { template: "institutional", title: "GeoTV", fields: {} }) : `<div class="welcome-screen"><span class="slide-brand">geo<span>tv</span><i></i></span><h2>Um canal.<br>Muitas conexões.</h2><p>A próxima informação que faz a diferença<br>começa com você.</p><div class="route-line">● ───────── ◉ ───── ●</div></div>`}</div><div class="on-air-footer"><div><strong>${e(state.playlist.name)}</strong><small>${state.playlist.items.length} conteúdos · ${state.playlist.items.reduce((n, i) => n + i.duration, 0)} segundos por ciclo</small></div>${button("Ver programação ↗", "playlist", "text-button")}</div></section><section class="panel quick-panel"><div class="section-heading"><h2>Seu canal, no controle</h2></div><p>Da ideia à TV em poucos passos.</p>${can("edit") ? button('<span class="quick-icon">＋</span><span><strong>Criar conteúdo</strong><small>Escolha um modelo e comece</small></span>↗', "new", "quick-action") : ""}${button('<span class="quick-icon purple-icon">☷</span><span><strong>Organizar programação</strong><small>Uma sequência que faz sentido</small></span>↗', "playlist", "quick-action")}${can("publish") ? button('<span class="quick-icon orange-icon">⚑</span><span><strong>Aviso urgente</strong><small>Quando a mensagem não pode esperar</small></span>↗', "urgent", "quick-action") : ""}<div class="publish-box"><span>PRONTO PARA ENTRAR NO AR?</span><p>Envie a programação atualizada para suas TVs.</p>${can("publish") ? button("Publicar alterações ↗", "publish", "primary") : badge("Publicação restrita ao publicador")}</div></section></div><section class="panel"><div class="section-heading"><div><h2>Seus pontos de conexão</h2><p>Status e última comunicação de cada TV.</p></div>${button("Ver todas as TVs ↗", "devices", "text-button")}</div>${deviceTable(state.devices.slice(0, 4))}</section><div class="bottom-grid"><section class="panel"><div class="section-heading"><h2>Próximo conteúdo agendado</h2><span>◷</span></div><p>${upcoming ? `${e(upcoming.title)} · ${date(upcoming.start)}` : "Nenhum conteúdo agendado. Planeje as próximas mensagens no editor."}</p></section><section class="panel"><div class="section-heading"><h2>Última atividade</h2><span>↶</span></div><p>${state.audit[0] ? `${e(state.audit[0].author || "Sistema")} · ${e(state.audit[0].action)} · ${date(state.audit[0].created)}` : "Seu canal está pronto para começar."}</p></section></div>`;
  }
  function deviceTable(list) {
    return `<div class="table-wrap"><table><thead><tr><th>DISPOSITIVO</th><th>STATUS</th><th>EXIBINDO AGORA</th><th>VERSÃO</th><th>ÚLTIMA COMUNICAÇÃO</th><th></th></tr></thead><tbody>${list.map((d) => `<tr><td><span class="tv-icon">▣</span><strong>${e(d.name)}</strong><small>${e(d.group_name)}</small></td><td>${badge(online(d) ? "● Online" : "● Offline", online(d) ? "green" : "gray")}</td><td>${e(d.current_content || "Aguardando conexão")}</td><td>${d.version ? "v" + d.version : "—"}</td><td>${date(d.last_seen)}</td><td>${button("Detalhes", "device-detail", "text-button", `data-id="${d.id}"`)}${can("manage") ? button("Excluir TV", "delete-device", "delete-button", `data-id="${d.id}"`) : ""}</td></tr>`).join("") || '<tr><td colspan="6" class="empty">Nenhuma TV cadastrada. Adicione seu primeiro ponto de exibição.</td></tr>'}</tbody></table></div>`;
  }
  function contents() {
    return `<div class="toolbar"><input id="search" placeholder="Buscar conteúdo..." aria-label="Buscar conteúdo"><select id="filter-status"><option value="">Todos os status</option>${["Rascunho", "Agendado", "Publicado", "Aprovado", "Encerrado", "Arquivado"].map((s) => `<option>${s}</option>`).join("")}</select><select id="filter-category"><option value="">Todas as categorias</option>${[...new Set(templates.map((t) => t.category))].map((s) => `<option>${s}</option>`).join("")}</select><input id="filter-sector" placeholder="Setor" aria-label="Setor"><input id="filter-author" placeholder="Autor" aria-label="Autor"><input id="filter-date" type="date" aria-label="Data de exibição"></div><div class="content-grid" id="content-grid">${contentCards(state.contents)}</div>`;
  }
  function contentCards(list) {
    return (
      list
        .map(
          (c) =>
            `<article class="content-card"><button class="card-preview" data-action="preview" data-id="${c.id}">${renderSlide(c)}</button><div class="card-info"><div>${badge(c.status, c.active === false ? "gray" : "purple")}<small>${c.duration}s</small></div><h3>${e(c.title)}</h3><p>${e(c.category)} · ${e(c.sector || "Todos os setores")}</p><small>${c.start ? date(c.start) : "Sem data inicial"} → ${c.end ? date(c.end) : "Sem vencimento"}</small><div class="card-actions">${can("edit") ? button("Editar", "edit", "", `data-id="${c.id}"`) + button("Duplicar", "duplicate", "", `data-id="${c.id}"`) + `<select data-content-action="${c.id}" aria-label="Ações do conteúdo"><option value="">Mais ações</option><option value="add">Adicionar à programação</option><option value="toggle">${c.active === false ? "Ativar" : "Desativar"}</option><option value="archive">Arquivar</option><option value="delete">Excluir</option></select>` : ""}${can("publish") && state.settings.approval ? button("Aprovar", "approve", "", `data-id="${c.id}"`) : ""}</div></div></article>`,
        )
        .join("") ||
      '<div class="empty-state"><span>▤</span><h2>Uma nova história começa aqui.</h2><p>Crie seu primeiro conteúdo com um dos modelos GeoTV.</p></div>'
    );
  }
  function gallery() {
    return `<div class="gallery-intro"><span>FEITO PARA A SUA EMPRESA</span><h2>A informação é sua.<br>O design já está pronto.</h2><p>Modelos inteligentes para comunicar com clareza, em qualquer TV.</p></div><div class="template-grid">${templates.map((t) => `<button class="template-card" data-action="template" data-id="${t.id}"><div class="template-sample theme-${t.color}"><span>geo<b>tv</b></span><strong>${e(t.name)}</strong><div>${t.kind === "ranking" ? "▂ ▆ ▃" : t.kind === "metrics" ? "▂ ▃ ▅ ▄ ▇" : t.kind === "video" ? "▷" : t.kind === "image" ? "▧" : "─────\n───"}</div></div><h3>${e(t.name)}</h3><p>${e(t.category)} <span>Usar modelo ↗</span></p></button>`).join("")}</div>`;
  }
  function playlist() {
    return `<div class="toolbar"><select id="playlist-select" aria-label="Selecionar programação">${state.playlists.map((p) => `<option value="${p.id}" ${p.id === state.playlist.id ? "selected" : ""}>${e(p.name)}</option>`).join("")}</select>${can("edit") ? button("+ Nova programação", "new-playlist") + button("Excluir programação", "delete-playlist", "delete-button") : ""}<span>${state.playlist.items.length} conteúdos · ${state.playlist.items.reduce((n, i) => n + i.duration, 0)}s por ciclo · repetição contínua</span>${can("edit") ? button("+ Adicionar conteúdo", "add-picker") : ""}${can("publish") ? button("Publicar programação ↗", "publish", "primary") : ""}</div><section class="panel playlist-list">${
      state.playlist.items
        .map((item, i) => {
          const c = state.contents.find((c) => c.id === item.contentId);
          return `<div class="playlist-item" draggable="${can("edit")}" data-index="${i}"><span class="drag-handle">⠿</span><b class="item-number">${String(i + 1).padStart(2, "0")}</b><div class="playlist-thumb">${renderSlide(c)}</div><div class="playlist-title"><strong>${e(c.title)}</strong><small>${e(c.category)} · ${c.start ? date(c.start) : "Sem restrição de início"}</small></div><label class="duration"><input type="number" min="5" max="3600" data-duration="${i}" value="${item.duration}" ${can("edit") ? "" : "disabled"}> s</label>${can("edit") ? button("↑", "move-up", "", `data-index="${i}" aria-label="Mover para cima"`) + button("↓", "move-down", "", `data-index="${i}" aria-label="Mover para baixo"`) + button("×", "remove-item", "", `data-index="${i}" aria-label="Remover"`) : ""}</div>`;
        })
        .join("") ||
      '<div class="empty-state"><span>☷</span><h2>Sua programação está em branco.</h2><p>Adicione conteúdos e organize a sequência de exibição.</p></div>'
    }<div class="loop-note">↻ Ao terminar, a programação volta automaticamente ao início.</div></section>`;
  }
  function devices() {
    return `<div class="toolbar"><strong>${state.devices.length} dispositivos</strong>${can("manage") ? button("+ Nova TV", "new-device", "primary") : ""}</div><section class="panel">${deviceTable(state.devices)}</section>`;
  }
  function media() {
    return `<div class="toolbar"><input id="media-search" placeholder="Buscar arquivo ou categoria" aria-label="Buscar mídia">${can("edit") ? `<label class="upload-button">＋ Enviar arquivos<input type="file" id="upload" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple hidden></label>` : ""}<span>Imagens até 10 MB · Vídeos até 100 MB</span></div><div class="media-grid">${state.media.map((m) => `<article class="media-card" data-media-name="${e((m.name + " " + m.category).toLowerCase())}">${m.mime.startsWith("image") ? `<img src="${m.url}" alt="${e(m.name)}" loading="lazy">` : `<video src="${m.url}" controls preload="metadata"></video>`}<h3>${e(m.name)}</h3><p>${e(m.category)} · ${(m.size / 1024 / 1024).toFixed(2)} MB</p>${can("edit") ? `<div class="media-actions">${button("Excluir", "delete-media", "delete-button", `data-id="${m.id}"`)}</div>` : ""}</article>`).join("") || '<div class="empty-state"><span>▧</span><h2>Uma biblioteca, muitas possibilidades.</h2><p>Envie imagens e vídeos para reutilizar nos seus conteúdos.</p></div>'}</div>`;
  }
  function history() {
    return `<section class="panel"><div class="section-heading"><h2>Versões publicadas</h2><span>Restaurar cria uma nova versão</span></div>${state.publications.map((p) => `<div class="history-row"><span class="version">v${p.id}</span><div><strong>Programação publicada</strong><small>${e(p.author)} · ${date(p.created)}</small></div>${can("publish") ? button("Restaurar versão", "restore", "", `data-id="${p.id}"`) : ""}</div>`).join("") || '<p class="empty">Nenhuma publicação ainda.</p>'}</section><section class="panel"><div class="section-heading"><h2>Registro de atividades</h2></div>${state.audit.map((a) => `<details class="audit-entry"><summary><strong>${e(a.author || "Sistema")}</strong> ${e(a.action)} <small>${date(a.created)}</small></summary><p>Referência: ${e(a.entity)}</p><div class="audit-values"><pre>Antes\n${e(JSON.stringify(JSON.parse(a.before_value), null, 2))}</pre><pre>Depois\n${e(JSON.stringify(JSON.parse(a.after_value), null, 2))}</pre></div></details>`).join("")}</section>`;
  }
  function users() {
    return `<div class="toolbar">${button("+ Novo usuário", "new-user", "primary")}</div><section class="panel" id="users-table">Carregando usuários...</section>`;
  }
  function settingsView() {
    const s = state.settings;
    return `<form id="settings-form" class="panel settings-form"><h2>Preferências do canal</h2><label>Nome da plataforma<input name="name" value="${e(s.name)}" required></label><div class="form-row"><label>Duração padrão (segundos)<input name="duration" type="number" min="5" max="3600" value="${s.duration}"></label><label>Heartbeat (segundos)<input name="heartbeat" type="number" min="10" max="120" value="${s.heartbeat}"></label></div><label>Transição<select name="transition">${[
      ["fade", "Fade suave"],
      ["slide", "Deslizar"],
      ["zoom", "Zoom leve"],
      ["none", "Sem transição"],
    ]
      .map(
        ([k, v]) =>
          `<option value="${k}" ${s.transition === k ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Fuso horário<input name="timezone" value="${e(s.timezone)}" required></label><label class="check-label"><input type="checkbox" name="approval" ${s.approval ? "checked" : ""}> Exigir aprovação antes de publicar</label><p class="hint">A última programação válida permanece disponível offline. Alterações nas preferências do Player são aplicadas na próxima publicação.</p><button class="primary">Salvar configurações</button></form>`;
  }

  return {
    Dashboard: dashboard,
    Conteúdos: contents,
    Programação: playlist,
    TVs: devices,
    Mídia: media,
    Templates: gallery,
    Histórico: history,
    Usuários: users,
    Configurações: settingsView,
    contentCards,
  };
}
