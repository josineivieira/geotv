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
export function goalFrames(content) {
  const fields = { ...goalDefaults, ...content.fields };
  const hasAchievement = goalPeriods.some(
    ([key]) => goalMetrics(fields[`${key}Current`], fields[`${key}Target`]).met,
  );
  if (!hasAchievement) return [content];
  const duration = Math.max(10, Number(content.duration) || 20);
  return [
    {
      ...content,
      id: `${content.id || "preview"}:goals:board`,
      duration: duration * 0.6,
      transition: "fade",
      fields: { ...content.fields, goalScene: "board" },
    },
    {
      ...content,
      id: `${content.id || "preview"}:goals:celebration`,
      duration: duration * 0.4,
      transition: "zoom",
      fields: { ...content.fields, goalScene: "celebration" },
    },
  ];
}
export function renderGoals(content, e) {
  const f = { ...goalDefaults, ...content.fields };
  const rows = goalPeriods.map(([key, label]) => ({
    key,
    label,
    ...goalMetrics(f[`${key}Current`], f[`${key}Target`]),
  }));
  const today = rows[3];
  if (f.goalScene === "celebration") {
    const achieved = rows.filter((row) => row.met);
    const confetti = Array.from(
      { length: 30 },
      (_, i) =>
        `<i style="--x:${(i * 37) % 100}%;--delay:${(i % 10) * 0.12}s;--drift:${(i % 2 ? 1 : -1) * (2 + (i % 5))}cqw;--turn:${180 + (i % 4) * 90}deg"></i>`,
    ).join("");
    return `<article class="tv-slide goals-slide goals-celebration"><div class="goals-confetti" aria-hidden="true">${confetti}</div><header class="goals-header"><img class="goals-logo" src="/assets/geomaritima-logo.png" alt="GeoMarítima Multimodal"><span>DESEMPENHO / CONQUISTA</span></header><section class="goals-celebration-stage"><div class="goals-trophy" aria-hidden="true"><span>★</span></div><span class="goals-celebration-kicker">META BATIDA</span><h1>Parabéns, time!</h1><p>O resultado é de todos. Seguimos juntos, transformando esforço em conquista.</p><div class="goals-achievements">${achieved.map((row, i) => `<div style="--order:${i}"><span>✓ ${row.label}</span><strong>${row.percent}</strong><small>${row.gap}</small></div>`).join("")}</div></section><footer class="goals-footer"><span>${e(f.reference)}${content.demo ? " · DEMONSTRAÇÃO" : ""}</span><span>UM TIME. NOVAS CONQUISTAS.</span></footer></article>`;
  }
  return `<article class="tv-slide goals-slide"><header class="goals-header"><img class="goals-logo" src="/assets/geomaritima-logo.png" alt="GeoMarítima Multimodal"><span>DESEMPENHO / METAS</span></header><div class="goals-title"><div><span class="goals-kicker">CADA RESULTADO CONTA</span><h1>${e(content.title || "Na direção da meta")}</h1></div><span class="goals-unit">${e(f.unit)}</span></div><section class="goals-board"><div class="goals-periods">${rows
    .slice(0, 3)
    .map(
      (row, i) =>
        `<div class="goals-card ${row.met ? "is-met" : ""}" style="--order:${i}"><div class="goals-card-top"><h2>${row.label}</h2><span>${row.status}</span></div><div class="goals-numbers"><strong>${row.current}</strong><span>de ${row.target}</span><b>${row.percent}</b></div><div class="goals-track" aria-label="${row.label}: ${row.percent} da meta"><i style="--progress:${row.progress}%"></i></div><p>${row.gap}</p></div>`,
    )
    .join(
      "",
    )}</div><div class="goals-today ${today.met ? "is-met" : ""}"><div class="goals-today-top"><span>HOJE</span><span class="goals-status">${today.met ? "✓" : "◎"} ${today.status}</span></div><div class="goals-ring" style="--sweep:${today.progress * 3.6}deg"><div><span>REALIZADO ${e(f.unit)}</span><strong>${today.current}</strong><span>META <b>${today.target}</b></span></div></div><div class="goals-today-result"><strong>${today.percent}</strong><span>DA META DO DIA</span></div><p class="goals-gap">${today.gap}</p><div class="goals-cheer">${today.met ? "O resultado de hoje vai além." : "Cada avanço aproxima a conquista."}</div></div></section><footer class="goals-footer"><span>${e(f.reference)}${content.demo ? " · DEMONSTRAÇÃO" : ""}</span><span>UM TIME. NOVAS CONQUISTAS.</span></footer></article>`;
}
