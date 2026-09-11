export const rivers = [
  ["negro", "Rio Negro", "Manaus", "22,68", "0,16", "Manaus Pilots"],
  ["amazonas", "Rio Amazonas", "Itacoatiara", "8,76", "0,16", "PROA Manaus"],
  ["tabatinga", "Rio Solimões", "Tabatinga", "2,96", "0,20", "PROA Manaus"],
  ["coari", "Rio Solimões", "Coari", "11,61", "0,19", "Manaus Pilots"],
];
export const hydroDefaults = {
  date: "10/09/2026",
  history:
    "Rio Negro · Manaus;22,68;25,74;17,47;21,72\nRio Amazonas · Itacoatiara;8,76;11,34;4,54;8,07\nRio Solimões · Tabatinga;2,96;3,18;-1,56;0,96",
  historyPeriod: "Comparativo em 10/09 · 2026 / 2025 / 2024 / 2023",
  ...Object.fromEntries(
    rivers.flatMap(([key, , , level, drop, source]) => [
      [key, level],
      [key + "Change", `↓ Desceu ${drop} m em relação à medição anterior.`],
      [key + "Source", source],
    ]),
  ),
};
export const hydroFields = [
  ["date", "Data da medição"],
  ...rivers.flatMap(([key, river, city]) => [
    [key, `${river} · ${city} — nível (m)`],
    [key + "Change", `${city} — variação e explicação`],
    [key + "Source", `${city} — fonte`],
  ]),
  ["historyPeriod", "Período do comparativo histórico"],
  [
    "history",
    "Histórico: rio; nível 1; nível 2; nível 3; nível 4 (uma linha por rio)",
    "textarea",
  ],
];
export function hydroFrames(content) {
  return Array.from({ length: 6 }, (_, index) => ({
    ...content,
    id: `${content.id || "preview"}:hydro:${index}`,
    duration: content.duration / 6,
    transition: "fade",
    fields: { ...hydroDefaults, ...content.fields, hydroScene: index },
  }));
}
export function renderHydrology(content, e) {
  const f = { ...hydroDefaults, ...content.fields };
  const index = Math.max(0, Math.min(5, Number(f.hydroScene) || 0));
  let body;
  if (index === 0)
    body = `<h1>Os rios que conectam a nossa operação</h1><div class="hydro-grid">${rivers.map(([key, river, city]) => `<div class="hydro-card"><span>${river} · ${city}</span><strong>${e(f[key])} <small>m</small></strong><p>${e(f[key + "Change"])}</p></div>`).join("")}</div>`;
  else if (index < 5) {
    const [key, river, city] = rivers[index - 1];
    body = `<div class="story-symbol">≋</div><h1>${river} · ${city}</h1><strong class="story-value">${e(f[key])}<small class="hydro-unit"> m</small></strong><p class="story-caption">${e(f[key + "Change"])}</p><p class="hydro-source">Fonte indicada: ${e(f[key + "Source"])}</p>`;
  } else
    body = `<h1>Histórico dos níveis</h1><p class="hydro-source">${e(f.historyPeriod)}</p><table><thead><tr><th>Rio / localidade</th><th colspan="4">Níveis em metros · ordem indicada acima</th></tr></thead><tbody>${String(
      f.history,
    )
      .split("\n")
      .filter(Boolean)
      .slice(0, 4)
      .map(
        (line, i) =>
          `<tr style="--row:${i}">${Array.from({ length: 5 }, (_, j) => `<td>${e(line.split(";")[j] || "—")}</td>`).join("")}</tr>`,
      )
      .join("")}</tbody></table>`;
  return `<article class="tv-slide story-slide hydro-slide"><header><img class="story-logo" src="/assets/geomaritima-logo.png" alt="GeoMarítima Multimodal"><span>Medição: ${e(f.date)}</span></header><div class="story-section">Monitoramento hidrológico · ${index + 1} / 6</div><section class="story-stage">${body}</section><footer><span>geo<b>tv</b> · BOLETIM DOS RIOS</span><span>Dados da medição indicada · atualização manual</span></footer></article>`;
}
