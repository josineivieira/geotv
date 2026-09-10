import { request, toast } from "./api.js";
import { escapeHtml as e } from "/shared/templates.js";
export async function showChannels(app, onLogout) {
  app.innerHTML = '<main class="channel-home"><p>Carregando canais…</p></main>';
  const channels = await request("/channels");
  app.innerHTML = `<main class="channel-home"><header><a class="brand" href="/">geo<span>tv</span><i></i></a><button id="channels-logout">Sair</button></header><div class="eyebrow">SEU CANAL CORPORATIVO</div><h1>O que vamos assistir?</h1><p>Escolha um canal para iniciar a reprodução.</p><div class="channel-grid">${channels.map((c) => `<a class="channel-card" href="/watch/${encodeURIComponent(c.id)}"><span class="channel-symbol">▶</span><h2>${e(c.name)}</h2><p>${e(c.group)}</p><p>${c.version ? `${c.count} conteúdos · ${c.duration}s por ciclo` : "Aguardando publicação"}</p><strong>Assistir ao canal ↗</strong></a>`).join("") || "<p>Nenhuma TV cadastrada ainda. Aguarde o cadastro pelo administrador.</p>"}</div></main>`;
  app.querySelector("#channels-logout").onclick = async () => {
    try {
      await request("/logout", "POST");
      onLogout();
    } catch (error) {
      toast(error.message);
    }
  };
}
