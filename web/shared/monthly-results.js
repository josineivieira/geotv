export const resultMonths = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
];
export const monthlyResultDefaults = {
  reference: "Atualizado em 11/09/2026 · setembro parcial",
  priorYear: "2025",
  currentYear: "2026",
  comparisonMonths: 8,
  priorValues: "444,454,418,402,439,443,404,360,484",
  currentValues: "419,417,450,379,475,456,651,563,191",
};
export const monthlyResultFields = [
  [
    "comparisonMonths",
    "Comparar meses completos até (1 = Jan, 8 = Ago, 9 = Set)",
    "number",
  ],
  ["reference", "Referência / atualização"],
  ["priorYear", "Ano de comparação"],
  ["currentYear", "Ano atual"],
  [
    "priorValues",
    "Ano de comparação · Jan a Set (9 valores separados por vírgula)",
    "textarea",
  ],
  [
    "currentValues",
    "Ano atual · Jan a Set (9 valores separados por vírgula)",
    "textarea",
  ],
];
const fmt = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
export function monthlyResultFrames(content) {
  return Array.from({ length: 3 }, (_, scene) => ({
    ...content,
    id: `${content.id || "preview"}:results:${scene}`,
    duration: Math.max(15, Number(content.duration) || 30) / 3,
    transition: "fade",
    fields: { ...content.fields, resultScene: scene },
  }));
}
export function resultGrowth(fields = {}) {
  const d = monthlyResultData(fields);
  const months = Math.max(
    1,
    Math.min(9, Math.floor(Number(d.f.comparisonMonths) || 8)),
  );
  const pairs = d.current
    .slice(0, months)
    .map((value, i) => ({
      value,
      prior: d.prior[i],
      month: resultMonths[i],
      index: i,
    }));
  const valid = pairs.every((p) => p.value !== null && p.prior !== null);
  const current = valid ? pairs.reduce((n, p) => n + p.value, 0) : null;
  const prior = valid ? pairs.reduce((n, p) => n + p.prior, 0) : null;
  const delta =
    valid && Number.isFinite(current - prior) ? current - prior : null;
  const percent =
    delta !== null && prior > 0 && Number.isFinite((delta / prior) * 100)
      ? (delta / prior) * 100
      : null;
  const winners = pairs.filter(
    (p) => p.value !== null && p.prior !== null && p.value > p.prior,
  );
  const best = winners.reduce(
    (best, p) =>
      !best || p.value - p.prior > best.value - best.prior ? p : best,
    null,
  );
  return {
    ...d,
    months,
    period:
      months === 1 ? "JAN" : `JAN–${resultMonths[months - 1].toUpperCase()}`,
    current,
    prior,
    delta,
    percent,
    winners: valid ? winners.length : null,
    best: valid ? best : null,
  };
}
function renderGrowth(content, e, scene) {
  const g = resultGrowth(content.fields);
  const display = (n) => (n === null ? "—" : fmt(n));
  const signed = (n) => (n === null ? "—" : `${n > 0 ? "+" : ""}${fmt(n)}`);
  const headline =
    g.delta === null
      ? "Complete os dados do período"
      : g.delta > 0
        ? "Crescemos juntos."
        : g.delta < 0
          ? "Hora de recuperar o ritmo."
          : "No mesmo ritmo.";
  const body =
    scene === 1
      ? `<div class="growth-hero"><span>EVOLUÇÃO SOBRE ${e(g.f.priorYear)}</span><strong>${signed(g.percent)}${g.percent === null ? "" : "%"}</strong><h1>${headline}</h1><p>${signed(g.delta)} em volume no mesmo período</p></div><div class="growth-comparison"><div><span>${e(g.f.priorYear)} · ${g.period}</span><strong>${display(g.prior)}</strong></div><span class="growth-arrow">→</span><div><span>${e(g.f.currentYear)} · ${g.period}</span><strong>${display(g.current)}</strong></div></div>`
      : `<h1 class="growth-title">Os meses que fizeram a diferença</h1><div class="growth-highlights"><div><span>MESES COM CRESCIMENTO</span><strong>${display(g.winners)}<small> / ${g.months}</small></strong><p>Acima do mesmo mês de ${e(g.f.priorYear)}</p></div><div><span>MAIOR GANHO EM VOLUME</span><strong>${g.best ? g.best.month.toUpperCase() : "—"}</strong><p>${g.best ? `${signed(g.best.value - g.best.prior)} · ${display(g.best.prior)} → ${display(g.best.value)}` : "Nenhum mês com alta identificada"}</p></div></div><div class="growth-takeaway">${g.delta === null ? "Preencha todos os meses para comparar." : `${signed(g.delta)} no acumulado · ${g.period} de ${e(g.f.currentYear)} × ${e(g.f.priorYear)}`}</div>`;
  return `<article class="tv-slide monthly-results growth-slide ${g.delta < 0 ? "growth-down" : ""}"><header class="results-header"><img src="/assets/geomaritima-logo.png" alt="GeoMarítima Multimodal"><span>MESMO PERÍODO · ${g.period} · ${scene + 1} / 3</span></header><section class="growth-stage">${body}</section><footer class="results-footer"><span>${g.months < 9 ? `Meses após ${resultMonths[g.months - 1]} fora desta comparação` : "Comparação até setembro"}${content.demo ? " · DEMONSTRAÇÃO" : ""}</span><span>${e(g.f.reference)}</span></footer></article>`;
}
export function monthlyResultData(fields = {}) {
  const f = { ...monthlyResultDefaults, ...fields };
  const parse = (value) => {
    const cells = String(value).split(",").slice(0, 9);
    return resultMonths.map((_, i) => {
      const n = Number(cells[i]);
      return cells[i]?.trim() && Number.isFinite(n) && n >= 0 ? n : null;
    });
  };
  const prior = parse(f.priorValues),
    current = parse(f.currentValues);
  const sum = (values) =>
    values.every((v) => v !== null) &&
    Number.isFinite(values.reduce((a, b) => a + b, 0))
      ? values.reduce((a, b) => a + b, 0)
      : null;
  const priorTotal = sum(prior),
    currentTotal = sum(current);
  const change =
    priorTotal > 0 && currentTotal !== null
      ? (currentTotal / priorTotal - 1) * 100
      : null;
  const best = current.reduce(
    (index, value, i) =>
      value !== null && (index === -1 || value > current[index]) ? i : index,
    -1,
  );
  return {
    f,
    prior,
    current,
    priorTotal,
    currentTotal,
    change: Number.isFinite(change) ? change : null,
    best,
  };
}
export function renderMonthlyResults(content, e) {
  const scene = Math.max(
    0,
    Math.min(2, Math.floor(Number(content.fields?.resultScene) || 0)),
  );
  if (scene) return renderGrowth(content, e, scene);
  const d = monthlyResultData(content.fields);
  const display = (n) => (n === null ? "—" : fmt(n));
  const ceiling = Math.max(1, ...d.prior, ...d.current);
  const y = (value) => 370 - (value / ceiling) * 275;
  const bars = resultMonths
    .map((month, i) => {
      const x = 20 + i * 110;
      const best = i === d.best;
      return `<g class="results-month ${best ? "is-best" : ""}" style="--order:${i}"><rect class="results-lane" x="${x - 10}" y="34" width="102" height="384" rx="14"/>${best ? `<text class="results-peak-label" x="${x + 41}" y="60" text-anchor="middle">DESTAQUE</text>` : ""}${[
        d.prior[i],
        d.current[i],
      ]
        .map((value, j) => {
          const close =
            d.prior[i] !== null &&
            d.current[i] !== null &&
            Math.abs(y(d.prior[i]) - y(d.current[i])) < 25;
          const labelY =
            value === null ? 350 : y(value) - 14 - (close && j === 0 ? 23 : 0);
          return `<g class="results-series-${j}">${value === null ? "" : `<rect class="results-bar" x="${x + j * 47}" y="${y(value)}" width="34" height="${370 - y(value)}" rx="6"/>`}<text x="${x + j * 47 + 17}" y="${labelY}" text-anchor="middle">${display(value)}</text></g>`;
        })
        .join(
          "",
        )}<text class="results-month-label" x="${x + 41}" y="405" text-anchor="middle">${month.toUpperCase()}</text></g>`;
    })
    .join("");
  const cumulative = (values) => {
    let total = 0;
    return values.map((v) =>
      v === null || total === null ? (total = null) : (total += v),
    );
  };
  const priorCurve = cumulative(d.prior),
    currentCurve = cumulative(d.current);
  const curveMax = Math.max(1, ...priorCurve, ...currentCurve);
  const curve = (values, series) =>
    `<polyline class="results-curve results-series-${series}" points="${values
      .map((v, i) =>
        v === null ? "" : `${16 + i * 29},${126 - (v / curveMax) * 105}`,
      )
      .filter(Boolean)
      .join(" ")}"/>`;
  const change =
    d.change === null ? "—" : `${d.change > 0 ? "+" : ""}${fmt(d.change)}%`;
  return `<article class="tv-slide monthly-results"><header class="results-header"><img src="/assets/geomaritima-logo.png" alt="GeoMarítima Multimodal"><span>RESULTADOS · JANEIRO A SETEMBRO</span></header><div class="results-heading"><div><span class="results-kicker">O MOVIMENTO VIRA RESULTADO</span><h1>${e(content.title || "Nossa evolução, mês a mês")}</h1></div><div class="results-period">JAN <span>→</span> SET</div></div><section class="results-layout"><div class="results-chart-panel"><div class="results-chart-heading"><h2>Volume mensal</h2><div class="results-legend"><span><i></i>${e(d.f.priorYear)}</span><span><i></i>${e(d.f.currentYear)}</span></div></div><svg class="results-chart" viewBox="0 0 1000 440" role="img" aria-label="Volume mensal de janeiro a setembro. Barras roxas: ${e(d.f.priorYear)}. Barras verdes: ${e(d.f.currentYear)}.">${[0, 0.5, 1].map((part) => `<line class="results-gridline" x1="10" x2="998" y1="${y(ceiling * part)}" y2="${y(ceiling * part)}"/>`).join("")}${bars}</svg><div class="results-chart-note"><span>Comparativo ${e(d.f.currentYear)} × ${e(d.f.priorYear)}</span><span>${e(d.f.reference)}</span></div></div><aside class="results-summary"><div class="results-total"><span>ACUMULADO · JAN–SET</span><strong>${display(d.currentTotal)}</strong><div class="results-change ${d.change !== null && d.change < 0 ? "is-down" : ""}">${change} <small>vs. ${e(d.f.priorYear)}</small></div><p>${e(d.f.priorYear)}: <b>${display(d.priorTotal)}</b></p></div><div class="results-cumulative"><h2>Ritmo acumulado</h2><svg viewBox="0 0 264 150" role="img" aria-label="Evolução acumulada de janeiro a setembro">${curve(priorCurve, 0)}${curve(currentCurve, 1)}<text x="16" y="148">JAN</text><text x="221" y="148">SET</text></svg></div><div class="results-best"><span>DESTAQUE DE ${e(d.f.currentYear)}</span><strong>${d.best < 0 ? "—" : resultMonths[d.best]} <b>${d.best < 0 ? "—" : display(d.current[d.best])}</b></strong><span>Maior volume do período</span></div></aside></section><footer class="results-footer"><span>GeoTV · ${content.demo ? "DADOS DE DEMONSTRAÇÃO" : "RESULTADOS GEOMARÍTIMA"}</span><span>JUNTOS, MOVIMENTAMOS RESULTADOS.</span></footer></article>`;
}
