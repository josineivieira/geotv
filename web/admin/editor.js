import { request, toast } from "./api.js";
import { uploadFile } from "./uploads.js";
import { mountPresentationEditor } from "./presentation-editor.js";
import { storyDefaults, storyFrames } from "/shared/client-story.js";
import { hydroDefaults, hydroFrames } from "/shared/hydrology.js";
import { salesDefaults, salesFrames } from "/shared/sales-show.js";
import { alertDefaults, alertFrames } from "/shared/process-alerts.js";
import {
  templateById,
  renderSlide,
  escapeHtml as e,
} from "/shared/templates.js";
export function openEditor(original, state, onSaved) {
  const content = structuredClone(original),
    template = templateById(content.template),
    dialog = document.querySelector("#modal");
  const animated = [
    "client-story",
    "hydrology",
    "sales-show",
    "process-alerts",
  ].includes(content.template);
  const sceneCount =
    content.template === "process-alerts"
      ? 5
      : content.template === "sales-show"
        ? 3
        : content.template === "hydrology"
          ? 6
          : 13;
  if (animated) {
    content.fields = {
      ...(content.template === "process-alerts"
        ? alertDefaults
        : content.template === "sales-show"
          ? salesDefaults
          : content.template === "hydrology"
            ? hydroDefaults
            : storyDefaults),
      ...content.fields,
    };
    if (!content.id) content.duration = sceneCount * 10;
  }
  dialog.classList.add("editor-dialog");
  const input = (key, label, type = "text", value = "", extra = "") =>
    `<label>${e(label)}${type === "textarea" ? `<textarea name="${key}" ${extra}>${e(value)}</textarea>` : type === "checkbox" ? `<input type="checkbox" name="${key}" ${value ? "checked" : ""}>` : `<input type="${type}" name="${key}" value="${e(value)}" ${extra}>`}</label>`;
  const localDate = (value) =>
    value
      ? new Date(
          new Date(value).getTime() -
            new Date(value).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
  dialog.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">EDITOR DE CONTEÚDO / ${e(template.name)}</span><h2>A informação ganha vida aqui.</h2></div><button id="close-editor" aria-label="Fechar">×</button></div><form id="editor-form"><div class="editor-grid"><div class="editor-fields"><h3>01 / Conteúdo</h3>${input("title", "Título", "text", content.title, 'required maxlength="120"')}${template.fields.map(([key, label, type]) => input("field_" + key, label, type || "text", content.fields[key] ?? (type === "checkbox" ? true : ""), type === "number" ? 'step="any"' : "")).join("")}<label>Imagem / vídeo da biblioteca<select name="field_media"><option value="">Sem mídia</option>${state.media
    .filter((m) =>
      template.kind === "video"
        ? m.mime.startsWith("video")
        : m.mime.startsWith("image"),
    )
    .map(
      (m) =>
        `<option value="${m.url}" ${content.fields.media === m.url ? "selected" : ""}>${e(m.name)}</option>`,
    )
    .join(
      "",
    )}</select></label><h3>02 / Exibição</h3><div class="form-row">${input("duration", "Duração (segundos)", "number", content.duration, 'min="5" max="3600" required')}${input("sector", "Setor", "text", content.sector || "")}</div><label>Status<select name="status">${["Rascunho", "Agendado", "Encerrado", "Arquivado"].map((s) => `<option ${content.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label><div class="form-row">${input("start", "Data inicial", "datetime-local", localDate(content.start))}${input("end", "Data final", "datetime-local", localDate(content.end))}</div><div class="form-row">${input("timeStart", "Horário inicial", "time", content.timeStart)}${input("timeEnd", "Horário final", "time", content.timeEnd)}</div><p class="hint">Datas usam o fuso deste computador. Horários recorrentes usam ${e(state.settings.timezone)}.</p><div class="weekdays">${["D", "S", "T", "Q", "Q", "S", "S"].map((day, i) => `<label title="${["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][i]}"><input type="checkbox" name="days" value="${i}" ${content.days?.includes(i) ? "checked" : ""}><span>${day}</span></label>`).join("")}</div><p class="hint">Nenhum dia marcado = todos os dias.</p><h3>03 / Aparência</h3><label>Variação de layout<select name="field_layout"><option value="standard">Padrão</option><option value="compact" ${content.fields.layout === "compact" ? "selected" : ""}>Compacto</option></select></label><label>Tamanho de fonte<input type="range" name="field_fontScale" min="0.8" max="1.2" step="0.05" value="${content.fields.fontScale || 1}"></label><label class="check-label"><input type="checkbox" name="demo" ${content.demo ? "checked" : ""}> Dados de demonstração</label></div><div class="editor-preview"><div class="preview-heading"><span><i class="green-dot"></i> PREVIEW EM TEMPO REAL</span><span>16:9 · FULL HD</span></div><div id="live-preview" class="large-preview">${renderSlide(content)}</div><p>Esta é a mesma renderização utilizada no GeoTV Player.</p><div class="editor-tip"><strong>Feito para ser visto de longe.</strong><p>Prefira mensagens curtas, títulos claros e números que contam uma história.</p></div></div></div><div class="editor-footer"><span>Salvar mantém as alterações em rascunho até a próxima publicação.</span><label class="check-label"><input type="checkbox" name="addPlaylist"> Adicionar à programação</label><button class="primary">Salvar conteúdo</button></div></form>`;
  const close = () => {
    dialog.close();
    dialog.classList.remove("editor-dialog");
    dialog.innerHTML = "";
  };
  document.querySelector("#close-editor").onclick = close;
  dialog.addEventListener(
    "close",
    () => dialog.classList.remove("editor-dialog"),
    { once: true },
  );
  const form = document.querySelector("#editor-form");
  if (animated) {
    const duration = form.elements.duration;
    duration.min = String(sceneCount * 5);
    duration.parentElement.firstChild.textContent = `Duração total das ${sceneCount} telas (segundos)`;
    form.querySelector("[name=field_media]").parentElement.hidden = true;
    const play = document.createElement("button");
    play.type = "button";
    play.textContent = `▶ Assistir às ${sceneCount} telas`;
    dialog.querySelector(".editor-preview").append(play);
    let timer,
      scene = 0;
    const stop = () => {
      clearInterval(timer);
      timer = null;
      play.textContent = `▶ Assistir às ${sceneCount} telas`;
    };
    play.onclick = () => {
      if (timer) {
        stop();
        return;
      }
      read();
      scene = 0;
      const frames =
        content.template === "process-alerts"
          ? alertFrames(content)
          : content.template === "sales-show"
            ? salesFrames(content)
            : content.template === "hydrology"
              ? hydroFrames(content)
              : storyFrames(content);
      const draw = () => {
        dialog.querySelector("#live-preview").innerHTML = renderSlide(
          frames[scene++ % frames.length],
        );
      };
      draw();
      timer = setInterval(
        draw,
        Math.max(5, content.duration / sceneCount) * 1000,
      );
      play.textContent = "■ Parar apresentação";
    };
    form.addEventListener("input", stop);
    dialog.addEventListener("close", stop, { once: true });
  }
  let presentation;
  const mediaSelect = form.querySelector("[name=field_media]");
  mediaSelect.parentElement.insertAdjacentHTML(
    "afterend",
    `<label class="upload-button">＋ Enviar minha ${template.kind === "video" ? "vídeo" : "imagem"}<input id="editor-upload" type="file" accept="${template.kind === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp"}" hidden></label><p class="hint">O arquivo fica salvo na biblioteca para reutilizar em outras telas.</p>`,
  );
  if (template.id === "presentation")
    mediaSelect.parentElement.insertAdjacentHTML(
      "afterend",
      `<label>Ajuste da imagem<select name="field_fit"><option value="contain">Mostrar imagem inteira</option><option value="cover" ${content.fields.fit === "cover" ? "selected" : ""}>Preencher a tela (recortar bordas)</option></select></label><label class="check-label"><input name="field_showText" type="checkbox" ${content.fields.showText ? "checked" : ""}> Mostrar título e mensagem sobre a imagem</label>`,
    );
  let uploading = false;
  form.querySelector("#editor-upload").onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    uploading = true;
    const save = form.querySelector("button.primary");
    save.disabled = true;
    try {
      const media = await uploadFile(file);
      if (!state.media.some((item) => item.id === media.id))
        state.media.unshift(media);
      if (
        ![...mediaSelect.options].some((option) => option.value === media.url)
      )
        mediaSelect.add(new Option(media.name, media.url));
      mediaSelect.value = media.url;
      read();
      if (form.isConnected)
        dialog.querySelector("#live-preview").innerHTML = renderSlide(content);
      toast("Imagem enviada e aplicada ao preview.");
    } catch (error) {
      toast(error.message);
    } finally {
      uploading = false;
      save.disabled = false;
    }
  };
  function read() {
    const data = new FormData(form);
    content.title = data.get("title");
    content.duration = Number(data.get("duration"));
    content.sector = data.get("sector");
    content.status = data.get("status");
    content.demo = data.has("demo");
    content.days = data.getAll("days").map(Number);
    for (const k of ["start", "end"])
      content[k] = data.get(k) ? new Date(data.get(k)).toISOString() : "";
    for (const k of ["timeStart", "timeEnd"]) content[k] = data.get(k);
    for (const [k] of template.fields)
      content.fields[k] = data.get("field_" + k) || "";
    for (const [k, , type] of template.fields)
      if (type === "checkbox") content.fields[k] = data.has("field_" + k);
    for (const k of ["media", "layout", "fontScale"])
      content.fields[k] = data.get("field_" + k);
    if (template.id === "presentation") {
      content.fields.fit = data.get("field_fit");
      content.fields.showText = data.has("field_showText");
    }
    presentation?.read();
    return data;
  }
  form.oninput = () => {
    read();
    if (presentation) presentation.preview();
    else
      document.querySelector("#live-preview").innerHTML = renderSlide(content);
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (uploading || presentation?.isBusy()) return;
    const data = read(),
      button = form.querySelector("button[type=submit],button.primary");
    button.disabled = true;
    try {
      presentation?.validate();
      const saved = await request(
        "/contents" + (content.id ? "/" + content.id : ""),
        content.id ? "PUT" : "POST",
        content,
      );
      if (data.has("addPlaylist"))
        await request("/playlist", "PUT", {
          ...state.playlist,
          items: [
            ...state.playlist.items,
            { contentId: saved.id, duration: saved.duration },
          ],
        });
      close();
      await onSaved();
      toast("Conteúdo salvo. Publique para atualizar as TVs.");
    } catch (error) {
      toast(error.message);
      button.disabled = false;
    }
  };
  if (template.id === "presentation")
    presentation = mountPresentationEditor({ form, dialog, content, state });
  dialog.showModal();
}
