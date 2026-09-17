import test from "node:test";
import assert from "node:assert/strict";
import { presentationFrames } from "../web/shared/presentation.js";
import { renderSlide } from "../web/shared/templates.js";
import { salesRanking } from "../web/shared/sales-show.js";

test("campanha animada preserva duração e destaca a maior pontuação", () => {
  const frames = presentationFrames({
    id: "campanha",
    template: "sales-show",
    duration: 30,
    fields: { participants: "Ana;10\n<Líder>;50\nInválido;abc\nBia;20" },
  });
  assert.equal(frames.length, 3);
  assert.equal(
    frames.reduce((sum, frame) => sum + frame.duration, 0),
    30,
  );
  assert.equal(new Set(frames.map((frame) => frame.id)).size, 3);
  assert.deepEqual(
    salesRanking(frames[0].fields).map((row) => row.points),
    [50, 20, 10],
  );
  assert.match(renderSlide(frames[2]), /&lt;Líder&gt;/);
  assert.match(renderSlide(frames[2]), /data-story-value="50"/);
  assert.match(renderSlide(frames[0]), /DESAFIO INTERNO · TIME COMERCIAL/);
  assert.match(renderSlide(frames[0]), /EQUIPE · VELOCIDADE · RESULTADO/);
  assert.match(renderSlide(frames[0]), /GEOMARÍTIMA · NOSSO TIME/);
  assert.match(renderSlide(frames[0]), /GEOMARÍTIMA MULTIMODAL/);
  assert.match(renderSlide(frames[1]), /Quem está acelerando\?/);
  assert.match(renderSlide(frames[1]), /sales-podium rank-1/);
  assert.match(renderSlide(frames[2]), /NA FRENTE POR <strong>\+30/);
  assert.doesNotMatch(renderSlide(frames[1]), /Inválido/);
});
