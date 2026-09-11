import test from "node:test";
import assert from "node:assert/strict";
import { monthlyResultData } from "../web/shared/monthly-results.js";
import { renderSlide } from "../web/shared/templates.js";

test("resultados mensais: calcula acumulado somente de janeiro a setembro", () => {
  const d = monthlyResultData();
  assert.equal(d.currentTotal, 4001);
  assert.equal(d.priorTotal, 3848);
  assert.equal(d.best, 6);
  assert.ok(Math.abs(d.change - 3.97609147609148) < 0.00001);
  const extra = monthlyResultData({
    currentValues: "419,417,450,379,475,456,651,563,191,999,999,999",
  });
  assert.deepEqual(extra.current, d.current);
  assert.equal(extra.currentTotal, 4001);
});

test("resultados mensais: não trata valores ausentes como zero", () => {
  const d = monthlyResultData({ currentValues: "0,10,,30,-1,abc,40,50,60" });
  assert.equal(d.current[0], 0);
  assert.equal(d.current[2], null);
  assert.equal(d.current[4], null);
  assert.equal(d.currentTotal, null);
  assert.equal(d.change, null);
});

test("resultados mensais: renderiza nove pares de barras e escapa campos", () => {
  const html = renderSlide({
    template: "monthly-results",
    title: "<Resultados>",
    fields: { reference: "<script>" },
  });
  assert.equal((html.match(/class="results-bar"/g) || []).length, 18);
  assert.match(html, /4\.001/);
  assert.match(html, /3\.848/);
  assert.match(html, /&lt;Resultados&gt;/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, />OUT<|>NOV<|>DEZ<|NaN|Infinity/);
});
