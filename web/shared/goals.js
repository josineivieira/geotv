export const goalPeriods = [
  ["annual", "Anual", 4000, 5720],
  ["monthly", "Mensal", 192, 476],
  ["weekly", "Semanal", 83, 110],
  ["daily", "Hoje", 4000, 3980],
];
export const goalDefaults = {
  reference: "Atualização manual · informe o período",
  unit: "",
  ...Object.fromEntries(
    goalPeriods.flatMap(([key, , current, target]) => [
      [`${key}Current`, current],
      [`${key}Target`, target],
    ]),
  ),
};
export const goalFields = [
  ["reference", "Referência / data de atualização"],
  ["unit", "Unidade (ex.: processos, CNTRs)"],
  ...goalPeriods.flatMap(([key, label]) => [
    [`${key}Current`, `${label} · realizado`, "number"],
    [`${key}Target`, `${label} · meta`, "number"],
  ]),
];
const format = (value, digits = 0) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits || 2,
  });
export function goalMetrics(current, target) {
  const parse = (value) =>
    value === null || String(value ?? "").trim() === "" ? NaN : Number(value);
  current = parse(current);
  target = parse(target);
  const valid =
    Number.isFinite(current) &&
    current >= 0 &&
    Number.isFinite(target) &&
    target > 0;
  const percent = valid ? (current / target) * 100 : NaN;
  const usable = valid && Number.isFinite(percent);
  return {
    current: Number.isFinite(current) && current >= 0 ? format(current) : "—",
    target: Number.isFinite(target) && target > 0 ? format(target) : "—",
    percent: usable ? `${format(percent, 2)}%` : "—",
    progress: usable ? Math.min(100, percent) : 0,
    met: usable && current >= target,
    status: !usable
      ? "Meta não definida"
      : current >= target
        ? "Meta atingida"
        : "Em busca da meta",
    gap: !usable
      ? "Informe realizado e meta válidos"
      : current === target
        ? "Na medida da meta"
        : current > target
          ? `+${format(current - target)} acima da meta`
          : `Faltam ${format(target - current)} para a meta`,
  };
}
export function renderGoals(content, e) {
  const f = { ...goalDefaults, ...content.fields };
  const rows = goalPeriods.map(([key, label]) => ({
    key,
    label,
    ...goalMetrics(f[`${key}Current`], f[`${key}Target`]),
  }));
  const today = rows[3];
  return `<article class="tv-slide goals-slide"><header class="goals-header"><span class="slide-brand">geo<span>tv</span><i></i></span><span>DESEMPENHO / METAS</span></header><div class="goals-title"><div><span class="goals-kicker">CADA RESULTADO CONTA</span><h1>${e(content.title || "Na direção da meta")}</h1></div><span class="goals-unit">${e(f.unit)}</span></div><section class="goals-board"><div class="goals-periods">${rows
    .slice(0, 3)
    .map(
      (row, i) =>
        `<div class="goals-card ${row.met ? "is-met" : ""}" style="--order:${i}"><div class="goals-card-top"><h2>${row.label}</h2><span>${row.status}</span></div><div class="goals-numbers"><strong>${row.current}</strong><span>de ${row.target}</span><b>${row.percent}</b></div><div class="goals-track" aria-label="${row.label}: ${row.percent} da meta"><i style="--progress:${row.progress}%"></i></div><p>${row.gap}</p></div>`,
    )
    .join(
      "",
    )}</div><div class="goals-today ${today.met ? "is-met" : ""}"><div class="goals-today-top"><span>HOJE</span><span class="goals-status">${today.met ? "✓" : "◎"} ${today.status}</span></div><div class="goals-ring" style="--sweep:${today.progress * 3.6}deg"><div><span>REALIZADO ${e(f.unit)}</span><strong>${today.current}</strong><span>META <b>${today.target}</b></span></div></div><div class="goals-today-result"><strong>${today.percent}</strong><span>DA META DO DIA</span></div><p class="goals-gap">${today.gap}</p><div class="goals-cheer">${today.met ? "O resultado de hoje vai além." : "Cada avanço aproxima a conquista."}</div></div></section><footer class="goals-footer"><span>${e(f.reference)}${content.demo ? " · DEMONSTRAÇÃO" : ""}</span><span>UM TIME. NOVAS CONQUISTAS.</span></footer></article>`;
}
