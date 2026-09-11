export const salesDefaults = {
  period: "SETEMBRO · PARCIAL",
  participants: "Fabíola;50\nHadassa;40\nSilvana;20\nHenrique;10",
  message: "Cada ponto conta. Cada cliente importa.",
  footer: "Foco · Agilidade · Resultado",
};
export const salesFields = [
  ["period", "Mês / status"],
  ["participants", "Participantes: nome; pontos (um por linha)", "textarea"],
  ["message", "Mensagem da campanha"],
  ["footer", "Mensagem inferior"],
];
export function salesRanking(fields) {
  return String(fields.participants ?? salesDefaults.participants)
    .split("\n")
    .map((line) => {
      const [name, raw] = line.split(";");
      return {
        name: name.trim(),
        points: Number((raw || "").trim().replace(",", ".")),
      };
    })
    .filter((row) => row.name && Number.isFinite(row.points) && row.points >= 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 4);
}
export function salesFrames(content) {
  return Array.from({ length: 3 }, (_, index) => ({
    ...content,
    id: `${content.id || "preview"}:sales:${index}`,
    duration: content.duration / 3,
    transition: "fade",
    fields: { ...salesDefaults, ...content.fields, salesScene: index },
  }));
}
export function renderSales(content, e) {
  const f = { ...salesDefaults, ...content.fields },
    rows = salesRanking(f);
  const scene = Math.max(0, Math.min(2, Number(f.salesScene) || 0));
  const points = (n) => n.toLocaleString("pt-BR");
  const ribbons = `<div class="sales-flags" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--flag:${i}"></i>`).join("")}</div>`;
  const podium = rows
    .map(
      (row, i) =>
        `<div class="sales-podium rank-${i + 1}" style="--rank:${i}"><span class="sales-medal">${i + 1}º</span><h2>${e(row.name)}</h2><span class="sales-star">★</span><strong>${points(row.points)} <small>pts</small></strong></div>`,
    )
    .join("");
  let body;
  if (scene === 0)
    body = `<section class="sales-intro"><span class="sales-kicker">NOSSO TIME EM MOVIMENTO</span><h1>Acelera<br><em>Vendas</em></h1><p>${e(f.message)}</p><span class="sales-invitation">Acompanhe a classificação da campanha →</span></section>`;
  else if (scene === 1)
    body = `<section class="sales-board"><h1>Acelera Vendas</h1><div class="sales-podiums">${podium || "<p>Adicione os participantes da campanha.</p>"}</div><p class="sales-motto">${e(f.message)}</p></section>`;
  else
    body = rows.length
      ? `<section class="sales-winner"><span class="sales-kicker">1º LUGAR · ${e(f.period)}</span><span class="sales-trophy">★</span><h1>${e(rows[0].name)}</h1><strong data-story-value="${points(rows[0].points)}">${points(rows[0].points)}</strong><span class="sales-points-label">PONTOS</span><p>${e(f.message)}</p></section>`
      : '<section class="sales-winner"><h1>Seu time faz a diferença.</h1></section>';
  return `<article class="tv-slide sales-show">${ribbons}<header><img src="/assets/geomaritima-logo.png" alt="GeoMarítima Multimodal"><span>${e(f.period)}</span></header>${body}<footer><span>geo<b>tv</b> · ${content.demo ? "DADOS DE DEMONSTRAÇÃO" : "ACELERA VENDAS"}</span><span>${e(f.footer)}</span></footer></article>`;
}
