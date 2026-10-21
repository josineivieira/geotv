import test from "node:test";
import assert from "node:assert/strict";
import {
  importPortRows,
  portSummary,
  portPages,
  isoDate,
} from "../web/shared/port-alerts.js";
import { presentationFrames } from "../web/shared/presentation.js";
import { renderSlide } from "../web/shared/templates.js";
const header = [
  "Código",
  "Dt. chegada",
  "Porto de destino",
  "Remetente",
  "Destinatário",
];
test("70 alertas: destaca top 5, limita 40 processos de 3 dias a 6 e preserva totais", () => {
  const records = Array.from({ length: 70 }, (_, i) => ({
    code: `CAB${String(i).padStart(3, "0")}`,
    arrival: i < 40 ? "2026-10-17" : "2026-10-10",
    port: "MANAUS",
    sender: "A",
    recipient: "B",
  }));
  const content = {
    template: "port-alerts",
    duration: 100,
    fields: {
      referenceDate: "2026-10-20",
      portRecords: JSON.stringify(records),
    },
  };
  const summary = portSummary(content.fields);
  const pages = portPages(summary.rows);
  const shown = pages.flatMap((p) => p.rows);
  assert.equal(summary.rows.length, 70);
  assert.equal(summary.critical, 30);
  assert.equal(pages[0].top, true);
  assert.deepEqual(pages[0].rows, summary.rows.slice(0, 5));
  assert.equal(shown.filter((r) => r.days === 3).length, 6);
  assert.equal(shown.filter((r) => r.days > 3).length, 30);
  assert.equal(new Set(shown.map((r) => r.code)).size, 36);
  const frames = presentationFrames(content);
  assert.equal(frames.length, 8);
  assert.match(renderSlide(frames[0]), /<strong>70<\/strong>/);
  assert.match(renderSlide(frames[1]), /Os 5 mais críticos/);
  assert.match(renderSlide(frames[1]), /36 de 70 alertas exibidos/);
});
test("limite de seis vale também quando todos têm três dias", () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({
    code: `CAB${i}`,
    days: 3,
  }));
  const pages = portPages(rows);
  assert.equal(pages.flatMap((p) => p.rows).length, 6);
  assert.equal(pages[0].rows.length, 5);
  assert.equal(pages[1].rows.length, 1);
  assert.deepEqual(portPages([]), []);
});
test("importação reconhece cabeçalhos, elimina duplicados e rejeita datas inválidas", () => {
  const row = ["CAB1", "17/10/2026", "MANAUS", "A", "B"];
  const result = importPortRows([["Relatório"], header, row, row]);
  assert.equal(result.records.length, 1);
  assert.equal(result.duplicates, 1);
  assert.equal(result.records[0].arrival, "2026-10-17");
  assert.equal(isoDate("31/02/2026"), null);
  assert.throws(
    () => importPortRows([header, ["CAB2", "errada", "MANAUS", "A", "B"]]),
    /Linha 2/,
  );
  assert.throws(() => importPortRows([["Outra planilha"]]), /Não encontrei/);
});
test("dias corridos, limites de alerta, datas futuras e paginação sem perda de registros", () => {
  const records = Array.from({ length: 14 }, (_, i) => ({
    code: `CAB${i}`,
    arrival:
      i === 0
        ? "2026-10-21"
        : i === 1
          ? "2026-10-18"
          : i === 2
            ? "2026-10-17"
            : "2026-10-13",
    port: "MANAUS",
    sender: "<script>",
    recipient: "B",
  }));
  const content = {
    template: "port-alerts",
    duration: 60,
    fields: {
      referenceDate: "2026-10-20",
      portRecords: JSON.stringify(records),
    },
  };
  const summary = portSummary(content.fields);
  assert.equal(summary.invalid, 1);
  assert.equal(summary.rows.length, 12);
  assert.equal(summary.critical, 11);
  assert.equal(summary.max, 7);
  const frames = presentationFrames(content);
  assert.equal(frames.length, 4);
  assert.equal(
    frames.reduce((s, r) => s + r.duration, 0),
    60,
  );
  const html = frames.slice(1).map(renderSlide).join("");
  for (const r of summary.rows) assert.ok(html.includes(`<b>${r.code}</b>`));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
});

test("programada sem data recebe atenção antes de três dias; agendadas saem das pendências", () => {
  const result = importPortRows([
    [...header, "Situação", "Dt. agendamento descarga"],
    ["NOVO", "20/10/2026", "SUAPE", "A", "B", "ENTREGA PROGRAMADA", ""],
    [
      "ANTIGO",
      "01/10/2026",
      "SUAPE",
      "A",
      "B",
      "ENTREGA PROGRAMADA",
      "22/10/2026",
    ],
    [
      "PENDENTE",
      "10/10/2026",
      "SUAPE",
      "A",
      "B",
      "PENDENTE DE AGENDAMENTO",
      "",
    ],
  ]);
  const fields = {
    referenceDate: "2026-10-21",
    portRecords: JSON.stringify(result.records),
  };
  const summary = portSummary(fields);
  assert.deepEqual(
    summary.rows.map((r) => r.code),
    ["PENDENTE"],
  );
  assert.deepEqual(
    summary.missingSchedule.map((r) => r.code),
    ["NOVO"],
  );
  const pages = portPages(summary.rows, summary.missingSchedule);
  assert.equal(pages[0].attention, true);
  const content = { template: "port-alerts", duration: 60, fields };
  const frames = presentationFrames(content);
  assert.match(
    renderSlide(frames[0]),
    /1 entrega\(s\) programada\(s\) sem data/,
  );
  assert.match(renderSlide(frames[1]), /PROGRAMADA SEM DATA/);
  assert.ok(!frames.map(renderSlide).join("").includes("ANTIGO"));
  const many = Array.from({ length: 20 }, (_, i) => ({
    code: `C${i}`,
    days: 3,
  }));
  assert.equal(portPages([], many).flatMap((p) => p.rows).length, 20);
});
