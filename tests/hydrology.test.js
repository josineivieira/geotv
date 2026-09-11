import test from "node:test";
import assert from "node:assert/strict";
import { presentationFrames } from "../web/shared/presentation.js";
import { renderSlide } from "../web/shared/templates.js";
test("boletim: seis telas com data, fontes e histórico da referência", () => {
  const frames = presentationFrames({
    id: "rios",
    template: "hydrology",
    duration: 60,
    fields: {},
    start: "2026-09-10",
  });
  assert.equal(frames.length, 6);
  assert.equal(
    frames.reduce((sum, c) => sum + c.duration, 0),
    60,
  );
  assert.ok(frames.every((c) => c.start === "2026-09-10"));
  for (const frame of frames) assert.match(renderSlide(frame), /10\/09\/2026/);
  assert.match(renderSlide(frames[0]), /22,68/);
  assert.match(renderSlide(frames[4]), /11,61/);
  assert.match(renderSlide(frames[5]), /-1,56/);
  assert.match(
    renderSlide({
      ...frames[1],
      fields: { ...frames[1].fields, negro: "<alterado>" },
    }),
    /&lt;alterado&gt;/,
  );
});
