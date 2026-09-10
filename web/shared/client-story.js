export const storyCards = [
  [
    "top10",
    "Top 10 Clientes",
    "43,0%",
    "Os 10 maiores clientes representam 43% do volume do trimestre.",
    "Concentração",
    "★",
  ],
  [
    "pareto",
    "Clientes 80/20",
    "40",
    "Número de clientes necessários para representar 80% do volume.",
    "Concentração",
    "◆",
  ],
  [
    "share",
    "% Clientes 80/20",
    "25,0%",
    "Parcela dos clientes ativos responsável por 80% do volume.",
    "Concentração",
    "◔",
  ],
  [
    "active",
    "Clientes Ativos",
    "160",
    "Total de clientes ativos no trimestre.",
    "Concentração",
    "●",
  ],
  [
    "new",
    "Novo",
    "40",
    "Clientes embarcando com a Geo pela primeira vez.",
    "Movimentação de clientes",
    "★",
  ],
  [
    "up",
    "Aumentou",
    "72",
    "Clientes recorrentes com aumento superior a 10% em relação ao trimestre anterior.",
    "Movimentação de clientes",
    "↑",
  ],
  [
    "stable",
    "Manteve",
    "6",
    "Clientes recorrentes com variação entre −10% e +10% em relação ao trimestre anterior.",
    "Movimentação de clientes",
    "→",
  ],
  [
    "down",
    "Diminuiu",
    "28",
    "Clientes recorrentes com queda superior a 10% em relação ao trimestre anterior.",
    "Movimentação de clientes",
    "↓",
  ],
  [
    "recovered",
    "Recuperado",
    "18",
    "Clientes sem embarques nos últimos trimestres que voltaram a embarcar.",
    "Movimentação de clientes",
    "↻",
  ],
  [
    "lost",
    "Perdido",
    "50",
    "Clientes que embarcaram no trimestre anterior, mas não neste trimestre.",
    "Movimentação de clientes",
    "×",
  ],
  [
    "churn",
    "Churn",
    "32,9%",
    "Clientes perdidos em relação aos clientes ativos no trimestre anterior.",
    "Movimentação de clientes",
    "◉",
  ],
];
export const storyDefaults = {
  period: "3º trimestre de 2026",
  best: "C M DISTRIBUIDORA;119\nNOVA ERA;83\nAGRO SUL CATARINENSE;67\nSUPERMERCADOS DB;61\nBEBIDAS GRASSI;54",
  offenders:
    "SUPERMERCADOS DB;56;0;-56\nBEBIDAS GRASSI;57;4;-53\nELETROFRIO;34;0;-34\nAGROHORT;34;1;-33\nSUPERMERCADO GAVIAO;16;1;-15",
  ...Object.fromEntries(
    storyCards.flatMap(([key, , value, caption]) => [
      [key, value],
      [key + "Caption", caption],
    ]),
  ),
};
export function storyFrames(content) {
  return Array.from({ length: 13 }, (_, index) => ({
    ...content,
    id: `${content.id || "preview"}:story:${index}`,
    duration: content.duration / 13,
    transition: "fade",
    fields: { ...storyDefaults, ...content.fields, storyScene: index },
  }));
}
