import test from "node:test";
import assert from "node:assert/strict";
import { goalMetrics } from "../web/shared/goals.js";
import { renderSlide, templateById } from "../web/shared/templates.js";
import { presentationFrames } from "../web/shared/presentation.js";

test("metas: calcula os percentuais da referência e limita o progresso visual", () => {
  assert.equal(goalMetrics(4000, 5720).percent, "69,93%");
  assert.equal(goalMetrics(192, 476).percent, "40,34%");
  assert.equal(goalMetrics(83, 110).percent, "75,45%");
  const daily = goalMetrics(4000, 3980);
  assert.equal(daily.percent, "100,50%");
  assert.equal(daily.progress, 100);
  assert.equal(daily.met, true);
  assert.equal(daily.gap, "+20 acima da meta");
  assert.equal(goalMetrics(0, 100).percent, "0,00%");
  assert.equal(goalMetrics(100, 100).status, "Meta atingida");
});

test("metas: dados inválidos não geram conquista nem percentuais inválidos", () => {
  for (const [current, target] of [
    [1, 0],
    [1, ""],
    [-1, 100],
    ["abc", 100],
    [null, 100],
    [Infinity, 100],
  ]) {
    const result = goalMetrics(current, target);
    assert.equal(result.met, false);
    assert.equal(result.percent, "—");
    assert.equal(result.progress, 0);
  }
});

test("metas: template disponível, valores editáveis e texto escapado", () => {
  assert.equal(templateById("goals").id, "goals");
  const html = renderSlide({
    template: "goals",
    title: "<Metas>",
    fields: { dailyCurrent: 10, dailyTarget: 20, reference: "<script>" },
  });
  assert.match(html, /50,00%/);
  assert.match(html, /Faltam 10 para a meta/);
  assert.match(html, /&lt;Metas&gt;/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /O resultado de hoje vai além/);
});

test("metas: cria tela de celebração somente quando existe conquista", () => {
  const achieved = presentationFrames({
    id: "goal-1",
    template: "goals",
    duration: 20,
    fields: { dailyCurrent: 110, dailyTarget: 100 },
  });
  assert.equal(achieved.length, 2);
  assert.equal(achieved[0].duration, 12);
  assert.equal(achieved[1].duration, 8);
  assert.equal(achieved[1].fields.goalScene, "celebration");
  assert.match(renderSlide(achieved[1]), /Parabéns, time!/);
  assert.match(renderSlide(achieved[1]), /✓ Hoje/);

  const pending = presentationFrames({
    template: "goals",
    fields: {
      annualCurrent: 1,
      annualTarget: 2,
      monthlyCurrent: 1,
      monthlyTarget: 2,
      weeklyCurrent: 1,
      weeklyTarget: 2,
      dailyCurrent: 1,
      dailyTarget: 2,
    },
  });
  assert.equal(pending.length, 1);
});
