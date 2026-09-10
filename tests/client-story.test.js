import test from "node:test";
import assert from "node:assert/strict";
import { presentationFrames } from "../web/shared/presentation.js";
import { renderSlide } from "../web/shared/templates.js";
test("indicadores: 13 telas, tempos totais e campos editáveis preservados", () => {
  const content = {
    id: "story",
    template: "client-story",
    duration: 130,
    active: true,
    start: "2026-01-01",
    fields: {
      top10: "52,5%",
      top10Caption: "Legenda <editada>",
      best: "Cliente;99",
    },
  };
  const frames = presentationFrames(content);
  assert.equal(frames.length, 13);
  assert.equal(
    frames.reduce((sum, c) => sum + c.duration, 0),
    130,
  );
  assert.equal(new Set(frames.map((c) => c.id)).size, 13);
  assert.ok(frames.every((c) => c.start === content.start && c.active));
  assert.match(renderSlide(frames[0]), /52,5%/);
  assert.match(renderSlide(frames[0]), /Legenda &lt;editada&gt;/);
  assert.match(renderSlide(frames[11]), /Cliente/);
  assert.match(renderSlide(frames[12]), /Top 5 ofensores/);
});
