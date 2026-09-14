import test from "node:test";
import assert from "node:assert/strict";
import { presentationFrames } from "../web/shared/presentation.js";
import { renderSlide, templateById } from "../web/shared/templates.js";
test("indicadores: 10 telas, tempos totais e campos editáveis preservados", () => {
  const content = {
    id: "story",
    template: "client-story",
    duration: 100,
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
  assert.match(renderSlide(frames[0]), /Clientes que movem a Geo/);
  assert.equal(frames.length, 10);
  assert.equal(
    frames.reduce((sum, c) => sum + c.duration, 0),
    100,
  );
  assert.equal(new Set(frames.map((c) => c.id)).size, 10);
  assert.ok(frames.every((c) => c.start === content.start && c.active));
  assert.match(renderSlide(frames[1]), /42/);
  assert.match(renderSlide(frames[1]), /Legenda &lt;editada&gt;/);
  assert.match(renderSlide(frames[8]), /Cliente/);
  assert.match(renderSlide(frames[9]), /Top 5 ofensores/);
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
