import { request, toast } from "./api.js";
import { escapeHtml as e } from "/shared/templates.js";
export function mountTargets(state, can, refresh) {
  const list = document.querySelector(".playlist-list");
  if (!list) return;
  const writable = can("edit") || can("publish");
  const section = document.createElement("section");
  section.className = "panel playlist-targets";
  section.innerHTML = `<div class="section-heading"><div><h2>Em quais canais esta programação vai passar?</h2><p>Selecione os canais, salve e clique em Publicar programação.</p></div></div><div class="target-grid">${state.devices.map((d) => `<label><input type="checkbox" value="${d.id}" ${state.playlist.targetDevices?.includes(d.id) ? "checked" : ""} ${writable ? "" : "disabled"}><span><strong>${e(d.name)}</strong><small>${e(d.group_name)}</small></span></label>`).join("") || "<p>Nenhum canal cadastrado. Cadastre uma TV para publicar.</p>"}</div>${writable ? '<div class="target-footer"><button type="button" class="primary" id="save-targets">Salvar canais</button><span id="target-status">A seleção só altera a transmissão depois de publicar.</span></div>' : ""}`;
  list.before(section);
  const button = section.querySelector("#save-targets");
  if (!button) return;
  let pending = false;
  section.onchange = () => {
    pending = true;
    section.dataset.unsaved = "true";
    section.querySelector("#target-status").textContent =
      "Seleção alterada. Salve os canais antes de publicar.";
  };
  button.onclick = async () => {
    button.disabled = true;
    try {
      await request("/playlist/targets", "PUT", {
        id: state.playlist.id,
        devices: [...section.querySelectorAll("input:checked")].map(
          (input) => input.value,
        ),
      });
      pending = false;
      await refresh();
      toast("Canais salvos. Publique para enviar a programação.");
    } catch (error) {
      toast(error.message);
      button.disabled = false;
    }
  };
}
