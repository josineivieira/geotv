import { storyCards, storyDefaults } from "./client-story.js";
import { hydroFields, renderHydrology } from "./hydrology.js";
import { salesFields, renderSales } from "./sales-show.js";
import { alertFields, renderAlerts } from "./process-alerts.js";
const textFields = [
  ["subtitle", "Subtítulo"],
  ["message", "Mensagem", "textarea"],
  ["footer", "Mensagem inferior"],
];
const metricFields = [
  ["period", "Período"],
  ["current", "Volume atual", "number"],
  ["previous", "Volume anterior", "number"],
  ["target", "Meta mensal", "number"],
  ["annualTarget", "Meta anual", "number"],
  ["potential", "Potencial", "number"],
  ["clients", "Clientes ativos", "number"],
  ["newClients", "Novos clientes", "number"],
  ["recovered", "Clientes recuperados", "number"],
  ["lost", "Clientes perdidos", "number"],
  ["monthly", "Valores mensais (separados por vírgula)"],
  ["priorMonthly", "Ano anterior (separados por vírgula)"],
];
const rankingFields = [
  ["period", "Período"],
  ["participants", "Participantes: nome; pontos (um por linha)", "textarea"],
  ["autoSort", "Ordenar por pontuação", "checkbox"],
  ["message", "Mensagem principal", "textarea"],
  ["footer", "Mensagem inferior"],
  ["campaignStatus", "Status da campanha"],
];
export const templates = [
  [
    "process-alerts",
    "Alertas operacionais · GeoMarítima",
    "Operações",
    "process-alerts",
    "purple",
    alertFields,
  ],
  [
    "sales-show",
    "Acelera Vendas · pódio animado",
    "Campanhas",
    "sales-show",
    "purple",
    salesFields,
  ],
  [
    "hydrology",
    "Boletim dos rios · GeoMarítima",
    "Indicadores",
    "hydrology",
    "purple",
    hydroFields,
  ],
  [
    "client-story",
    "Clientes · apresentação animada",
    "Indicadores",
    "client-story",
    "purple",
    [
      ["period", "Período"],
      ...storyCards.flatMap(([key, title]) => [
        [key, title + " — valor"],
        [key + "Caption", title + " — explicação", "textarea"],
      ]),
      [
        "best",
        "Top 5 melhores: cliente; CNTRs (uma linha por cliente)",
        "textarea",
      ],
      [
        "offenders",
        "Top 5 ofensores: cliente; pico; atual; gap (uma linha por cliente)",
        "textarea",
      ],
    ],
  ],
  [
    "presentation",
    "Minha apresentação",
    "Personalizados",
    "presentation",
    "purple",
    [["message", "Mensagem sobre a imagem", "textarea"]],
  ],
  ["sales", "Acelera Vendas", "Campanhas", "ranking", "green", rankingFields],
  [
    "ranking",
    "Ranking / Pódio",
    "Comercial",
    "ranking",
    "purple",
    rankingFields,
  ],
  [
    "operation",
    "Atenção Operação",
    "Operacional",
    "notice",
    "orange",
    [
      ["client", "Cliente"],
      ["operation", "Operação"],
      ["responsible", "Responsável"],
      ["hour", "Horário"],
      ["channel", "Canal"],
      ["message", "Instrução", "textarea"],
      ["footer", "Observação"],
    ],
  ],
  ["news", "Fique por Dentro", "Comunicação", "notice", "purple", textFields],
  ["notice", "Comunicado", "Comunicação", "notice", "green", textFields],
  [
    "transport",
    "Indicadores GeoTransportes",
    "Indicadores",
    "metrics",
    "green",
    metricFields,
  ],
  [
    "maritime",
    "Indicadores GeoMarítima",
    "Indicadores",
    "metrics",
    "purple",
    metricFields,
  ],
  [
    "results",
    "Nossos Resultados",
    "Indicadores",
    "metrics",
    "green",
    metricFields,
  ],
  [
    "river",
    "Nível do Rio Negro",
    "Operacional",
    "river",
    "blue",
    [
      ["period", "Data / período"],
      ["current", "Nível atual (m)", "number"],
      ["variation", "Variação diária (cm)", "number"],
      ["streak", "Dias de subida / queda", "number"],
      ["trend", "Tendência"],
      ["monthly", "Histórico (separado por vírgula)"],
      ["priorMonthly", "Comparativo anual"],
      ["message", "Alerta operacional", "textarea"],
    ],
  ],
  [
    "target",
    "Meta x Realizado",
    "Indicadores",
    "metrics",
    "purple",
    metricFields,
  ],
  [
    "monthly",
    "Comparativo mensal",
    "Indicadores",
    "metrics",
    "green",
    metricFields,
  ],
  ["top5", "Top 5", "Comercial", "ranking", "purple", rankingFields],
  ["top10", "Top 10", "Comercial", "ranking", "green", rankingFields],
  [
    "clients",
    "Ranking de clientes",
    "Comercial",
    "ranking",
    "purple",
    rankingFields,
  ],
  ["recognition", "Reconhecimento", "Pessoas", "notice", "purple", textFields],
  ["birthdays", "Aniversariantes", "Pessoas", "notice", "green", textFields],
  ["urgent", "Aviso urgente", "Comunicação", "notice", "red", textFields],
  [
    "institutional",
    "Tela institucional",
    "Institucional",
    "notice",
    "green",
    textFields,
  ],
  ["image", "Imagem livre", "Mídia", "image", "green", []],
  ["video", "Vídeo", "Mídia", "video", "purple", []],
].map(([id, name, category, kind, color, fields]) => ({
  id,
  name,
  category,
  kind,
  color,
  fields,
}));
export const templateById = (id) =>
  templates.find((t) => t.id === id) || templates[0];
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const number = (value) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(
    Number(value) || 0,
  );
