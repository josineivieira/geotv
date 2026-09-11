const definitions = [
  [
    "48",
    "Processos sem data de entrada no porto",
    "Processos sem data de entrada no porto com coleta D+1.",
  ],
  [
    "116",
    "CTE emitido × deadline de documentação",
    "Processos na situação de CTE emitido no mínimo 1 dia antes do deadline de documentos.",
  ],
  [
    "76",
    "Documentos enviados para a cia. marítima",
    "Processos aguardando confirmação de embarque há mais de 2 dias.",
  ],
  [
    "1",
    "Validação processo × reserva",
    "Processos com divergências entre informações do processo e da reserva.",
  ],
];
export const alertDefaults = {
  reference: "Dados da imagem de referência · atualização manual",
};
export const alertFields = [["reference", "Referência / data de atualização"]];
definitions.forEach(([count, title, description], i) => {
  alertDefaults[`count${i}`] = count;
  alertDefaults[`title${i}`] = title;
  alertDefaults[`description${i}`] = description;
  alertFields.push(
    [`count${i}`, `Alerta ${i + 1} · quantidade`, "number"],
    [`title${i}`, `Alerta ${i + 1} · nome`],
    [`description${i}`, `Alerta ${i + 1} · explicação`, "textarea"],
  );
});
export function alertFrames(content) {
  return Array.from({ length: 5 }, (_, i) => ({
    ...content,
    id: `${content.id || "preview"}:alert:${i}`,
    duration: content.duration / 5,
    transition: "fade",
    fields: { ...alertDefaults, ...content.fields, alertScene: i },
  }));
}
export function renderAlerts(content, e) {
  const f = { ...alertDefaults, ...content.fields };
  const scene = Math.max(0, Math.min(4, Math.floor(Number(f.alertScene) || 0)));
  const rows = definitions.map((_, i) => {
    const raw = Number(f[`count${i}`]);
    const count = Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
    return {
      count,
      number: count === null ? "—" : count.toLocaleString("pt-BR"),
      title: f[`title${i}`],
      description: f[`description${i}`],
    };
  });
  const number = (row) =>
    `<strong>${row.number}</strong><span>${row.count === 1 ? "registro" : "registros"}</span>`;
  const warning = `<svg class="alerts-warning" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 61 57H3Z" fill="currentColor" stroke="currentColor" stroke-linejoin="round" stroke-width="4"/><path d="M32 23v15" stroke="#17191d" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="47" r="3" fill="#17191d"/></svg>`;
  const body =
    scene === 0
      ? `<section class="alerts-overview"><div class="alerts-heading">${warning}<div><div class="alerts-eyebrow">MONITORAMENTO DE PROCESSOS</div><h1>Atenção, operação!</h1></div></div><div class="alerts-grid">${rows.map((row, i) => `<div class="alerts-tile" style="--order:${i}"><span class="alerts-index">0${i + 1}</span>${number(row)}<h2>${e(row.title)}</h2><p>${e(row.description)}</p></div>`).join("")}</div></section>`
      : `<section class="alerts-focus"><div class="alerts-copy"><div class="alerts-eyebrow">${warning} PONTO DE ATENÇÃO · 0${scene} / 04</div><h1>${e(rows[scene - 1].title)}</h1><p>${e(rows[scene - 1].description)}</p></div><div class="alerts-quantity">${number(rows[scene - 1])}<span class="alerts-count-caption">${rows[scene - 1].count === 0 ? "Nenhum registro nesta categoria" : "Painel diário de processos"}</span></div></section>`;
  return `<article class="tv-slide process-alerts"><header><img src="/assets/geomaritima-logo.png" alt="GeoMarítima Multimodal"><span class="alerts-badge">! &nbsp; ALERTAS OPERACIONAIS</span></header>${body}<footer><span>${e(f.reference)}${content.demo ? " · DEMONSTRAÇÃO" : ""}</span><div class="alerts-steps" aria-label="Tela ${scene + 1} de 5">${rows
    .concat([{}])
    .map((_, i) => `<i class="${i === scene ? "active" : ""}"></i>`)
    .join(
      "",
    )}</div><span>GeoTV · Informação que movimenta.</span></footer></article>`;
}
