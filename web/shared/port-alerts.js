export const portFields = [
  ["referenceDate", "Data de referência dos cálculos", "date"],
];
const normalize = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function isoDate(value) {
  const s = String(value ?? "").trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + "T00:00:00Z");
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}
export function importPortRows(table) {
  const aliases = [
    ["codigo", "codigodoprocesso", "processo"],
    ["dtchegada", "datadechegada", "datachegada"],
    ["portodedestino", "portodestino"],
    ["remetente"],
    ["destinatario"],
  ];
  let columns;
  const header = table.findIndex((row) => {
    const names = row.map(normalize);
    const found = aliases.map((list) =>
      names.findIndex((n) => list.includes(n)),
    );
    if (found.every((i) => i >= 0)) {
      columns = found;
      return true;
    }
    return false;
  });
  if (header < 0)
    throw new Error(
      "Não encontrei Código, Dt. chegada, Porto de destino, Remetente e Destinatário na planilha.",
    );
  const records = [],
    seen = new Set();
  let duplicates = 0;
  for (const [index, row] of table.slice(header + 1).entries()) {
    if (!row.some((v) => String(v ?? "").trim())) continue;
    const values = columns.map((i) => String(row[i] ?? "").trim());
    const [code, arrival, port, sender, recipient] = values;
    if (!code || !isoDate(arrival) || !port)
      throw new Error(
        `Linha ${header + index + 2}: confira código, data de chegada e porto. Nenhum dado foi substituído.`,
      );
    if (seen.has(code)) {
      duplicates++;
      continue;
    }
    seen.add(code);
    records.push({ code, arrival: isoDate(arrival), port, sender, recipient });
  }
  if (!records.length) throw new Error("A planilha não contém processos.");
  if (records.length > 1000)
    throw new Error("Use até 1.000 processos por painel.");
  return { records, duplicates };
}
export function portSummary(fields) {
  const date = isoDate(fields.referenceDate);
  let records = [];
  try {
    records = JSON.parse(fields.portRecords || "[]");
  } catch {}
  if (!Array.isArray(records) || !date)
    return { rows: [], total: 0, invalid: 0, critical: 0, max: 0, average: 0 };
  let invalid = 0;
  const rows = records
    .flatMap((r) => {
      const arrival = isoDate(r.arrival);
      const days = arrival
        ? Math.round((Date.parse(date) - Date.parse(arrival)) / 86400000)
        : -1;
      if (days < 0) {
        invalid++;
        return [];
      }
      return [{ ...r, days }];
    })
    .filter((r) => r.days >= 3)
    .sort((a, b) => b.days - a.days || a.code.localeCompare(b.code));
  return {
    rows,
    total: records.length,
    invalid,
    critical: rows.filter((r) => r.days >= 7).length,
    max: rows[0]?.days || 0,
    average: rows.length
      ? (rows.reduce((s, r) => s + r.days, 0) / rows.length)
          .toFixed(1)
          .replace(".", ",")
      : 0,
  };
}
export function portPages(rows) {
  if (!rows.length) return [];
  const top = rows.slice(0, 5);
  let threeDays = top.filter((r) => r.days === 3).length;
  const remaining = rows
    .slice(5)
    .filter((r) => r.days !== 3 || ++threeDays <= 6);
  const pages = [{ title: "Os 5 mais críticos", top: true, rows: top }];
  for (let i = 0; i < remaining.length; i += 6)
    pages.push({
      title: "Prioridade de agendamento",
      top: false,
      rows: remaining.slice(i, i + 6),
    });
  return pages;
}
export function portFrames(content) {
  const count = 1 + portPages(portSummary(content.fields || {}).rows).length;
  return Array.from({ length: count }, (_, i) => ({
    ...content,
    id: `${content.id || "preview"}:port:${i}`,
    duration: content.duration / count,
    transition: "fade",
    fields: { ...content.fields, portScene: i },
  }));
}
export function renderPort(content, e) {
  const f = content.fields || {},
    s = portSummary(f),
    scene = Number(f.portScene) || 0;
  const pages = portPages(s.rows);
  const count = 1 + pages.length;
  const page = pages[scene - 1];
  const displayed = pages.reduce((sum, p) => sum + p.rows.length, 0);
  const body =
    scene === 0
      ? `<div class="port-heading"><span>ATENÇÃO, OPERAÇÃO</span><h1>Parados no porto.<br>Agendamento pendente.</h1><p>Processos no destino há 3 dias ou mais sem agendamento de entrega.</p></div><div class="port-kpis">${[
          [s.rows.length, "processos em alerta"],
          [s.critical, "com 7 dias ou mais"],
          [s.max, "dias · maior espera"],
          [s.average, "dias · espera média"],
        ]
          .map(
            ([n, t]) => `<div><strong>${e(n)}</strong><span>${t}</span></div>`,
          )
          .join(
            "",
          )}</div>${!s.total ? "<p>Importe a planilha de pendências para gerar a apresentação.</p>" : !s.rows.length ? "<p>Nenhum processo com 3 dias ou mais nesta base.</p>" : ""}`
      : `<div class="port-list-heading"><h1>${e(page?.title || "Prioridade de agendamento")}</h1><span>${page?.top ? "AÇÃO PRIORITÁRIA · MAIOR TEMPO PARADO" : "MAIOR TEMPO PARADO PRIMEIRO"}</span></div><table class="${page?.top ? "port-top-five" : ""}"><thead><tr><th>Processo / chegada</th><th>Porto</th><th>Remetente / destinatário</th><th>Parado há</th></tr></thead><tbody>${(
          page?.rows || []
        )
          .map(
            (r) =>
              `<tr><td><b>${e(r.code)}</b><small>${e(r.arrival.split("-").reverse().join("/"))}</small></td><td>${e(r.port)}</td><td><span>${e(r.sender)}</span><small>${e(r.recipient)}</small></td><td><strong class="${r.days >= 7 ? "critical" : ""}">${r.days} dias</strong></td></tr>`,
          )
          .join("")}</tbody></table>`;
  return `<article class="tv-slide port-alerts"><header><img src="/assets/geomaritima-logo.png" alt="GeoMarítima"><b>OPERAÇÕES &nbsp; / &nbsp; PENDENTE AGENDAMENTO</b></header><main>${body}</main><footer><span>Base: ${e(f.sourceName || "sem planilha")} · Referência: ${e(f.referenceDate || "—")}<br>${s.total} processos importados${displayed < s.rows.length ? ` · ${displayed} de ${s.rows.length} alertas exibidos · até 6 processos com 3 dias` : ""}${s.invalid ? ` · ${s.invalid} datas futuras excluídas` : ""}</span><b>${scene + 1} / ${count}</b></footer></article>`;
}
