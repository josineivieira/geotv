import { renderSlide, escapeHtml as e } from "/shared/templates.js";
import { presentationFrames } from "/shared/presentation.js";
import { uploadFile } from "./uploads.js";
import { importDocument } from "./imports.js";
import { toast } from "./api.js";
export function mountPresentationEditor({ form, dialog, content, state }) {
  const slides = content.slides
    ? structuredClone(content.slides)
    : content.fields.media
      ? [
          {
            media: content.fields.media,
            duration: Math.min(300, content.duration || 20),
            transition: "fade",
            fit: content.fields.fit || "contain",
            title: content.title,
            message: content.fields.message || "",
            showText: !!content.fields.showText,
          },
        ]
      : [];
  let selected = 0,
    busy = false,
    timer = null,
    playing = false,
    dragIndex,
    disposed = false;
  const controller = new AbortController();
  const preview = dialog.querySelector("#live-preview");
  const host = document.createElement("section");
  host.className = "presentation-builder";
  host.innerHTML = `<h3>Telas da apresentação</h3><div class="presentation-imports"><label class="upload-button">＋ Adicionar fotos<input id="presentation-images" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></label><label class="upload-button">Importar PDF / PowerPoint<input id="presentation-document" type="file" accept=".pdf,.ppt,.pptx" hidden></label></div><p class="hint">Até 60 telas. Imagens: 10 MB cada. PDF / PowerPoint: 40 MB. As páginas importadas viram imagens; configure os efeitos aqui.</p><label>Usar imagem da biblioteca<select id="presentation-library"><option value="">Selecione uma imagem…</option>${state.media
    .filter((m) => m.mime.startsWith("image/"))
    .map((m) => `<option value="${e(m.url)}">${e(m.name)}</option>`)
    .join(
      "",
    )}</select></label><p id="presentation-progress" role="status"></p><div class="presentation-controls"><button type="button" id="presentation-play">▶ Reproduzir preview</button><span id="presentation-summary"></span></div><div id="presentation-slides" class="presentation-slides"></div><div id="presentation-detail"></div>`;
  form.querySelector("[name=title]").closest("label").after(host);
  // Single-image controls remain available to other templates; this editor owns its slide list.
  for (const selector of [
    "[name=field_media]",
    "#editor-upload",
    "[name=field_fit]",
    "[name=field_showText]",
    "[name=field_message]",
  ])
    form.querySelector(selector)?.closest("label")?.setAttribute("hidden", "");
  form.querySelector("[name=duration]").readOnly = true;
  form
    .querySelector("[name=duration]")
    .closest("label").firstChild.textContent =
    "Duração total (calculada em segundos)";
  const bulk = document.createElement("div");
  bulk.className = "presentation-bulk";
  bulk.innerHTML =
    '<h3>Tempo e efeito de todas as telas</h3><div class="form-row"><label>Segundos por tela<input id="presentation-bulk-duration" type="number" min="5" max="300" step="1" value="20"></label><label>Efeito<select id="presentation-bulk-transition"><option value="fade">Fade suave</option><option value="slide">Deslizar</option><option value="zoom">Zoom leve</option><option value="none">Sem efeito</option></select></label></div><button type="button" id="presentation-apply-all">Aplicar a todas as telas</button><p class="hint">Ou selecione uma miniatura para ajustar somente aquela tela.</p>';
  host.querySelector(".presentation-controls").after(bulk);
  bulk.querySelector("#presentation-apply-all").onclick = () => {
    if (busy) return;
    const input = bulk.querySelector("input");
    if (!input.reportValidity()) return;
    if (!slides.length) {
      toast("Adicione imagens ou importe um documento primeiro.");
      return;
    }
    const duration = Number(input.value);
    if (!Number.isInteger(duration) || duration < 5 || duration > 300) {
      toast("Use de 5 a 300 segundos por tela.");
      return;
    }
    if (duration * slides.length > 3600) {
      toast("A apresentação deve durar no máximo uma hora.");
      return;
    }
    stop();
    for (const slide of slides) {
      slide.duration = duration;
      slide.transition = bulk.querySelector("select").value;
    }
    draw();
    toast("Tempo e efeito aplicados. Salve para manter as alterações.");
  };
  function updateContent() {
    content.slides = slides;
    content.duration = slides.reduce((n, s) => n + s.duration, 0) || 20;
    content.fields.media = slides[0]?.media || "";
    form.querySelector("[name=duration]").value = content.duration;
  }
  function show() {
    if (disposed) return;
    updateContent();
    const frame = presentationFrames(content)[selected];
    preview.innerHTML = frame
      ? `<div class="presentation-preview-frame effect-${playing ? frame.transition : "none"}">${renderSlide(frame)}</div>`
      : '<div class="presentation-empty">Adicione fotos ou importe um documento para começar.</div>';
  }
  function stop() {
    clearTimeout(timer);
    timer = null;
    playing = false;
    host.querySelector("#presentation-play").textContent =
      "▶ Reproduzir preview";
  }
  function play() {
    if (!slides.length || busy) return;
    playing = true;
    host.querySelector("#presentation-play").textContent = "Ⅱ Pausar";
    draw();
    timer = setTimeout(() => {
      selected = (selected + 1) % slides.length;
      play();
    }, slides[selected].duration * 1000);
  }
  function draw() {
    if (disposed) return;
    updateContent();
    host.querySelector("#presentation-summary").textContent =
      `${slides.length} telas · ${slides.reduce((n, s) => n + s.duration, 0)}s`;
    host.querySelector("#presentation-slides").innerHTML = slides
      .map(
        (slide, i) =>
          `<div class="presentation-thumb ${i === selected ? "selected" : ""}" draggable="${!busy}" data-slide="${i}"><button type="button" data-select="${i}" aria-label="Editar tela ${i + 1}"><img src="${e(slide.media)}" alt="Tela ${i + 1}"><span>${i + 1} · ${slide.duration}s</span></button><div><button type="button" data-move="${i}" data-offset="-1" aria-label="Mover tela para trás">←</button><button type="button" data-move="${i}" data-offset="1" aria-label="Mover tela para frente">→</button><button type="button" data-remove="${i}" aria-label="Remover tela">×</button></div></div>`,
      )
      .join("");
    const s = slides[selected];
    host.querySelector("#presentation-detail").innerHTML = s
      ? `<h3>Tela ${selected + 1}</h3><div class="form-row"><label>Duração (segundos)<input data-slide-field="duration" type="number" min="5" max="300" value="${s.duration}" required></label><label>Transição<select data-slide-field="transition">${[
          ["fade", "Fade suave"],
          ["slide", "Deslizar"],
          ["zoom", "Zoom leve"],
          ["none", "Sem efeito"],
        ]
          .map(
            ([v, label]) =>
              `<option value="${v}" ${s.transition === v ? "selected" : ""}>${label}</option>`,
          )
          .join(
            "",
          )}</select></label></div><label>Enquadramento<select data-slide-field="fit"><option value="contain" ${s.fit === "contain" ? "selected" : ""}>Imagem inteira</option><option value="cover" ${s.fit === "cover" ? "selected" : ""}>Preencher tela</option></select></label><label class="check-label"><input type="checkbox" data-slide-field="showText" ${s.showText ? "checked" : ""}> Mostrar título e mensagem</label><label>Título da tela<input data-slide-field="title" maxlength="120" value="${e(s.title)}"></label><label>Mensagem<textarea data-slide-field="message" maxlength="1000">${e(s.message)}</textarea></label>`
      : "";
    show();
  }
  function add(media) {
    if (slides.length >= 60)
      throw new Error(
        "Limite de 60 telas atingido. As telas já importadas foram mantidas.",
      );
    if (!state.media.some((m) => m.id === media.id)) state.media.unshift(media);
    slides.push({
      media: media.url,
      title: "",
      message: "",
      duration: 20,
      transition: "fade",
      fit: "contain",
      showText: false,
    });
    selected = slides.length - 1;
    draw();
  }
  async function run(job) {
    if (busy) return;
    stop();
    busy = true;
    const save = form.querySelector("button.primary");
    save.disabled = true;
    host
      .querySelectorAll("input[type=file],select,button")
      .forEach((el) => (el.disabled = true));
    try {
      await job();
      if (!disposed)
        host.querySelector("#presentation-progress").textContent =
          "Importação concluída. Revise as telas e salve.";
    } catch (error) {
      if (!disposed) {
        host.querySelector("#presentation-progress").textContent =
          error.name === "AbortError" ? "Importação cancelada." : error.message;
        toast(error.message);
      }
    } finally {
      busy = false;
      if (!disposed) {
        save.disabled = false;
        host
          .querySelectorAll("input,select,button")
          .forEach((el) => (el.disabled = false));
        draw();
      }
    }
  }
  host.querySelector("#presentation-images").onchange = (event) => {
    const files = [...event.target.files];
    run(async () => {
      if (files.length + slides.length > 60)
        throw new Error("Selecione no máximo 60 imagens no total.");
      for (const [i, file] of files.entries()) {
        controller.signal.throwIfAborted();
        host.querySelector("#presentation-progress").textContent =
          `Enviando imagem ${i + 1} de ${files.length}…`;
        const media = await uploadFile(file);
        controller.signal.throwIfAborted();
        add(media);
      }
    });
    event.target.value = "";
  };
  host.querySelector("#presentation-document").onchange = (event) => {
    const file = event.target.files[0];
    if (file)
      run(() =>
        importDocument(
          file,
          add,
          (message) => {
            if (!disposed)
              host.querySelector("#presentation-progress").textContent =
                message;
          },
          controller.signal,
        ),
      );
    event.target.value = "";
  };
  host.querySelector("#presentation-library").onchange = (event) => {
    if (!event.target.value || busy) return;
    stop();
    try {
      add(state.media.find((m) => m.url === event.target.value));
    } catch (error) {
      toast(error.message);
    }
    event.target.value = "";
  };
  host.querySelector("#presentation-play").onclick = () =>
    playing ? stop() : play();
  host.addEventListener("click", (event) => {
    if (busy) return;
    const target = event.target.closest(
      "[data-select],[data-move],[data-remove]",
    );
    if (!target) return;
    stop();
    if (target.dataset.select !== undefined)
      selected = Number(target.dataset.select);
    if (target.dataset.remove !== undefined) {
      slides.splice(Number(target.dataset.remove), 1);
      selected = Math.min(selected, Math.max(0, slides.length - 1));
    }
    if (target.dataset.move !== undefined) {
      const i = Number(target.dataset.move),
        j = i + Number(target.dataset.offset);
      if (j >= 0 && j < slides.length) {
        [slides[i], slides[j]] = [slides[j], slides[i]];
        selected = j;
      }
    }
    draw();
  });
  host.addEventListener("input", (event) => {
    const key = event.target.dataset.slideField;
    if (!key || busy) return;
    stop();
    slides[selected][key] =
      key === "duration"
        ? Number(event.target.value)
        : key === "showText"
          ? event.target.checked
          : event.target.value;
    show();
    host.querySelector("#presentation-summary").textContent =
      `${slides.length} telas · ${content.duration}s`;
    const caption = host.querySelector(`[data-select="${selected}"] span`);
    if (caption)
      caption.textContent = `${selected + 1} · ${slides[selected].duration}s`;
  });
  host.ondragstart = (event) => {
    if (busy) {
      event.preventDefault();
      return;
    }
    const tile = event.target.closest("[data-slide]");
    if (tile) dragIndex = Number(tile.dataset.slide);
  };
  host.ondragover = (event) => {
    if (event.target.closest("[data-slide]")) event.preventDefault();
  };
  host.ondrop = (event) => {
    event.preventDefault();
    const tile = event.target.closest("[data-slide]");
    if (busy || !tile || dragIndex === undefined) return;
    stop();
    const [s] = slides.splice(dragIndex, 1);
    selected = Number(tile.dataset.slide);
    slides.splice(selected, 0, s);
    dragIndex = undefined;
    draw();
  };
  dialog.addEventListener(
    "close",
    () => {
      disposed = true;
      stop();
      controller.abort();
    },
    { once: true },
  );
  draw();
  return {
    read: updateContent,
    preview: show,
    isBusy: () => busy,
    validate() {
      if (!slides.length) throw new Error("Adicione pelo menos uma tela.");
      if (busy) throw new Error("Aguarde a importação terminar.");
    },
  };
}