export function renderSlide(content) {
  if (content.template === "presentation" && content.slides?.length) {
    const first = content.slides[0];
    content = {
      ...content,
      slides: undefined,
      title: first.title || content.title,
      fields: { ...content.fields, ...first },
    };
  }
  const t = templateById(content.template),
    f = content.fields || {},
    e = escapeHtml;
  if (t.kind === "hydrology") return renderHydrology(content, e);
  if (t.kind === "sales-show") return renderSales(content, e);
  if (t.kind === "process-alerts") return renderAlerts(content, e);
  if (t.kind === "client-story") {
    const values = { ...storyDefaults, ...f };
    const index = Math.max(0, Math.min(12, Number(values.storyScene) || 0));
    const card = storyCards[index];
    const title = card
      ? card[1]
      : index === 11
        ? "Top 5 melhores"
        : "Top 5 ofensores";
    const rows = String(values[index === 11 ? "best" : "offenders"])
      .split("\n")
      .filter((line) => line.trim())
      .slice(0, 5);
    const main = card
      ? `<div class="story-symbol">${e(card[5])}</div><h1>${e(title)}</h1><strong class="story-value" data-story-value="${e(values[card[0]])}">${e(values[card[0]])}</strong><p class="story-caption">${e(values[card[0] + "Caption"])}</p>`
      : `<h1>${e(title)}</h1><table><thead><tr>${(index === 11 ? ["Cliente", "CNTRs"] : ["Cliente", "Pico", "Atual", "Gap"]).map((label) => `<th>${label}</th>`).join("")}</tr></thead><tbody>${rows.map((line, i) => `<tr style="--row:${i}">${Array.from({ length: index === 11 ? 2 : 4 }, (_, j) => `<td>${e(line.split(";")[j] || "—")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    return `<article class="tv-slide story-slide"><header><img class="story-logo" src="/assets/geomaritima-logo.png" alt="GeoMarítima Multimodal"><span>${e(values.period)}</span></header><div class="story-section">${e(card?.[4] || "Ranking de clientes")} · ${index + 1} / 13</div><section class="story-stage">${main}</section><footer><span>geo<b>tv</b> · ${content.demo ? "DADOS DE DEMONSTRAÇÃO" : "INDICADORES DE CLIENTES"}</span><span>Conteúdo que conecta. Informação que movimenta.</span></footer></article>`;
  }
  const numbers = String(f.monthly || "")
    .split(",")
    .map(Number)
    .filter(Number.isFinite);
  let body = "";
  if (t.kind === "ranking") {
    let people = String(f.participants || "")
      .split("\n")
      .filter(Boolean)
      .map((line, i) => {
        const [name, points] = line.split(";");
        return { name, points: Number(points) || 0, place: i + 1 };
      });
    if (f.autoSort !== false) people.sort((a, b) => b.points - a.points);
    people = people.slice(0, t.id === "top5" ? 5 : 10);
    body = `${f.campaignStatus ? `<div class="campaign-status">${e(f.campaignStatus)}</div>` : ""}<div class="podium">${[
      1, 0, 2,
    ]
      .filter((i) => people[i])
      .map(
        (i) =>
          `<div class="podium-person place-${i + 1}"><div class="medal">${["🥇", "🥈", "🥉"][i]}</div><h2>${e(people[i].name)}</h2><strong>${number(people[i].points)} <small>pts</small></strong><div class="podium-base">${i + 1}º</div></div>`,
      )
      .join("")}</div><div class="ranking-rest">${people
      .slice(3)
      .map(
        (p, i) =>
          `<span><b>${i + 4}º</b> ${e(p.name)} <strong>${number(p.points)}</strong></span>`,
      )
      .join("")}</div><p class="slide-message">${e(f.message)}</p>`;
  } else if (["metrics", "river"].includes(t.kind)) {
    const current = Number(f.current) || 0,
      previous = Number(f.previous) || 0,
      target = Number(f.target) || 0,
      percent = target ? (current / target) * 100 : 0;
    const max = Math.max(1, ...numbers);
    const prior = String(f.priorMonthly || "")
      .split(",")
      .map(Number);
    const chartMax = Math.max(max, ...prior.filter(Number.isFinite));
    body = `<div class="metric-grid"><div class="metric-main"><span>${t.kind === "river" ? "Nível atual" : "Volume realizado"}</span><strong>${number(current)}${t.kind === "river" ? "<small> m</small>" : ""}</strong><p>${t.kind === "river" ? `${number(f.variation)} cm no dia · ${e(f.trend || "")}` : previous ? `${number(((current - previous) / previous) * 100)}% em relação ao período anterior` : "Informe o período anterior para comparar"}</p></div><div class="metric-secondary"><span>${t.kind === "river" ? "Dias consecutivos" : "Meta do período"}</span><strong>${number(t.kind === "river" ? f.streak : target)}</strong><p>${t.kind === "river" ? e(f.message) : `${number(percent)}% realizado · gap ${number(target - current)}`}</p></div></div><div class="chart">${numbers.map((v, i) => `<div class="chart-column"><div class="bar-pair"><i style="height:${Math.max(1, (v / chartMax) * 100)}%"></i>${prior[i] ? `<i class="prior" style="height:${Math.max(1, (prior[i] / chartMax) * 100)}%"></i>` : ""}</div><span>${["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"][i] || i + 1}</span></div>`).join("")}</div>${target ? `<div class="progress"><i style="width:${Math.max(0, Math.min(100, percent))}%"></i></div>` : ""}${
      f.clients
        ? `<div class="client-stats">${[
            ["clients", "Clientes ativos"],
            ["newClients", "Novos"],
            ["recovered", "Recuperados"],
            ["lost", "Perdidos"],
          ]
            .map(([k, l]) => `<span><b>${number(f[k])}</b> ${l}</span>`)
            .join(
              "",
            )}<span><b>${number((Number(f.lost) / Math.max(1, Number(f.clients))) * 100)}%</b> churn</span></div>`
        : ""
    }${f.annualTarget || f.potential ? `<div class="client-stats"><span>Meta anual <b>${number(f.annualTarget)}</b></span><span>Potencial <b>${number(f.potential)}</b></span></div>` : ""}`;
  } else if (t.kind === "presentation") {
    body = `${f.media ? `<img class="full-media" style="object-fit:${f.fit === "cover" ? "cover" : "contain"}" src="${e(f.media)}" alt="${e(content.title)}">` : '<div class="media-placeholder">Envie sua imagem para criar esta tela</div>'}${f.showText ? `<div class="presentation-overlay"><h2>${e(content.title)}</h2><p>${e(f.message)}</p></div>` : ""}`;
  } else if (t.kind === "image" || t.kind === "video") {
    body = f.media
      ? t.kind === "image"
        ? `<img class="full-media" src="${e(f.media)}" alt="${e(content.title)}">`
        : `<video class="full-media" src="${e(f.media)}" autoplay muted playsinline loop preload="auto"></video>`
      : '<div class="media-placeholder">Selecione uma mídia na biblioteca</div>';
  } else
    body = `<div class="notice-body">${f.media ? `<img class="notice-image" src="${e(f.media)}" alt="">` : ""}<p class="slide-subtitle">${e(f.subtitle)}</p><p class="notice-message">${e(f.message)}</p><div class="operation-details">${[
      ["client", "Cliente"],
      ["operation", "Operação"],
      ["responsible", "Responsável"],
      ["hour", "Horário"],
      ["channel", "Canal"],
    ]
      .filter(([k]) => f[k])
      .map(([k, l]) => `<span><small>${l}</small>${e(f[k])}</span>`)
      .join("")}</div></div>`;
  return `<article class="tv-slide theme-${t.color} layout-${e(f.layout || "standard")}" style="--font-scale:${Math.max(0.8, Math.min(1.2, Number(f.fontScale) || 1))}"><div class="slide-orbit"></div>${["image", "video", "presentation"].includes(t.kind) ? "" : `<header class="slide-header"><span class="slide-brand">geo<span>tv</span><i></i></span><span>${e(f.period || content.category || t.category)}</span></header><h1>${e(content.title || t.name)}</h1>`}${body}${["image", "video", "presentation"].includes(t.kind) ? "" : `<footer class="slide-footer"><span>${e(f.footer || "Conectando pessoas. Movendo resultados.")}</span><b>${content.demo ? "DADOS DE DEMONSTRAÇÃO" : "GEOTV · CANAL INTERNO"}</b></footer>`}</article>`;
}
