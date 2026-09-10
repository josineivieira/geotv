import test from "node:test";
import assert from "node:assert/strict";
import { eligible } from "../web/shared/schedule.js";
import { renderSlide, templates } from "../web/shared/templates.js";
test("agendamento respeita limites de data e expira no instante final", () => {
  const c = { start: "2026-09-10T08:00:00Z", end: "2026-09-10T09:00:00Z" };
  assert.equal(eligible(c, new Date("2026-09-10T07:59:59Z")), false);
  assert.equal(eligible(c, new Date(c.start)), true);
  assert.equal(eligible(c, new Date(c.end)), false);
});
test("horários recorrentes e dias usam o fuso do canal", () => {
  const c = { days: [4], timeStart: "11:00", timeEnd: "14:00" };
  assert.equal(
    eligible(c, new Date("2026-09-10T14:00:00Z"), "America/Sao_Paulo"),
    true,
  );
  assert.equal(
    eligible(c, new Date("2026-09-10T17:00:00Z"), "America/Sao_Paulo"),
    false,
  );
  assert.equal(
    eligible(c, new Date("2026-09-11T15:00:00Z"), "America/Sao_Paulo"),
    false,
  );
});
test("faixa de horário pode atravessar meia-noite", () => {
  const c = { timeStart: "22:00", timeEnd: "02:00" };
  assert.equal(
    eligible(c, new Date("2026-09-11T04:00:00Z"), "America/Sao_Paulo"),
    true,
  );
  assert.equal(
    eligible(c, new Date("2026-09-11T06:00:00Z"), "America/Sao_Paulo"),
    false,
  );
});
test("inativos e arquivados não são reproduzidos", () => {
  assert.equal(eligible({ active: false }), false);
  assert.equal(eligible({ status: "Arquivado" }), false);
});
test("todos os modelos renderizam sem injetar texto HTML", () => {
  for (const t of templates) {
    const html = renderSlide({
      template: t.id,
      title: "<script>alert(1)</script>",
      fields: {
        message: "<img onerror=x>",
        participants: "<script>;30\nAna;40",
      },
      demo: true,
    });
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<img onerror"));
    assert.ok(html.includes("tv-slide"));
  }
});
