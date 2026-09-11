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
  priorValues: "444,454,418,402,439,443,404,360,484",
  currentValues: "419,417,450,379,475,456,651,563,191",
};
export const monthlyResultFields = [
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
  const d = monthlyResultData(content.fields);
  const display = (n) => (n === null ? "—" : fmt(n));
  const ceiling = Math.max(1, ...d.prior, ...d.current);
  const y = (value) => 310 - (value / ceiling) * 235;
  const bars = resultMonths
    .map((month, i) => {
      const x = 64 + i * 103;
      return `<g class="results-month" style="--order:${i}">${[d.prior[i], d.current[i]].map((value, j) => `<g class="results-series-${j}">${value === null ? "" : `<rect class="results-bar" x="${x + j * 37}" y="${y(value)}" width="29" height="${310 - y(value)}" rx="4"/>`}<text x="${x + j * 37 + 14.5}" y="${value === null ? 292 : y(value) - 12}" text-anchor="middle">${display(value)}</text></g>`).join("")}<text class="results-month-label" x="${x + 33}" y="345" text-anchor="middle">${month.toUpperCase()}</text></g>`;
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
  return `<article class="tv-slide monthly-results"><header class="results-header"><img src="/assets/geomaritima-logo.png" alt="GeoMarítima Multimodal"><span>RESULTADOS · JANEIRO A SETEMBRO</span></header><div class="results-heading"><div><span class="results-kicker">O MOVIMENTO VIRA RESULTADO</span><h1>${e(content.title || "Nossa evolução, mês a mês")}</h1></div><div class="results-period">JAN <span>→</span> SET</div></div><section class="results-layout"><div class="results-chart-panel"><div class="results-chart-heading"><h2>Volume mensal</h2><div class="results-legend"><span><i></i>${e(d.f.priorYear)}</span><span><i></i>${e(d.f.currentYear)}</span></div></div><svg class="results-chart" viewBox="0 0 1000 370" role="img" aria-label="Volume mensal de janeiro a setembro. Barras claras: ${e(d.f.priorYear)}. Barras roxas: ${e(d.f.currentYear)}.">${[0, 0.5, 1].map((part) => `<line class="results-gridline" x1="48" x2="982" y1="${y(ceiling * part)}" y2="${y(ceiling * part)}"/>`).join("")}${bars}</svg><div class="results-chart-note"><span>Comparativo ${e(d.f.currentYear)} × ${e(d.f.priorYear)}</span><span>${e(d.f.reference)}</span></div></div><aside class="results-summary"><div class="results-total"><span>ACUMULADO · JAN–SET</span><strong>${display(d.currentTotal)}</strong><div class="results-change ${d.change !== null && d.change < 0 ? "is-down" : ""}">${change} <small>vs. ${e(d.f.priorYear)}</small></div><p>${e(d.f.priorYear)}: <b>${display(d.priorTotal)}</b></p></div><div class="results-cumulative"><h2>Ritmo acumulado</h2><svg viewBox="0 0 264 150" role="img" aria-label="Evolução acumulada de janeiro a setembro">${curve(priorCurve, 0)}${curve(currentCurve, 1)}<text x="16" y="148">JAN</text><text x="221" y="148">SET</text></svg></div><div class="results-best"><span>DESTAQUE DE ${e(d.f.currentYear)}</span><strong>${d.best < 0 ? "—" : resultMonths[d.best]} <b>${d.best < 0 ? "—" : display(d.current[d.best])}</b></strong><span>Maior volume do período</span></div></aside></section><footer class="results-footer"><span>GeoTV · ${content.demo ? "DADOS DE DEMONSTRAÇÃO" : "RESULTADOS GEOMARÍTIMA"}</span><span>JUNTOS, MOVIMENTAMOS RESULTADOS.</span></footer></article>`;
}
