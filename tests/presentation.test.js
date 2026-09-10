import test from "node:test";
import assert from "node:assert/strict";
import { presentationFrames, mediaUrls } from "../web/shared/presentation.js";
import { renderSlide } from "../web/shared/templates.js";
test("apresentação expande na ordem com tempos, efeitos e agendamento preservados", () => {
  const c = {
    id: "deck",
    template: "presentation",
    title: "Campanha",
    start: "2026-09-10T00:00:00Z",
    fields: {},
    slides: [
      {
        media: "/media/a.png",
        duration: 7,
        transition: "slide",
        fit: "contain",
        title: "Primeira",
        showText: true,
      },
      { media: "/media/b.png", duration: 12, transition: "zoom", fit: "cover" },
    ],
  };
  const frames = presentationFrames(c);
  assert.equal(frames.length, 2);
  assert.equal(frames[0].duration, 7);
  assert.equal(frames[1].transition, "zoom");
  assert.equal(frames[1].start, c.start);
  assert.notEqual(frames[0].id, frames[1].id);
  assert.deepEqual(mediaUrls(c), ["/media/a.png", "/media/b.png"]);
  assert.ok(renderSlide(c).includes("Primeira"));
  assert.ok(renderSlide(frames[1]).includes("/media/b.png"));
});
