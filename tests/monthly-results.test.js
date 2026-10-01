import test from "node:test";
import assert from "node:assert/strict";
import {
  monthlyResultData,
  resultGrowth,
  monthlyResultFrames,
} from "../web/shared/monthly-results.js";
import { renderSlide } from "../web/shared/templates.js";
test("crescimento: compara meses completos e divide em três telas legíveis", () => {
  const growth = resultGrowth();
  assert.equal(growth.current, 3810);
  assert.equal(growth.prior, 3364);
  assert.equal(growth.delta, 446);
  assert.equal(growth.winners, 5);
  assert.equal(growth.best.month, "Jul");
  assert.equal(resultGrowth({ comparisonMonths: 9 }).delta, 153);
  assert.equal(resultGrowth({ currentValues: "" }).percent, null);
  assert.equal(
    resultGrowth({ priorValues: "0,0,0,0,0,0,0,0,0" }).percent,
    null,
  );
  const frames = monthlyResultFrames({
    id: "test",
    template: "monthly-results",
    duration: 30,
    fields: {},
  });
  assert.equal(frames.length, 3);
  assert.equal(
    frames.reduce((sum, f) => sum + f.duration, 0),
    30,
  );
  assert.equal(new Set(frames.map((f) => f.id)).size, 3);
  assert.match(renderSlide(frames[1]), /13,26%/);
  assert.match(renderSlide(frames[2]), /MESES COM CRESCIMENTO/);
});

test("resultados mensais: aceita dados de janeiro a dezembro", () => {
  const d = monthlyResultData({ comparisonMonths: 9 });
  assert.equal(d.currentTotal, 4001);
  assert.equal(d.priorTotal, 3848);
  assert.equal(d.best, 6);
  assert.ok(Math.abs(d.change - 3.97609147609148) < 0.00001);
  const extra = monthlyResultData({
    comparisonMonths: 12,
    currentValues: "419,417,450,379,475,456,651,563,191,999,999,999",
    priorValues: "444,454,418,402,439,443,404,360,484,100,100,100",
  });
  assert.deepEqual(extra.current.slice(9), [999, 999, 999]);
  assert.equal(extra.currentTotal, 6998);
});

test("resultados mensais: ignora valores ausentes no acumulado parcial", () => {
  const d = monthlyResultData({ comparisonMonths: 9, currentValues: "0,10,,30,-1,abc,40,50,60" });
  assert.equal(d.current[0], 0);
  assert.equal(d.current[2], null);
  assert.equal(d.current[4], null);
  assert.equal(d.currentTotal, 190);
  assert.ok(d.change < 0);
});

test("resultados mensais: renderiza doze meses e escapa campos", () => {
  const html = renderSlide({
    template: "monthly-results",
    title: "<Resultados>",
    fields: { comparisonMonths: 9, reference: "<script>" },
  });
  assert.equal((html.match(/class="results-bar"/g) || []).length, 18);
  assert.match(html, /4\.001/);
  assert.match(html, /3\.848/);
  assert.match(html, /&lt;Resultados&gt;/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, />OUT<.*>NOV<.*>DEZ</s);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test("campo de comparação controla acumulado, período e meses exibidos", () => {
  const september = monthlyResultData({ comparisonMonths: 9 });
  assert.equal(september.periodEnd, "Set");
  assert.equal(september.currentTotal, 4001);

  const october = monthlyResultData({
    comparisonMonths: 10,
    priorValues: "444,454,418,402,439,443,404,360,484,448",
    currentValues: "419,417,450,379,475,456,651,563,535,0",
  });
  assert.equal(october.periodEnd, "Out");
  assert.equal(october.currentTotal, 4345);
});

test("gráfico mostra valores preenchidos após o período sem somá-los", () => {
  const html = renderSlide({
    template: "monthly-results",
    fields: {
      comparisonMonths: 9,
      priorValues: "444,454,418,402,439,443,404,360,484,448",
      currentValues: "419,417,450,379,475,456,651,563,535,0",
    },
  });
  assert.match(html, /ACUMULADO · JAN–SET/);
  assert.match(html, />4\.345</);
  assert.match(html, />448</);
  assert.match(html, />0</);
});
