import test from "node:test";
import assert from "node:assert/strict";
import {
  importPortRows,
  portSummary,
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
  assert.equal(frames.length, 3);
  assert.equal(
    frames.reduce((s, r) => s + r.duration, 0),
    60,
  );
  const html = frames.slice(1).map(renderSlide).join("");
  for (const r of summary.rows) assert.ok(html.includes(`<b>${r.code}</b>`));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
});
