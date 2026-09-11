import test from "node:test";
import assert from "node:assert/strict";
import { presentationFrames } from "../web/shared/presentation.js";
import { renderSlide } from "../web/shared/templates.js";

test("alertas: cinco telas preservam contagens, explicações e duração", () => {
  const frames = presentationFrames({
    id: "alertas",
    template: "process-alerts",
    duration: 50,
    fields: {},
  });
  assert.equal(frames.length, 5);
  assert.equal(
    frames.reduce((sum, frame) => sum + frame.duration, 0),
    50,
  );
  assert.equal(new Set(frames.map((frame) => frame.id)).size, 5);
  for (const [index, count] of [48, 116, 76, 1].entries()) {
    assert.match(
      renderSlide(frames[index + 1]),
      new RegExp(`<strong>${count}</strong>`),
    );
  }
  assert.match(renderSlide(frames[4]), /<span>registro<\/span>/);
  assert.match(renderSlide(frames[3]), /mais de 2 dias/);
  assert.match(renderSlide(frames[0]), /atualização manual/);
  const edited = {
    ...frames[1],
    fields: { ...frames[1].fields, count0: 0, title0: "<customizado>" },
  };
  assert.match(renderSlide(edited), /Nenhum registro/);
  assert.match(renderSlide(edited), /&lt;customizado&gt;/);
  assert.doesNotMatch(renderSlide(edited), /<customizado>/);
});
