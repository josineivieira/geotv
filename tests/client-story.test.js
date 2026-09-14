import test from "node:test";
import assert from "node:assert/strict";
import { presentationFrames } from "../web/shared/presentation.js";
import { renderSlide, templateById } from "../web/shared/templates.js";
test("indicadores: 9 telas, tempos totais e campos editáveis preservados", () => {
  const content = {
    id: "story",
    template: "client-story",
    duration: 90,
    active: true,
    start: "2026-01-01",
    fields: {
      top10: "52,5%",
      new: "42",
      newCaption: "Legenda <editada>",
      best: "Cliente;99",
    },
  };
  const frames = presentationFrames(content);
  assert.equal(frames.length, 9);
  assert.equal(
    frames.reduce((sum, c) => sum + c.duration, 0),
    90,
  );
  assert.equal(new Set(frames.map((c) => c.id)).size, 9);
  assert.ok(frames.every((c) => c.start === content.start && c.active));
  assert.match(renderSlide(frames[0]), /42/);
  assert.match(renderSlide(frames[0]), /Legenda &lt;editada&gt;/);
  assert.match(renderSlide(frames[7]), /Cliente/);
  assert.match(renderSlide(frames[8]), /Top 5 ofensores/);
  assert.doesNotMatch(
    frames.map(renderSlide).join(""),
    /Top 10 Clientes|80\/20|Clientes Ativos|52,5%/,
  );
  assert.ok(
    templateById("client-story").fields.every(
      ([key]) => !/^(top10|pareto|share|active)/.test(key),
    ),
  );
});
