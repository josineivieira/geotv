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
  const atmosphere = `<div class="sales-atmosphere" aria-hidden="true"><i></i><i></i><i></i><span>›››</span></div>`;
  const podiumCard = (row, rank) =>
    row
      ? `<div class="sales-podium rank-${rank}" style="--rank:${rank}"><span class="sales-medal">${rank}<small>º</small></span>${rank === 1 ? '<span class="sales-crown">★</span>' : ""}<h2>${e(row.name)}</h2><strong>${points(row.points)} <small>PTS</small></strong><div class="sales-podium-base"><span>${rank}º LUGAR</span></div></div>`
      : "";
  const podium = [
    podiumCard(rows[1], 2),
    podiumCard(rows[0], 1),
    podiumCard(rows[2], 3),
  ].join("");
  const lead = rows[1] ? rows[0].points - rows[1].points : rows[0]?.points;
  let body;
  if (scene === 0)
    body = `<section class="sales-intro"><div class="sales-launch-mark" aria-hidden="true"><span>↗</span></div><span class="sales-kicker">CAMPANHA COMERCIAL · NOSSO TIME EM MOVIMENTO</span><h1>ACELERA <em>VENDAS</em></h1><p>${e(f.message)}</p><div class="sales-start-line"><i></i><span>PREPARE-SE PARA O RANKING</span><i></i></div></section>`;
  else if (scene === 1)
    body = `<section class="sales-board"><div class="sales-board-heading"><div><span>CLASSIFICAÇÃO ATUAL</span><h1>Quem está acelerando?</h1></div><span class="sales-live"><i></i> RANKING AO VIVO</span></div><div class="sales-podiums">${podium || "<p>Adicione os participantes da campanha.</p>"}</div>${rows[3] ? `<div class="sales-fourth"><span>4º</span><strong>${e(rows[3].name)}</strong><b>${points(rows[3].points)} PTS</b><i></i></div>` : ""}<p class="sales-motto">${e(f.message)}</p></section>`;
  else
    body = rows.length
      ? `<section class="sales-winner"><div class="sales-winner-burst" aria-hidden="true"><i></i><i></i><i></i></div><span class="sales-kicker">LIDERANÇA DA CAMPANHA · ${e(f.period)}</span><div class="sales-winner-crown" aria-hidden="true">★</div><span class="sales-winner-label">1º LUGAR</span><h1>${e(rows[0].name)}</h1><div class="sales-winner-score"><strong data-story-value="${points(rows[0].points)}">${points(rows[0].points)}</strong><span>PONTOS</span></div>${rows[1] ? `<div class="sales-lead">NA FRENTE POR <strong>+${points(lead)}</strong> PONTOS</div>` : ""}<p>${e(f.message)}</p></section>`
      : '<section class="sales-winner"><h1>Seu time faz a diferença.</h1></section>';
  return `<article class="tv-slide sales-show sales-scene-${scene}">${atmosphere}<header><img src="/assets/geomaritima-logo.png" alt="GeoMarítima Multimodal"><span>${e(f.period)} · ${scene + 1} / 3</span></header>${body}<footer><span>geo<b>tv</b> · ${content.demo ? "DADOS DE DEMONSTRAÇÃO" : "ACELERA VENDAS"}</span><span>${e(f.footer)}</span></footer></article>`;
}
