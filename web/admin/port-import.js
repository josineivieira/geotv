import {
  importPortRows,
  portFrames,
  portSummary,
} from "/shared/port-alerts.js";
import { renderSlide } from "/shared/templates.js";
export function mountPortImport({ form, dialog, content }) {
  const holder = document.createElement("section");
  holder.innerHTML = `<label class="upload-button">Importar / substituir planilha<input type="file" accept=".xls,.xlsx" data-port-file></label><p class="hint">Use a exportação PENDENTE AGENDAMENTO do ERP. Entregas programadas sem data de descarga recebem destaque, inclusive antes de 3 dias. Cada importação substitui a base inteira. Dias corridos desde a chegada: alerta ≥ 3 dias; crítico ≥ 7 dias.</p><p data-port-status role="status"></p><p class="hint">Depois de importar, salve e publique a programação para atualizar as TVs.</p>`;
  form.querySelector(".editor-fields h3").after(holder);
  const status = holder.querySelector("[data-port-status]");
  const dateInput = form.elements.field_referenceDate;
  dateInput.required = true;
  dateInput.value ||= new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  content.fields.referenceDate = dateInput.value;
  const update = () => {
    const s = portSummary(content.fields);
    status.textContent = `${s.total} processos · ${s.rows.length} em alerta · ${s.critical} críticos · ${s.missingSchedule.length} entregas programadas sem data${s.invalid ? ` · ${s.invalid} datas futuras excluídas (confira a referência)` : ""}`;
  };
  update();
  let timer;
  const stop = () => {
    clearInterval(timer);
    timer = null;
  };
  const play = document.createElement("button");
  play.type = "button";
  play.textContent = "▶ Assistir às telas do porto";
  dialog.querySelector(".editor-preview").append(play);
  play.onclick = () => {
    if (timer) {
      stop();
      return;
    }
    const frames = portFrames(content);
    let i = 0;
    const draw = () =>
      (dialog.querySelector("#live-preview").innerHTML = renderSlide(
        frames[i++ % frames.length],
      ));
    draw();
    timer = setInterval(
      draw,
      Math.max(5, content.duration / frames.length) * 1000,
    );
  };
  form.addEventListener("input", () => {
    stop();
    content.fields.referenceDate = dateInput.value;
    update();
  });
  dialog.addEventListener("close", stop, { once: true });
  holder.querySelector("input").onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    stop();
    const save = form.querySelector("button.primary");
    save.disabled = true;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Use uma planilha de até 5 MB.");
      status.textContent = "Lendo planilha…";
      const XLSX = await import("/vendor/xlsx/xlsx.mjs");
      const book = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: false,
      });
      let result, lastError;
      for (const name of book.SheetNames) {
        try {
          result = importPortRows(
            XLSX.utils.sheet_to_json(book.Sheets[name], {
              header: 1,
              raw: false,
              dateNF: "dd/mm/yyyy",
              defval: "",
            }),
          );
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!result) throw lastError || new Error("Planilha inválida.");
      content.fields.portRecords = JSON.stringify(result.records);
      content.fields.sourceName = file.name;
      content.fields.importedAt = new Date().toISOString();
      content.fields.referenceDate = dateInput.value;
      content.demo = false;
      form.elements.demo.checked = false;
      const count = portFrames(content).length;
      form.elements.duration.value = content.duration = Math.max(
        30,
        count * 10,
      );
      update();
      status.textContent += ` · ${result.duplicates} duplicados ignorados. Confira a data de referência.`;
      dialog.querySelector("#live-preview").innerHTML = renderSlide(content);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      save.disabled = false;
      event.target.value = "";
    }
  };
}
